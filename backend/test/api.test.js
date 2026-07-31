const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

const SERVER = path.join(__dirname, '..', 'server.js');
const PASSWORD = 'senha-de-teste';

// Sobe uma instancia isolada do servidor (persistencia em arquivo temporario,
// sem Postgres) e espera o /api/health responder.
async function startServer(extraEnv = {}) {
  const port = 3100 + Math.floor(Math.random() * 400);
  const dataFile = path.join(os.tmpdir(), `fila-test-${port}-${Date.now()}.json`);
  const child = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      PORT: String(port),
      DATA_FILE: dataFile,
      DATABASE_URL: '',
      NODE_ENV: 'test',
      SEED_DEMO: 'true',
      OPERATOR_PASSWORD: PASSWORD,
      ADMIN_TOKEN: '',
      RATE_LIMIT_TICKETS: '500',
      RATE_LIMIT_LOGIN: '500',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(base + '/api/health');
      if (res.ok) return { child, base, dataFile };
    } catch (e) { /* ainda subindo */ }
    await new Promise(r => setTimeout(r, 150));
  }
  child.kill();
  throw new Error('Servidor de teste nao respondeu em 15s');
}

function stopServer(server) {
  if (!server) return;
  server.child.kill();
  try { fs.unlinkSync(server.dataFile); } catch (e) { /* ja removido */ }
}

async function login(base, password = PASSWORD) {
  const res = await fetch(base + '/api/operator/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return { status: res.status, body: await res.json() };
}

function authed(token) {
  return { Authorization: 'Bearer ' + token };
}

describe('API da fila', () => {
  let server;
  let base;

  before(async () => {
    server = await startServer();
    base = server.base;
  });

  after(() => stopServer(server));

  test('health responde ok com versao', async () => {
    const res = await fetch(base + '/api/health');
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.status, 'ok');
    assert.ok(body.version);
  });

  test('config publica nao vaza segredo do operador', async () => {
    const res = await fetch(base + '/api/config');
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(body.venue.name);
    const serialized = JSON.stringify(body);
    assert.ok(!serialized.includes(PASSWORD), 'config expos a senha do operador');
  });

  describe('entrada na fila', () => {
    test('guarda apenas o primeiro nome (LGPD)', async () => {
      const res = await fetch(base + '/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Maria Silva Santos' }),
      });
      const body = await res.json();
      assert.strictEqual(res.status, 201);
      assert.strictEqual(body.ticket.name, 'Maria');
      assert.match(body.ticket.code, /^M-\d{3}$/);
      assert.strictEqual(body.ticket.status, 'waiting');
    });

    test('rejeita nome vazio', async () => {
      const res = await fetch(base + '/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '   ' }),
      });
      assert.strictEqual(res.status, 400);
    });

    test('remove caracteres de script do nome', async () => {
      const res = await fetch(base + '/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '<script>alert(1)</script>' }),
      });
      const body = await res.json();
      assert.strictEqual(res.status, 201);
      assert.ok(!body.ticket.name.includes('<'), 'nome manteve caractere perigoso');
      assert.ok(!body.ticket.name.includes('>'), 'nome manteve caractere perigoso');
    });
  });

  describe('autenticacao do operador', () => {
    test('acao de operador sem token responde 401', async () => {
      const res = await fetch(base + '/api/tickets/call-next', { method: 'POST' });
      assert.strictEqual(res.status, 401);
    });

    test('senha errada responde 401 e nao devolve token', async () => {
      const { status, body } = await login(base, 'senha-errada');
      assert.strictEqual(status, 401);
      assert.ok(!body.token);
    });

    test('senha correta abre sessao com expiracao', async () => {
      const { status, body } = await login(base);
      assert.strictEqual(status, 200);
      assert.ok(body.token && body.token.length >= 32);
      assert.ok(body.expiresAt > Date.now());
    });

    test('sessao valida autoriza chamar o proximo', async () => {
      const { body } = await login(base);
      const res = await fetch(base + '/api/tickets/call-next', {
        method: 'POST',
        headers: authed(body.token),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ticket.status, 'calling');
    });

    test('token invalido responde 401', async () => {
      const res = await fetch(base + '/api/tickets/call-next', {
        method: 'POST',
        headers: authed('token-inventado'),
      });
      assert.strictEqual(res.status, 401);
    });

    test('logout invalida a sessao', async () => {
      const { body } = await login(base);
      await fetch(base + '/api/operator/logout', { method: 'POST', headers: authed(body.token) });
      const res = await fetch(base + '/api/operator/session', { headers: authed(body.token) });
      assert.strictEqual(res.status, 401);
    });
  });

  describe('minimizacao de dados pessoais (LGPD)', () => {
    test('estado publico nao expoe nomes da fila', async () => {
      await fetch(base + '/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Fernanda' }),
      });
      const res = await fetch(base + '/api/state');
      const state = await res.json();
      assert.ok(state.tickets.length > 0, 'estado veio vazio, teste inconclusivo');
      const comNome = state.tickets.filter(t => t.name);
      assert.strictEqual(comNome.length, 0, 'estado publico vazou nomes');
      assert.ok(!JSON.stringify(state).includes('Fernanda'), 'nome apareceu no payload publico');
    });

    test('operador autenticado continua vendo os nomes', async () => {
      const { body } = await login(base);
      const res = await fetch(base + '/api/state', { headers: authed(body.token) });
      const state = await res.json();
      assert.ok(state.tickets.some(t => t.name), 'operador nao recebeu os nomes');
    });
  });

  describe('passar a vez com proximidade', () => {
    async function novoTicket(nome) {
      const res = await fetch(base + '/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nome }),
      });
      return (await res.json()).ticket;
    }

    test('sem coordenada nem QR responde 403', async () => {
      const ticket = await novoTicket('Joana');
      const res = await fetch(base + `/api/tickets/${ticket.id}/pass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(res.status, 403);
    });

    test('coordenada distante responde 403', async () => {
      const ticket = await novoTicket('Lucas');
      const res = await fetch(base + `/api/tickets/${ticket.id}/pass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: -23.55, longitude: -46.63 }),
      });
      const body = await res.json();
      assert.strictEqual(res.status, 403);
      assert.ok(body.proximity.distanceMeters > 120);
    });

    test('QR token da unidade autoriza passar a vez', async () => {
      const ticket = await novoTicket('Bianca');
      await novoTicket('Rodrigo'); // alguem atras para receber a vez
      const posicaoAntes = ticket.position;
      const res = await fetch(base + `/api/tickets/${ticket.id}/pass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken: 'demo-centro' }),
      });
      const body = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.proximity.method, 'qr');
      assert.strictEqual(body.ticket.source, 'passou');
      assert.ok(body.ticket.position > posicaoAntes, 'a posicao deveria ter aumentado');
    });

    test('ultimo da fila recebe 409 em vez de sucesso falso', async () => {
      const ticket = await novoTicket('Ultimo');
      const res = await fetch(base + `/api/tickets/${ticket.id}/pass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken: 'demo-centro' }),
      });
      const body = await res.json();
      assert.strictEqual(res.status, 409);
      assert.match(body.error, /ultimo da fila/i);
    });

    test('ticket inexistente responde 404', async () => {
      const res = await fetch(base + '/api/tickets/999999/pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken: 'demo-centro' }),
      });
      assert.strictEqual(res.status, 404);
    });

    test('confirmar presenca exige o QR correto', async () => {
      const ticket = await novoTicket('Renato');
      const res = await fetch(base + `/api/tickets/${ticket.id}/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken: 'token-de-outro-lugar' }),
      });
      assert.strictEqual(res.status, 403);
    });
  });
});

describe('multi-unidade', () => {
  let server;
  let base;

  before(async () => {
    server = await startServer({ RATE_LIMIT_SIGNUP: '100' });
    base = server.base;
  });

  after(() => stopServer(server));

  async function criarUnidade(nome) {
    const res = await fetch(base + '/api/venues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nome }),
    });
    return { status: res.status, body: await res.json() };
  }

  test('cadastro self-service cria unidade com slug e senha propria', async () => {
    const { status, body } = await criarUnidade('Clinica Sao Jose');
    assert.strictEqual(status, 201);
    assert.strictEqual(body.venue.slug, 'clinica-sao-jose');
    assert.ok(body.operatorPassword && body.operatorPassword.length >= 6);
    assert.ok(body.joinUrl.includes('venue=clinica-sao-jose'));
    assert.ok(body.venue.qrToken);
  });

  test('nome muito curto e recusado', async () => {
    const { status } = await criarUnidade('ab');
    assert.strictEqual(status, 400);
  });

  test('nomes iguais geram slugs distintos', async () => {
    const primeira = await criarUnidade('Laboratorio Central');
    const segunda = await criarUnidade('Laboratorio Central');
    assert.strictEqual(primeira.body.venue.slug, 'laboratorio-central');
    assert.strictEqual(segunda.body.venue.slug, 'laboratorio-central-2');
  });

  test('QR da unidade responde como PNG', async () => {
    const { body } = await criarUnidade('Otica Vision');
    const res = await fetch(base + body.qrUrl);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'image/png');
    const bytes = Buffer.from(await res.arrayBuffer());
    assert.ok(bytes.length > 100, 'PNG veio vazio');
    assert.strictEqual(bytes.subarray(1, 4).toString(), 'PNG');
  });

  test('unidade inexistente responde 404', async () => {
    const res = await fetch(base + '/api/venues/nao-existe/state');
    assert.strictEqual(res.status, 404);
  });

  test('filas de unidades diferentes nao se misturam', async () => {
    const a = (await criarUnidade('Clinica Alfa')).body;
    const b = (await criarUnidade('Clinica Beta')).body;

    await fetch(base + `/api/venues/${a.venue.slug}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    });

    const estadoA = await (await fetch(base + `/api/venues/${a.venue.slug}/state`)).json();
    const estadoB = await (await fetch(base + `/api/venues/${b.venue.slug}/state`)).json();
    assert.strictEqual(estadoA.kpis.waiting, 1);
    assert.strictEqual(estadoB.kpis.waiting, 0, 'ticket vazou para a outra unidade');
  });

  test('sessao de uma unidade nao comanda a fila de outra', async () => {
    const a = (await criarUnidade('Clinica Gama')).body;
    const b = (await criarUnidade('Clinica Delta')).body;

    const loginA = await fetch(base + `/api/venues/${a.venue.slug}/operator/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: a.operatorPassword }),
    });
    const { token } = await loginA.json();

    await fetch(base + `/api/venues/${b.venue.slug}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bruno' }),
    });

    const invasao = await fetch(base + `/api/venues/${b.venue.slug}/tickets/call-next`, {
      method: 'POST',
      headers: authed(token),
    });
    assert.strictEqual(invasao.status, 401, 'token de uma unidade comandou outra');
  });

  test('senha de uma unidade nao serve para outra', async () => {
    const a = (await criarUnidade('Clinica Epsilon')).body;
    const b = (await criarUnidade('Clinica Zeta')).body;
    const res = await fetch(base + `/api/venues/${b.venue.slug}/operator/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: a.operatorPassword }),
    });
    assert.strictEqual(res.status, 401);
  });

  test('rotas legadas continuam servindo a unidade padrao', async () => {
    const res = await fetch(base + '/api/state');
    const state = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(state.venueMeta.slug, 'centro');
  });
});

describe('limites do plano free', () => {
  let server;
  let base;

  before(async () => {
    server = await startServer({ RATE_LIMIT_SIGNUP: '100', FREE_DAILY_TICKETS: '2', FREE_COUNTERS: '1' });
    base = server.base;
  });

  after(() => stopServer(server));

  async function novaUnidade(nome) {
    const res = await fetch(base + '/api/venues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nome }),
    });
    return res.json();
  }

  function entrar(slug, nome) {
    return fetch(base + `/api/venues/${slug}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nome }),
    });
  }

  test('bloqueia a entrada apos o limite diario com 402', async () => {
    const venue = await novaUnidade('Clinica Limite');
    assert.strictEqual((await entrar(venue.venue.slug, 'Um')).status, 201);
    assert.strictEqual((await entrar(venue.venue.slug, 'Dois')).status, 201);

    const terceira = await entrar(venue.venue.slug, 'Tres');
    const body = await terceira.json();
    assert.strictEqual(terceira.status, 402);
    assert.match(body.error, /plano gratuito/i);
  });

  test('plano free expoe apenas um balcao', async () => {
    const venue = await novaUnidade('Clinica Balcao');
    const state = await (await fetch(base + `/api/venues/${venue.venue.slug}/state`)).json();
    assert.strictEqual(state.counters.length, 1);
    assert.strictEqual(state.monetization.limits.counters, 1);
  });

  test('segunda chamada simultanea esbarra no limite de balcoes', async () => {
    const venue = await novaUnidade('Clinica Dois Balcoes');
    const slug = venue.venue.slug;
    await entrar(slug, 'Ana');
    await entrar(slug, 'Bia');

    const login = await fetch(base + `/api/venues/${slug}/operator/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: venue.operatorPassword }),
    });
    const { token } = await login.json();

    const primeira = await fetch(base + `/api/venues/${slug}/tickets/call-next`, {
      method: 'POST', headers: authed(token),
    });
    const segunda = await fetch(base + `/api/venues/${slug}/tickets/call-next`, {
      method: 'POST', headers: authed(token),
    });
    assert.strictEqual(primeira.status, 200);
    assert.strictEqual(segunda.status, 409, 'plano free deixou abrir um segundo balcao');
  });
});

describe('jornada completa da unidade nova', () => {
  let server;
  let base;

  before(async () => {
    server = await startServer({ RATE_LIMIT_SIGNUP: '100' });
    base = server.base;
  });

  after(() => stopServer(server));

  test('do cadastro ao atendimento concluido', async () => {
    // 1. o dono cria a unidade e recebe QR + senha
    const signup = await (await fetch(base + '/api/venues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Clinica Jornada', operatorName: 'Recepcao' }),
    })).json();
    const slug = signup.venue.slug;
    assert.ok(signup.operatorPassword);

    // 2. o QR do balcao aponta para a fila da unidade
    assert.ok(signup.joinUrl.includes(`venue=${slug}`));
    assert.ok(signup.joinUrl.includes(`token=${signup.venue.qrToken}`));

    // 3. o cliente escaneia e entra na fila
    const entrada = await (await fetch(base + `/api/venues/${slug}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Pedro', qrToken: signup.venue.qrToken }),
    })).json();
    assert.strictEqual(entrada.ticket.code, 'M-001', 'numeracao deve comecar do zero na unidade nova');
    assert.strictEqual(entrada.ticket.position, 1);

    // 4. o operador entra no painel com a senha recebida
    const login = await (await fetch(base + `/api/venues/${slug}/operator/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: signup.operatorPassword }),
    })).json();
    assert.ok(login.token);

    // 5. chama o proximo
    const chamada = await (await fetch(base + `/api/venues/${slug}/tickets/call-next`, {
      method: 'POST', headers: authed(login.token),
    })).json();
    assert.strictEqual(chamada.ticket.status, 'calling');
    assert.strictEqual(chamada.ticket.counter, 1);

    // 6. o cliente ve a propria chamada
    const acompanhando = await (await fetch(base + `/api/venues/${slug}/tickets/${entrada.ticket.id}`)).json();
    assert.strictEqual(acompanhando.ticket.status, 'calling');

    // 7. conclui o atendimento
    const fim = await fetch(base + `/api/venues/${slug}/tickets/${entrada.ticket.id}/finish`, {
      method: 'POST', headers: authed(login.token),
    });
    assert.strictEqual(fim.status, 200);

    const estadoFinal = await (await fetch(base + `/api/venues/${slug}/state`)).json();
    assert.strictEqual(estadoFinal.kpis.servedToday, 1);
    assert.strictEqual(estadoFinal.kpis.waiting, 0);
  });
});

describe('rate limit', () => {
  let server;

  before(async () => {
    server = await startServer({ RATE_LIMIT_TICKETS: '3' });
  });

  after(() => stopServer(server));

  test('bloqueia com 429 depois do limite de entradas na fila', async () => {
    const status = [];
    for (let i = 0; i < 5; i++) {
      const res = await fetch(server.base + '/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Teste' + i }),
      });
      status.push(res.status);
    }
    assert.ok(status.filter(s => s === 201).length <= 3, 'passou mais requisicoes que o limite');
    assert.ok(status.includes(429), 'nunca respondeu 429: ' + status.join(','));
  });
});

describe('expurgo LGPD', () => {
  let server;

  before(async () => {
    // Retencao zero: tickets encerrados somem ja no boot.
    server = await startServer({ TICKET_RETENTION_HOURS: '0' });
  });

  after(() => stopServer(server));

  test('remove tickets encerrados no boot', async () => {
    const res = await fetch(server.base + '/api/state');
    const state = await res.json();
    const encerrados = state.tickets.filter(t => t.status === 'served' || t.status === 'absent');
    assert.strictEqual(encerrados.length, 0, 'sobraram tickets encerrados apos o expurgo');
  });
});

describe('modo producao', () => {
  let server;

  before(async () => {
    server = await startServer({ NODE_ENV: 'production', SEED_DEMO: 'false', CORS_ORIGIN: 'https://exemplo.com' });
  });

  after(() => stopServer(server));

  test('fila inicia vazia, sem dados de demonstracao', async () => {
    const res = await fetch(server.base + '/api/state');
    const state = await res.json();
    assert.strictEqual(state.tickets.length, 0);
    assert.strictEqual(state.kpis.waiting, 0);
  });

  test('bloqueia origem nao autorizada no CORS', async () => {
    const res = await fetch(server.base + '/api/state', { headers: { Origin: 'https://site-malicioso.com' } });
    assert.strictEqual(res.status, 500, 'origem estranha deveria ser barrada pelo CORS');
  });

  test('permite a origem configurada', async () => {
    const res = await fetch(server.base + '/api/state', { headers: { Origin: 'https://exemplo.com' } });
    assert.strictEqual(res.status, 200);
  });
});
