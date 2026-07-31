// Widget do vendedor. Injeta o próprio HTML e CSS para poder ser colado em
// qualquer página com uma linha de <script>.
(function () {
  "use strict";

  var API_BASE = window.FILA_API_BASE || "";
  var HISTORICO_MAX = 20;
  var historico = [];
  var enviando = false;
  // Estado que o servidor devolve e nós ecoamos: hoje, qual unidade esta
  // conversa criou. É de lá que sai a cobrança, não do que o modelo escreveu.
  var sessao = {};

  var CSS = [
    '.fv-chat-abrir{position:fixed;right:20px;bottom:20px;z-index:60;display:flex;align-items:center;gap:9px;',
    'padding:13px 18px;border:0;border-radius:999px;background:#ED2C27;color:#fff;font:inherit;font-size:14.5px;',
    'font-weight:700;cursor:pointer;box-shadow:0 6px 22px rgba(237,44,39,.32)}',
    '.fv-chat-abrir:hover{filter:brightness(1.07)}',
    '.fv-chat{position:fixed;right:20px;bottom:20px;z-index:61;width:min(380px,calc(100vw - 32px));',
    'height:min(560px,calc(100vh - 40px));display:none;flex-direction:column;background:#fff;border:1px solid #DBD4C9;',
    'border-radius:18px;overflow:hidden;box-shadow:0 16px 50px rgba(25,25,25,.24)}',
    '.fv-chat.on{display:flex}',
    '.fv-chat-topo{display:flex;align-items:center;gap:10px;padding:14px 16px;background:#191919;color:#F0EFEB}',
    '.fv-chat-topo strong{font-size:14.5px;font-weight:700}',
    '.fv-chat-topo small{display:block;font-size:11.5px;color:#8C857A;margin-top:1px}',
    '.fv-chat-fechar{margin-left:auto;background:transparent;border:0;color:#8C857A;font-size:20px;line-height:1;cursor:pointer;padding:4px 6px}',
    '.fv-chat-fechar:hover{color:#F0EFEB}',
    '.fv-chat-corpo{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:11px;background:#F0EFEB}',
    '.fv-msg{max-width:86%;padding:10px 13px;border-radius:13px;font-size:14.5px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}',
    '.fv-msg.bot{align-self:flex-start;background:#fff;border:1px solid #DBD4C9;color:#191919;border-bottom-left-radius:4px}',
    '.fv-msg.eu{align-self:flex-end;background:#ED2C27;color:#fff;border-bottom-right-radius:4px}',
    '.fv-msg a{color:inherit;text-decoration:underline}',
    '.fv-msg.bot a{color:#ED2C27}',
    '.fv-pensando{align-self:flex-start;display:flex;gap:4px;padding:12px 14px}',
    '.fv-pensando i{width:6px;height:6px;border-radius:50%;background:#8C857A;animation:fvp 1.2s infinite}',
    '.fv-pensando i:nth-child(2){animation-delay:.18s}.fv-pensando i:nth-child(3){animation-delay:.36s}',
    '@keyframes fvp{0%,60%,100%{opacity:.25}30%{opacity:1}}',
    '.fv-chat-pe{display:flex;gap:8px;padding:12px;border-top:1px solid #DBD4C9;background:#fff}',
    '.fv-chat-pe input{flex:1;padding:11px 13px;border:1px solid #C9C2B5;border-radius:10px;font:inherit;font-size:14.5px;outline:none;color:#191919}',
    '.fv-chat-pe input:focus{border-color:#ED2C27}',
    '.fv-chat-pe button{border:0;border-radius:10px;padding:0 16px;background:#ED2C27;color:#fff;font:inherit;font-weight:700;cursor:pointer}',
    '.fv-chat-pe button:disabled{opacity:.5;cursor:default}',
    '.fv-aviso{padding:8px 14px;font-size:11.5px;color:#8C857A;text-align:center;background:#fff;border-top:1px solid #E8E6DF}',
    '.fv-pix{align-self:flex-start;max-width:86%;background:#fff;border:1px solid #DBD4C9;border-radius:13px;padding:13px;display:flex;flex-direction:column;gap:9px}',
    '.fv-pix-topo{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:15px;color:#191919}',
    '.fv-pix-teste{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#8A5B12;background:#FBEBCF;padding:2px 7px;border-radius:99px}',
    '.fv-pix-qr{width:150px;height:150px;align-self:center;border-radius:8px;background:#fff}',
    '.fv-pix-codigo{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.45;color:#4A4742;background:#F0EFEB;border:1px solid #DBD4C9;border-radius:8px;padding:8px 9px;word-break:break-all;max-height:76px;overflow-y:auto;user-select:all}',
    '.fv-pix-copiar{border:0;border-radius:9px;padding:10px;background:#191919;color:#fff;font:inherit;font-weight:700;font-size:13.5px;cursor:pointer}',
    '.fv-pix-copiar:hover{background:#34322E}',
    '.fv-pix-link{text-align:center;font-size:13px;color:#ED2C27}',
    '.fv-pix-nota{font-size:11.5px;color:#8C857A;text-align:center}',
    '@media(prefers-reduced-motion:reduce){.fv-pensando i{animation:none;opacity:.6}}'
  ].join("");

  var HTML = [
    '<div class="fv-chat-topo">',
    '<div><strong>Assistente do Fila Virtual</strong><small>Responde na hora</small></div>',
    '<button class="fv-chat-fechar" id="fv-fechar" aria-label="Fechar conversa">&times;</button>',
    '</div>',
    '<div class="fv-chat-corpo" id="fv-corpo" role="log" aria-live="polite"></div>',
    '<form class="fv-chat-pe" id="fv-form">',
    '<input id="fv-input" placeholder="Como funciona?" maxlength="800" autocomplete="off" aria-label="Sua mensagem">',
    '<button type="submit" id="fv-enviar">Enviar</button>',
    '</form>',
    '<p class="fv-aviso">Assistente automático. Não escreva CPF, cartão ou dado de saúde.</p>'
  ].join("");

  function esc(v) {
    var d = document.createElement("div");
    d.textContent = v == null ? "" : String(v);
    return d.innerHTML;
  }

  // Só transformamos URLs em link — nada de HTML vindo do modelo.
  function comLinks(texto) {
    return esc(texto).replace(/(https?:\/\/[^\s<]+)/g, function (url) {
      return '<a href="' + url + '" target="_blank" rel="noopener">' + url + "</a>";
    });
  }

  var corpo, input, botao, painel;

  function bolha(texto, quem) {
    var el = document.createElement("div");
    el.className = "fv-msg " + quem;
    el.innerHTML = comLinks(texto);
    corpo.appendChild(el);
    corpo.scrollTop = corpo.scrollHeight;
    return el;
  }

  // O bloco de pagamento vem do servidor em campo estruturado, nunca do texto
  // do modelo: um LLM não copia string opaca longa sem corromper, e um Pix
  // com um caractere a mais é um Pix que o banco recusa.
  function blocoDePagamento(pix) {
    var el = document.createElement("div");
    el.className = "fv-pix";

    var partes = [];
    partes.push('<div class="fv-pix-topo"><strong>Pix de ' + esc(pix.valorLabel) + "</strong>" +
      (pix.sandbox ? '<span class="fv-pix-teste">ambiente de teste</span>' : "") + "</div>");
    if (pix.qrBase64) {
      partes.push('<img class="fv-pix-qr" alt="QR code do Pix" src="data:image/png;base64,' + esc(pix.qrBase64) + '">');
    }
    partes.push('<div class="fv-pix-codigo" ></div>');
    partes.push('<button type="button" class="fv-pix-copiar">Copiar código</button>');
    if (pix.ticketUrl) {
      partes.push('<a class="fv-pix-link" href="' + esc(pix.ticketUrl) + '" target="_blank" rel="noopener">Abrir no banco</a>');
    }
    partes.push('<div class="fv-pix-nota">O premium libera assim que o pagamento cair.</div>');
    el.innerHTML = partes.join("");

    // textContent, não innerHTML: o código é dado, não marcação.
    el.querySelector(".fv-pix-codigo").textContent = pix.copiaECola;

    var botaoCopiar = el.querySelector(".fv-pix-copiar");
    botaoCopiar.addEventListener("click", function () {
      var pronto = function () {
        botaoCopiar.textContent = "Copiado";
        setTimeout(function () { botaoCopiar.textContent = "Copiar código"; }, 2000);
        if (window.FilaAnalytics) FilaAnalytics.track("chat:pix_copiado");
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(pix.copiaECola).then(pronto, function () {
          selecionar(el.querySelector(".fv-pix-codigo"));
        });
      } else {
        selecionar(el.querySelector(".fv-pix-codigo"));
      }
    });

    corpo.appendChild(el);
    corpo.scrollTop = corpo.scrollHeight;
    if (window.FilaAnalytics) FilaAnalytics.track("chat:pix_gerado");
  }

  // Sem permissão de clipboard, ao menos deixamos o código selecionado.
  function selecionar(no) {
    var faixa = document.createRange();
    faixa.selectNodeContents(no);
    var selecao = window.getSelection();
    selecao.removeAllRanges();
    selecao.addRange(faixa);
  }

  function pensando(ligar) {
    var existente = document.getElementById("fv-pensando");
    if (!ligar) { if (existente) existente.remove(); return; }
    if (existente) return;
    var el = document.createElement("div");
    el.className = "fv-pensando";
    el.id = "fv-pensando";
    el.innerHTML = "<i></i><i></i><i></i>";
    corpo.appendChild(el);
    corpo.scrollTop = corpo.scrollHeight;
  }

  async function enviar(texto) {
    if (enviando || !texto.trim()) return;
    enviando = true;
    botao.disabled = true;
    bolha(texto, "eu");
    input.value = "";
    pensando(true);

    if (window.FilaAnalytics) FilaAnalytics.track("chat:mensagem");

    try {
      var res = await fetch(API_BASE + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: texto, history: historico, sessao: sessao })
      });
      var dados = await res.json();
      pensando(false);

      if (!res.ok) {
        bolha(dados.error || "Não consegui responder agora. Tente pelo WhatsApp.", "bot");
        return;
      }

      bolha(dados.resposta, "bot");
      if (dados.sessao) sessao = dados.sessao;
      if (dados.pagamento) blocoDePagamento(dados.pagamento);
      historico.push({ role: "user", content: texto });
      historico.push({ role: "assistant", content: dados.resposta });
      if (historico.length > HISTORICO_MAX) historico = historico.slice(-HISTORICO_MAX);
    } catch (erro) {
      pensando(false);
      bolha("Perdi a conexão. Você pode criar sua fila em /cadastro.html enquanto isso.", "bot");
    } finally {
      enviando = false;
      botao.disabled = false;
      input.focus();
    }
  }

  function montar() {
    var estilo = document.createElement("style");
    estilo.textContent = CSS;
    document.head.appendChild(estilo);

    var abrir = document.createElement("button");
    abrir.className = "fv-chat-abrir";
    abrir.id = "fv-abrir";
    abrir.setAttribute("data-ev", "abrir_chat");
    abrir.innerHTML = "Tirar uma dúvida";
    document.body.appendChild(abrir);

    painel = document.createElement("div");
    painel.className = "fv-chat";
    painel.setAttribute("role", "dialog");
    painel.setAttribute("aria-label", "Assistente do Fila Virtual");
    painel.innerHTML = HTML;
    document.body.appendChild(painel);

    corpo = document.getElementById("fv-corpo");
    input = document.getElementById("fv-input");
    botao = document.getElementById("fv-enviar");

    abrir.addEventListener("click", function () {
      painel.classList.add("on");
      abrir.style.display = "none";
      if (!corpo.children.length) {
        bolha("Oi! Sou o assistente do Fila Virtual. Posso explicar como funciona, quanto custa, ou já criar uma fila de demonstração com o nome do seu estabelecimento. O que você quer saber?", "bot");
      }
      input.focus();
    });

    document.getElementById("fv-fechar").addEventListener("click", function () {
      painel.classList.remove("on");
      abrir.style.display = "";
    });

    document.getElementById("fv-form").addEventListener("submit", function (e) {
      e.preventDefault();
      enviar(input.value);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && painel.classList.contains("on")) {
        painel.classList.remove("on");
        abrir.style.display = "";
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", montar);
  } else {
    montar();
  }
})();
