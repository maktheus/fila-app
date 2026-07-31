// Assinatura por unidade: trial, checkout e webhook de pagamento.
// O provedor real (Cakto, Mercado Pago) entra por env; sem credenciais o
// modulo opera em modo sandbox, que permite testar o fluxo inteiro local.
const crypto = require('crypto');
const mercadopago = require('./payments/mercadopago');
const sandbox = require('./payments/sandbox');

const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 14);
const PRICE_CENTS = Number(process.env.PLAN_PRICE_CENTS || 9900);
const PROVIDER = process.env.PAYMENT_PROVIDER || 'sandbox';
const CHECKOUT_BASE_URL = process.env.CHECKOUT_BASE_URL || '';
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || '';

// Eventos ja processados, para o provedor poder reenviar sem duplicar efeito.
const processedEvents = new Map(); // eventId -> processedAt
const EVENT_TTL_MS = 24 * 3600 * 1000;

function startTrial(venue) {
  venue.subscription = {
    status: 'trialing',
    trialEndsAt: Date.now() + TRIAL_DAYS * 86400000,
    currentPeriodEnd: null,
    externalId: null,
    lastEventAt: null,
  };
  return venue.subscription;
}

function ensureSubscription(venue) {
  if (!venue.subscription) startTrial(venue);
  return venue.subscription;
}

// O plano efetivo considera o relogio: trial vencido vira free sozinho,
// assinatura vencida idem. Chamado antes de qualquer decisao de limite.
function effectivePlan(venue) {
  const sub = ensureSubscription(venue);
  const now = Date.now();
  if (sub.status === 'trialing') {
    return sub.trialEndsAt && sub.trialEndsAt > now ? 'premium' : 'free';
  }
  if (sub.status === 'active') {
    return !sub.currentPeriodEnd || sub.currentPeriodEnd > now ? 'premium' : 'free';
  }
  return 'free';
}

function trialDaysLeft(venue) {
  const sub = ensureSubscription(venue);
  if (sub.status !== 'trialing' || !sub.trialEndsAt) return 0;
  return Math.max(0, Math.ceil((sub.trialEndsAt - Date.now()) / 86400000));
}

function subscriptionView(venue) {
  const sub = ensureSubscription(venue);
  return {
    status: sub.status,
    plan: effectivePlan(venue),
    trialEndsAt: sub.trialEndsAt || null,
    trialDaysLeft: trialDaysLeft(venue),
    currentPeriodEnd: sub.currentPeriodEnd || null,
    priceCents: PRICE_CENTS,
    priceLabel: 'R$ ' + (PRICE_CENTS / 100).toFixed(2).replace('.', ','),
    provider: PROVIDER,
  };
}

// URL de checkout. Em sandbox devolvemos uma pagina local que simula o
// pagamento, para o fluxo ser testavel de ponta a ponta sem conta no provedor.
function checkoutUrl(venue, appUrl) {
  const reference = venue.slug;
  if (PROVIDER !== 'sandbox' && CHECKOUT_BASE_URL) {
    const url = new URL(CHECKOUT_BASE_URL);
    url.searchParams.set('reference', reference);
    url.searchParams.set('amount', String(PRICE_CENTS));
    return { url: url.toString(), sandbox: false };
  }
  return {
    url: `${appUrl}/checkout-sandbox.html?venue=${encodeURIComponent(reference)}`,
    sandbox: true,
  };
}

function signPayload(rawBody) {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
}

// Assinatura HMAC do provedor. Sem segredo configurado so aceitamos webhook
// fora de producao — em producao, webhook sem assinatura e recusado.
function verifySignature(rawBody, signature, isProduction) {
  if (!WEBHOOK_SECRET) return !isProduction;
  if (!signature) return false;
  const expected = signPayload(rawBody);
  const received = String(signature).replace(/^sha256=/, '');
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// O Mercado Pago nao assina o corpo cru: ele manda `x-signature: ts=..,v1=..`
// e espera um manifesto remontado a partir do id do recurso, do x-request-id
// e do ts. Conferir com o esquema generico acima recusaria todo webhook
// legitimo — e a assinatura paga do cliente nunca ativaria o premium.
function verifyWebhook({ rawBody, headers, query, isProduction }) {
  if (PROVIDER === 'mercadopago') {
    const r = mercadopago.verificarAssinatura({
      assinatura: headers['x-signature'] || '',
      requestId: headers['x-request-id'] || '',
      dataId: (query && (query['data.id'] || query.id)) || '',
    });
    return r.ok;
  }
  const assinatura = headers['x-signature'] || headers['x-webhook-signature'] || '';
  return verifySignature(rawBody || '', assinatura, isProduction);
}

// --------------- Cobranca Pix ---------------

// O valor sai daqui, de PRICE_CENTS, e de lugar nenhum mais. Nenhuma rota,
// ferramenta de chat ou corpo de requisicao escolhe quanto se cobra.
async function criarCobrancaPix({ venue, email, competencia }) {
  const destino = String(email || venue.contactEmail || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino)) {
    throw new Error('E-mail invalido para a cobranca.');
  }

  const adaptador = PROVIDER === 'mercadopago' ? mercadopago : sandbox;
  if (!adaptador.configurado()) {
    throw new Error('Provedor de pagamento nao configurado.');
  }

  const cobranca = await adaptador.criarCobrancaPix({
    referencia: venue.slug,
    valorCentavos: PRICE_CENTS,
    email: destino,
    descricao: `Fila Virtual premium — ${venue.name || venue.slug}`,
    competencia: competencia || new Date().toISOString().slice(0, 7),
  });

  return {
    ...cobranca,
    provider: adaptador.nome,
    valorLabel: 'R$ ' + (PRICE_CENTS / 100).toFixed(2).replace('.', ','),
  };
}

// Cobranca no cartao a partir de um token de carteira (Google Pay) ou da
// tokenizacao do proprio provedor.
//
// O `totalPrice` que a bandeja do Google Pay mostra e exibicao do lado do
// cliente. Quem cobra e este servidor, com PRICE_CENTS. Se alguem editar o
// valor no navegador, a bandeja mostra outro numero e a cobranca sai igual.
async function criarCobrancaCartao({ venue, email, token, bandeira, parcelas, competencia }) {
  const destino = String(email || venue.contactEmail || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino)) {
    throw new Error('E-mail invalido para a cobranca.');
  }
  if (!token) throw new Error('Cobranca no cartao sem token.');

  const adaptador = PROVIDER === 'mercadopago' ? mercadopago : sandbox;
  if (!adaptador.configurado()) {
    throw new Error('Provedor de pagamento nao configurado.');
  }

  const cobranca = await adaptador.criarCobrancaCartao({
    referencia: venue.slug,
    valorCentavos: PRICE_CENTS,
    email: destino,
    descricao: `Fila Virtual premium — ${venue.name || venue.slug}`,
    token,
    bandeira,
    parcelas,
    competencia: competencia || new Date().toISOString().slice(0, 7),
  });

  return {
    ...cobranca,
    provider: adaptador.nome,
    valorLabel: 'R$ ' + (PRICE_CENTS / 100).toFixed(2).replace('.', ','),
  };
}

// Config publica do Google Pay. So o que a bandeja precisa — nunca segredo.
//
// O `gateway` e o `gatewayMerchantId` precisam ser confirmados com o suporte
// do Mercado Pago: sem o identificador certo, o token que o Google gera nao e
// decifravel por eles e a cobranca falha na hora. Por isso o botao so aparece
// quando isso esta configurado, em vez de aparecer e quebrar no clique.
function googlePayConfig() {
  const gateway = process.env.GPAY_GATEWAY || '';
  const gatewayMerchantId = process.env.GPAY_GATEWAY_MERCHANT_ID || '';
  return {
    disponivel: !!(gateway && gatewayMerchantId),
    ambiente: process.env.GPAY_ENVIRONMENT || 'TEST',
    merchantId: process.env.GPAY_MERCHANT_ID || '',
    merchantName: process.env.GPAY_MERCHANT_NAME || 'Fila Virtual',
    gateway,
    gatewayMerchantId,
    bandeiras: (process.env.GPAY_CARD_NETWORKS || 'MASTERCARD,VISA,AMEX,ELO')
      .split(',').map(s => s.trim()).filter(Boolean),
    precoCentavos: PRICE_CENTS,
    precoLabel: 'R$ ' + (PRICE_CENTS / 100).toFixed(2).replace('.', ','),
    moeda: 'BRL',
    pais: 'BR',
  };
}

function alreadyProcessed(eventId) {
  if (!eventId) return false;
  const now = Date.now();
  for (const [id, at] of processedEvents) {
    if (now - at > EVENT_TTL_MS) processedEvents.delete(id);
  }
  if (processedEvents.has(eventId)) return true;
  processedEvents.set(eventId, now);
  return false;
}

const PAID = new Set(['payment.confirmed', 'subscription.paid', 'subscription.renewed', 'invoice.paid']);
const FAILED = new Set(['payment.failed', 'subscription.past_due', 'invoice.failed']);
const CANCELED = new Set(['subscription.canceled', 'subscription.expired']);

// Traduz o evento do provedor para o estado da assinatura da unidade.
// Retorna o nome do e-mail transacional a disparar, ou null.
function applyEvent(venue, event) {
  const sub = ensureSubscription(venue);
  const type = String(event.type || '');
  sub.lastEventAt = Date.now();
  if (event.subscriptionId) sub.externalId = String(event.subscriptionId);

  if (PAID.has(type)) {
    const wasPremium = sub.status === 'active';
    sub.status = 'active';
    sub.currentPeriodEnd = Number(event.currentPeriodEnd) ||
      Date.now() + Number(process.env.BILLING_PERIOD_DAYS || 30) * 86400000;
    return { plan: 'premium', email: wasPremium ? 'subscription_renewed' : 'premium_started' };
  }
  if (FAILED.has(type)) {
    sub.status = 'past_due';
    return { plan: effectivePlan(venue), email: 'payment_failed' };
  }
  if (CANCELED.has(type)) {
    sub.status = 'canceled';
    sub.currentPeriodEnd = Number(event.currentPeriodEnd) || Date.now();
    return { plan: 'free', email: 'subscription_canceled' };
  }
  return null;
}

module.exports = {
  TRIAL_DAYS,
  PRICE_CENTS,
  PROVIDER,
  startTrial,
  ensureSubscription,
  effectivePlan,
  trialDaysLeft,
  subscriptionView,
  checkoutUrl,
  verifySignature,
  verifyWebhook,
  signPayload,
  alreadyProcessed,
  applyEvent,
  criarCobrancaPix,
  criarCobrancaCartao,
  googlePayConfig,
  mercadopago,
  sandbox,
};
