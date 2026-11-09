// Ciclo por resultado, de ponta a ponta contra o servidor de verdade.
//
// Os testes de billing.test cobrem a regra; este cobre a fiacao: o que o
// servidor faz com o relogio, com os atendimentos e com o webhook. O relogio
// e adiantado pela rota /api/ciclo/rodar (so fora de producao).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { portaLivre } = require('./porta');

const SERVER = path.join(__dirname, '..', 'server.js');
const PASSWORD = 'senha-de-teste';
const DIA = 86400000;
const SLUG = 'centro';

async function subir() {
  const port = await portaLivre();
  const dataFile = path.join(os.tmpdir(), `fila-resultado-${port}-${Date.now()}.json`);
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
      PAYMENT_PROVIDER: 'sandbox',
      PAYMENT_WEBHOOK_SECRET: '',
      RATE_LIMIT_TICKETS: '500',
      RATE_LIMIT_LOGIN: '500',
      RATE_LIMIT_COBRANCA: '500',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const base = `http://127.0.0.1:${port}`;
  const limite = Date.now() + 15000;
  while (Date.now() < limite) {
    try {
      const r = await fetch(base + '/api/health');
      if (r.ok) return { child, base, dataFile };
    } catch (e) { /* ainda subindo */ }
    await new Promise(r => setTimeout(r, 150));
  }
  child.kill();
  throw new Error('Servidor de teste nao respondeu em 15s');
}

// Procura a unidade no arquivo persistido, sem depender do formato exato.
function acharUnidade(obj, slug) {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.slug === slug && obj.subscription) return obj;
  for (const v of Object.values(obj)) {
    const achou = acharUnidade(v, slug);
    if (achou) return achou;
  }
  return null;
}

describe('ciclo por resultado, ponta a ponta', () => {
  let srv;
  let token;
  let fim1;

  const json = (r) => r.json();
  const post = (p, body, auth) => fetch(srv.base + p, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  const config = async () => (await json(await fetch(srv.base + `/api/venues/${SLUG}/config`))).monetization.subscription;
  const dados = () => acharUnidade(JSON.parse(fs.readFileSync(srv.dataFile, 'utf8')), SLUG);

  before(async () => {
    srv = await subir();
    const login = await json(await post('/api/operator/login', { password: PASSWORD }));
    token = login.token;
    // Unidade de contato: sem e-mail, o ciclo nao gera Pix (nem envia nada).
    await post(`/api/venues/${SLUG}/cobranca`, { email: 'dono@clinica.test', ciclo: 'mensal' }, true);
    // Primeiro pagamento: entra no modelo por resultado, com o minimo adiantado.
    await post('/api/webhooks/payments', { id: 'evt-cadastro', type: 'payment.confirmed', reference: SLUG, subscriptionId: 'sub-1' });
    fim1 = (await config()).currentPeriodEnd;
  });

  after(() => { if (srv) { srv.child.kill(); try { fs.unlinkSync(srv.dataFile); } catch (e) { /* ok */ } } });

  test('o cadastro entra por resultado, mensal, com o minimo adiantado', async () => {
    const s = await config();
    assert.strictEqual(s.status, 'active');
    assert.strictEqual(s.modelo, 'resultado');
    assert.strictEqual(s.resultado.minimoLabel, 'R$ 29,00');
    assert.ok(fim1 > Date.now() + 25 * DIA, 'a primeira janela deve durar cerca de um mes');
    assert.strictEqual(dados().subscription.pagoAntecipado, 2900);
  });

  test('atendimentos concluidos entram na base da fatura', async () => {
    for (let i = 0; i < 3; i++) {
      const t = await json(await post(`/api/venues/${SLUG}/tickets`, { name: 'Ana' }));
      const id = t.ticket.id;
      await post(`/api/venues/${SLUG}/tickets/${id}/call`, {}, true);
      await post(`/api/venues/${SLUG}/tickets/${id}/finish`, {}, true);
    }
    const s = await config();
    assert.strictEqual(s.resultado.usoNoPeriodo, 3);
    assert.strictEqual(dados().subscription.atendimentos.length, 3);
  });

  test('aviso previo nao gera Pix fixo: o valor depende do uso', async () => {
    const r = await json(await post('/api/ciclo/rodar', { em: fim1 - 2 * DIA }, true));
    assert.ok(r.aplicadas.some(a => a.venue === SLUG && a.tipo === 'previo'));
    assert.strictEqual(dados().subscription.cobrancaDoCiclo, null);
  });

  test('vencimento com o uso coberto pelo adiantamento avanca a janela sem cobrar', async () => {
    // 3 atendimentos = R$ 0,36, abaixo do minimo: a fatura e R$ 29, ja pagos.
    const r = await json(await post('/api/ciclo/rodar', { em: fim1 - 0.5 * DIA }, true));
    assert.ok(r.aplicadas.some(a => a.venue === SLUG && a.tipo === 'vencimento'));
    const s = dados().subscription;
    assert.strictEqual(s.cobrancaDoCiclo, null, 'nao deve haver Pix quando o adiantamento cobre a fatura');
    assert.strictEqual(s.faturadoAte, fim1);
    assert.strictEqual(s.currentPeriodStart, fim1);
    assert.strictEqual(s.pagoAntecipado, 0);
  });

  test('o vencimento seguinte gera Pix pela fatura do uso da nova janela', async () => {
    const fim2 = (await config()).currentPeriodEnd;
    const r = await json(await post('/api/ciclo/rodar', { em: fim2 - 0.5 * DIA }, true));
    assert.ok(r.aplicadas.some(a => a.venue === SLUG && a.tipo === 'vencimento'));
    const c = dados().subscription.cobrancaDoCiclo;
    assert.ok(c, 'deve existir cobranca da fatura');
    assert.strictEqual(c.valorCentavos, 2900, 'sem uso na janela, a fatura e o minimo');
    assert.strictEqual(c.fimFaturado, fim2);
    assert.ok(c.copiaECola, 'o Pix precisa do codigo copia e cola');
  });

  test('pagar a fatura abre a janela seguinte e marca o uso como quitado', async () => {
    const antes = dados().subscription;
    const fim2 = antes.cobrancaDoCiclo.fimFaturado;
    await post('/api/webhooks/payments', { id: 'evt-fatura-2', type: 'payment.confirmed', reference: SLUG, subscriptionId: 'sub-1' });
    const depois = dados().subscription;
    assert.strictEqual(depois.faturadoAte, fim2);
    assert.strictEqual(depois.currentPeriodStart, fim2);
    assert.strictEqual(depois.cobrancaDoCiclo, null);
    assert.ok(depois.currentPeriodEnd > fim2 + 25 * DIA);
    assert.strictEqual(depois.status, 'active');
  });

  test('o endpoint de fatura nao aceita valor vindo da requisicao', async () => {
    const r = await post(`/api/venues/${SLUG}/cobranca`, { ciclo: 'mensal', valorCentavos: 1, amount: 1 }, true);
    const body = await json(r);
    assert.ok(body.valorCentavos === undefined || body.valorCentavos === 2900, JSON.stringify(body));
  });
});
