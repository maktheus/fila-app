// Assinatura por unidade: trial, checkout e webhook de pagamento.
// O provedor real (Cakto, Mercado Pago) entra por env; sem credenciais o
// modulo opera em modo sandbox, que permite testar o fluxo inteiro local.
const crypto = require('crypto');

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
  signPayload,
  alreadyProcessed,
  applyEvent,
};
