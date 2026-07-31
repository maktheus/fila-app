// Mercado Pago — cobranca Pix e verificacao de webhook.
//
// Usamos a Orders API (POST /v1/orders), que e o caminho que a documentacao
// atual do Checkout Transparente indica. A /v1/payments classica continua
// existindo, mas nova integracao entra pela Orders.
//
// Duas coisas aqui merecem atencao antes de mexer:
//
// 1. O valor NUNCA vem de fora deste servidor. Quem chama passa a unidade,
//    nao o preco. Um chatbot que aceita valor por parametro e um chatbot que
//    alguem convence a cobrar R$ 1,00 — ou a cobrar R$ 9.999,00 de um cliente.
//
// 2. A assinatura do webhook do MP NAO e HMAC sobre o corpo cru, que e o
//    esquema generico do billing.js. O MP manda `x-signature: ts=...,v1=...`
//    e espera que voce remonte um manifesto com o id do recurso, o
//    x-request-id e o ts, e assine ISSO. Conferir do jeito errado recusa
//    todo webhook legitimo — e a assinatura do cliente nunca ativa.

const crypto = require('crypto');

const API = process.env.MP_API_BASE || 'https://api.mercadopago.com';
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
const WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || '';
const TIMEOUT_MS = Number(process.env.MP_TIMEOUT_MS || 15000);
// Faixa aceita pelo MP: 30 minutos a 30 dias.
const EXPIRA_MINUTOS = Number(process.env.MP_PIX_EXPIRA_MINUTOS || 60 * 24);

function configurado() {
  return !!ACCESS_TOKEN;
}

function reais(centavos) {
  return (Number(centavos) / 100).toFixed(2);
}

async function chamar(caminho, { metodo = 'GET', corpo, idempotencia } = {}) {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TIMEOUT_MS);

  const cabecalhos = {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    Accept: 'application/json',
  };
  if (corpo) cabecalhos['Content-Type'] = 'application/json';
  if (idempotencia) cabecalhos['X-Idempotency-Key'] = idempotencia;

  let resposta;
  try {
    resposta = await fetch(`${API}${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: controle.signal,
    });
  } catch (erro) {
    if (erro.name === 'AbortError') throw new Error('Mercado Pago nao respondeu a tempo.');
    throw new Error(`Falha ao falar com o Mercado Pago: ${erro.message}`);
  } finally {
    clearTimeout(relogio);
  }

  const texto = await resposta.text();
  let dados = {};
  try { dados = texto ? JSON.parse(texto) : {}; } catch (e) { /* corpo nao-JSON */ }

  if (!resposta.ok) {
    // A mensagem do MP pode citar o e-mail do pagador; cortamos o detalhe
    // para nao vazar dado pessoal em log de erro.
    const motivo = dados.message || dados.error || `HTTP ${resposta.status}`;
    const erro = new Error(`Mercado Pago recusou (${resposta.status}): ${String(motivo).slice(0, 120)}`);
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}

// A chave de idempotencia precisa ser estavel para a mesma intencao de
// cobranca: se a pessoa clicar duas vezes, ou o nosso retry disparar, o MP
// devolve a MESMA cobranca em vez de criar duas.
function chaveDeIdempotencia(referencia, competencia) {
  return crypto.createHash('sha256')
    .update(`${referencia}|${competencia}`)
    .digest('hex')
    .slice(0, 40);
}

/**
 * Cria uma cobranca Pix avulsa. O valor vem de quem chama do lado do
 * servidor (billing.PRICE_CENTS), nunca de entrada do usuario.
 */
async function criarCobrancaPix({ referencia, valorCentavos, email, descricao, competencia }) {
  if (!configurado()) throw new Error('MP_ACCESS_TOKEN nao configurado.');
  if (!referencia) throw new Error('Cobranca sem referencia da unidade.');
  if (!Number.isFinite(valorCentavos) || valorCentavos <= 0) {
    throw new Error('Valor de cobranca invalido.');
  }
  if (!email) throw new Error('Mercado Pago exige o e-mail do pagador.');

  const valor = reais(valorCentavos);
  const dados = await chamar('/v1/orders', {
    metodo: 'POST',
    idempotencia: chaveDeIdempotencia(referencia, competencia || new Date().toISOString().slice(0, 7)),
    corpo: {
      type: 'online',
      processing_mode: 'automatic',
      total_amount: valor,
      external_reference: referencia,
      description: descricao || 'Fila Virtual — plano premium',
      payer: { email },
      transactions: {
        payments: [{
          amount: valor,
          payment_method: { id: 'pix', type: 'bank_transfer' },
          expiration_time: `PT${EXPIRA_MINUTOS}M`,
        }],
      },
    },
  });

  const pagamento = ((dados.transactions || {}).payments || [])[0] || {};
  const meio = pagamento.payment_method || {};
  if (!meio.qr_code) {
    throw new Error('Mercado Pago nao devolveu o codigo Pix.');
  }

  return {
    externalId: String(dados.id || ''),
    pagamentoId: String(pagamento.id || ''),
    copiaECola: meio.qr_code,
    qrBase64: meio.qr_code_base64 || null,
    ticketUrl: meio.ticket_url || null,
    valorCentavos,
    expiraEm: Date.now() + EXPIRA_MINUTOS * 60000,
    status: dados.status || 'action_required',
  };
}

/**
 * Cobranca no cartao. O token vem do cliente — do Google Pay ou da
 * tokenizacao do proprio MP — e NUNCA o numero do cartao. Dado de cartao nao
 * passa por este servidor em momento nenhum, e e o que nos mantem fora do
 * escopo pesado de PCI DSS.
 *
 * O valor continua saindo daqui. O `totalPrice` que o Google Pay mostra na
 * bandeja e so exibicao: quem cobra e este request.
 */
async function criarCobrancaCartao({ referencia, valorCentavos, email, descricao, token, bandeira, parcelas, competencia }) {
  if (!configurado()) throw new Error('MP_ACCESS_TOKEN nao configurado.');
  if (!referencia) throw new Error('Cobranca sem referencia da unidade.');
  if (!Number.isFinite(valorCentavos) || valorCentavos <= 0) {
    throw new Error('Valor de cobranca invalido.');
  }
  if (!email) throw new Error('Mercado Pago exige o e-mail do pagador.');
  if (!token) throw new Error('Cobranca no cartao sem token.');

  const valor = reais(valorCentavos);
  const dados = await chamar('/v1/orders', {
    metodo: 'POST',
    idempotencia: chaveDeIdempotencia(`${referencia}|cartao`, competencia || new Date().toISOString().slice(0, 7)),
    corpo: {
      type: 'online',
      processing_mode: 'automatic',
      total_amount: valor,
      external_reference: referencia,
      description: descricao || 'Fila Virtual — plano premium',
      payer: { email },
      transactions: {
        payments: [{
          amount: valor,
          payment_method: {
            // A bandeira vem do que o Google Pay devolve; sem ela o MP ainda
            // resolve pelo token na maioria dos casos.
            id: bandeira || 'master',
            type: 'credit_card',
            token,
            installments: Number(parcelas) || 1,
          },
        }],
      },
    },
  });

  const pagamento = ((dados.transactions || {}).payments || [])[0] || {};
  return {
    externalId: String(dados.id || ''),
    pagamentoId: String(pagamento.id || ''),
    valorCentavos,
    status: pagamento.status || dados.status || 'unknown',
    statusDetalhe: pagamento.status_detail || dados.status_detail || '',
    aprovado: traduzirStatus(pagamento.status || dados.status, pagamento.status_detail) === 'payment.confirmed',
  };
}

// A bandeira que o Google Pay devolve ("VISA", "MASTERCARD") nao e o
// identificador que o MP usa ("visa", "master").
const BANDEIRAS = {
  VISA: 'visa',
  MASTERCARD: 'master',
  AMEX: 'amex',
  ELO: 'elo',
  HIPERCARD: 'hipercard',
  DISCOVER: 'discover',
};

function bandeiraDoGoogle(rede) {
  return BANDEIRAS[String(rede || '').toUpperCase()] || null;
}

async function consultarOrder(id) {
  return chamar(`/v1/orders/${encodeURIComponent(id)}`);
}

async function consultarPagamento(id) {
  return chamar(`/v1/payments/${encodeURIComponent(id)}`);
}

// --------------- Webhook ---------------

function partesDaAssinatura(cabecalho) {
  const partes = { ts: '', v1: '' };
  for (const pedaco of String(cabecalho || '').split(',')) {
    const [chave, valor] = pedaco.split('=');
    if (!chave || !valor) continue;
    const nome = chave.trim();
    if (nome === 'ts' || nome === 'v1') partes[nome] = valor.trim();
  }
  return partes;
}

/**
 * Confere o `x-signature` do Mercado Pago.
 *
 * Manifesto: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * assinado em HMAC-SHA256 com o segredo do webhook do app.
 * Partes ausentes saem do manifesto — o MP omite o segmento inteiro quando
 * o valor nao existe.
 */
function verificarAssinatura({ assinatura, requestId, dataId }) {
  if (!WEBHOOK_SECRET) return { ok: false, motivo: 'MP_WEBHOOK_SECRET nao configurado' };

  const { ts, v1 } = partesDaAssinatura(assinatura);
  if (!ts || !v1) return { ok: false, motivo: 'cabecalho x-signature malformado' };

  const manifesto =
    (dataId ? `id:${String(dataId).toLowerCase()};` : '') +
    (requestId ? `request-id:${requestId};` : '') +
    `ts:${ts};`;

  const esperado = crypto.createHmac('sha256', WEBHOOK_SECRET).update(manifesto).digest('hex');
  const a = Buffer.from(esperado, 'utf8');
  const b = Buffer.from(String(v1), 'utf8');
  if (a.length !== b.length) return { ok: false, motivo: 'assinatura nao confere' };
  if (!crypto.timingSafeEqual(a, b)) return { ok: false, motivo: 'assinatura nao confere' };

  return { ok: true, ts: Number(ts) };
}

// Status do MP -> evento interno que o billing.applyEvent entende.
const APROVADO = new Set(['approved', 'accredited', 'processed']);
const RECUSADO = new Set(['rejected', 'cancelled', 'refunded', 'charged_back']);

function traduzirStatus(status, statusDetail) {
  const s = String(status || '').toLowerCase();
  const d = String(statusDetail || '').toLowerCase();
  if (APROVADO.has(s) || APROVADO.has(d)) return 'payment.confirmed';
  if (RECUSADO.has(s) || RECUSADO.has(d)) return 'payment.failed';
  return null; // pendente: nao mexe na assinatura
}

module.exports = {
  nome: 'mercadopago',
  configurado,
  criarCobrancaPix,
  criarCobrancaCartao,
  bandeiraDoGoogle,
  consultarOrder,
  consultarPagamento,
  verificarAssinatura,
  traduzirStatus,
  partesDaAssinatura,
  chaveDeIdempotencia,
  EXPIRA_MINUTOS,
};
