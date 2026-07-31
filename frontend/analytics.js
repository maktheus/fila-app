// Coleta de comportamento do Fila Virtual.
//
// LGPD: nada aqui identifica pessoa. O id de sessão é aleatório e morre ao
// fechar a aba; NUNCA enviamos valor digitado, nome, e-mail ou telefone —
// apenas qual campo foi tocado. Se precisar de um campo novo, mande o nome
// dele, não o conteúdo.
(function (global) {
  "use strict";

  var API_BASE = global.FILA_API_BASE || "";
  var ENABLED = global.FILA_ANALYTICS_ENABLED !== false;
  var SESSION_KEY = "fila_anon_session";
  var FLUSH_MS = 4000;
  var MAX_BATCH = 25;

  var queue = [];
  var timer = null;
  var surface = "desconhecida";
  var venue = null;

  function anonId() {
    try {
      var id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id = (global.crypto && global.crypto.randomUUID)
          ? global.crypto.randomUUID()
          : String(Date.now()) + "-" + Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (e) {
      return "sem-sessao";
    }
  }

  function refHost() {
    try {
      return document.referrer ? new URL(document.referrer).host : "";
    } catch (e) {
      return "";
    }
  }

  function track(name, props) {
    if (!ENABLED || !name) return;
    queue.push({
      name: String(name).slice(0, 48),
      surface: surface,
      venue: venue,
      path: location.pathname.slice(0, 80),
      props: props || {},
      at: Date.now()
    });
    if (queue.length >= MAX_BATCH) flush();
    else if (!timer) timer = setTimeout(flush, FLUSH_MS);
  }

  function flush(useBeacon) {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!queue.length) return;

    var body = JSON.stringify({ session: anonId(), ref: refHost(), events: queue });
    queue = [];
    var url = API_BASE + "/api/events";

    // Ao fechar a aba, fetch normal é cancelado; sendBeacon sobrevive.
    if (useBeacon && global.navigator && navigator.sendBeacon) {
      try {
        navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
        return;
      } catch (e) { /* cai no fetch */ }
    }

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      keepalive: true
    }).catch(function () { /* telemetria nunca quebra a tela */ });
  }

  // ---- cliques declarativos: <button data-ev="entrar_na_fila"> ----
  function onClick(event) {
    var el = event.target && event.target.closest ? event.target.closest("[data-ev]") : null;
    if (!el) return;
    track("clique:" + el.dataset.ev, el.dataset.evProps ? safeProps(el.dataset.evProps) : {});
    detectRage(el);
  }

  function safeProps(raw) {
    try {
      var parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  // ---- rage click: 3 toques no mesmo alvo em 1s = algo não respondeu ----
  var rage = { el: null, count: 0, at: 0 };
  function detectRage(el) {
    var now = Date.now();
    if (rage.el === el && now - rage.at < 1000) {
      rage.count++;
      if (rage.count === 3) track("frustracao:clique_repetido", { alvo: el.dataset.ev });
    } else {
      rage.el = el;
      rage.count = 1;
    }
    rage.at = now;
  }

  // ---- formulário abandonado: mexeu nos campos e não enviou ----
  function watchForm(form, nome) {
    if (!form) return;
    var tocou = false;
    var enviou = false;
    var campos = [];

    form.addEventListener("input", function (e) {
      var campo = e.target && (e.target.id || e.target.name);
      if (campo && campos.indexOf(campo) < 0) campos.push(campo);
      if (!tocou) {
        tocou = true;
        track("form:iniciado", { form: nome });
      }
    });

    form.addEventListener("submit", function () {
      enviou = true;
      track("form:enviado", { form: nome });
    });

    global.addEventListener("pagehide", function () {
      // Só o nome dos campos preenchidos, nunca o que foi digitado.
      if (tocou && !enviou) track("form:abandonado", { form: nome, campos: campos.join(",") });
    });
  }

  // ---- erros: o que o usuário viu quebrar ----
  function watchErrors() {
    global.addEventListener("error", function (e) {
      track("erro:js", {
        msg: String(e.message || "").slice(0, 120),
        arquivo: String(e.filename || "").split("/").pop().slice(0, 40),
        linha: e.lineno || 0
      });
    });

    global.addEventListener("unhandledrejection", function (e) {
      var motivo = e.reason && e.reason.message ? e.reason.message : String(e.reason || "");
      track("erro:promessa", { msg: motivo.slice(0, 120) });
    });
  }

  // ---- falhas de API: qual chamada devolveu erro para o usuário ----
  function watchFetch() {
    var original = global.fetch;
    if (typeof original !== "function") return;

    global.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var comeco = Date.now();
      return original.apply(this, arguments).then(function (res) {
        if (!res.ok && url.indexOf("/api/") >= 0 && url.indexOf("/api/events") < 0) {
          track("erro:api", {
            rota: rotaLimpa(url),
            status: res.status,
            ms: Date.now() - comeco
          });
        }
        return res;
      }).catch(function (err) {
        if (url.indexOf("/api/events") < 0) {
          track("erro:rede", { rota: rotaLimpa(url) });
        }
        throw err;
      });
    };
  }

  // Tira ids e slugs da rota para os eventos agruparem: /api/venues/x/tickets/9 -> /api/venues/:slug/tickets/:id
  function rotaLimpa(url) {
    try {
      var path = new URL(url, location.origin).pathname;
      return path
        .replace(/\/api\/venues\/[^/]+/, "/api/venues/:slug")
        .replace(/\/\d+/g, "/:id")
        .slice(0, 60);
    } catch (e) {
      return "desconhecida";
    }
  }

  function init(options) {
    options = options || {};
    surface = options.surface || "desconhecida";
    venue = options.venue || null;
    if (!ENABLED) return;

    watchErrors();
    watchFetch();
    track("tela:aberta", { ref: refHost() });

    document.addEventListener("click", onClick, true);
    global.addEventListener("pagehide", function () { flush(true); });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") flush(true);
    });
  }

  global.FilaAnalytics = {
    init: init,
    track: track,
    watchForm: watchForm,
    flush: flush,
    setVenue: function (slug) { venue = slug || null; }
  };
})(window);
