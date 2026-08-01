// Assinatura por unidade: trial, checkout e webhook de pagamento.
// O provedor real (Cakto, Mercado Pago) entra por env; sem credenciais o
// modulo opera em modo sandbox, que permite testar o fluxo inteiro local.
const crypto = require('crypto');
const mercadopago = require('./payments/mercadopago');
const sandbox = require('./payments/sandbox');

const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 14);
const PRICE_CENTS = Number(process.env.PLAN_PRICE_CENTS || 9900);
// Anual sai por dez meses: sem cartao guardado, cada renovacao mensal e uma
// chance de perder o cliente por esquecimento. Pagar uma vez elimina onze
// dessas chances, e o desconto e o que compra isso.
const PRICE_YEAR_CENTS = Number(process.env.PLAN_PRICE_YEAR_CENTS || PRICE_CENTS * 10);
// Dias que a unidade continua premium depois de vencer sem pagar. Curto o
// bastante para nao virar servico de graca, longo o bastante para cobrir quem
// viu o e-mail no fim de semana.
const GRACE_DAYS = Number(process.env.BILLING_GRACE_DAYS || 3);
// Quantos dias antes do vencimento a cobranca do proximo ciclo e emitida.
const AVISO_PREVIO_DIAS = Number(process.env.BILLING_NOTICE_DAYS || 3);

const CICLOS = {
  mensal: { meses: 1, centavos: PRICE_CENTS },
  anual: { meses: 12, centavos: PRICE_YEAR_CENTS },
};

function cicloValido(nome) {
  return Object.prototype.hasOwnProperty.call(CICLOS, String(nome)) ? String(nome) : 'mensal';
}

function precoDoCiclo(nome) {
  return CICLOS[cicloValido(nome)].centavos;
}

function rotuloDeReais(centavos) {
  return 'R$ ' + (centavos / 100).toFixed(2).replace('.', ',');
}

// Soma meses respeitando fim de mes: 31/01 + 1 mes vira 28/02, nao 03/03.
// Sem isto, quem assina dia 31 e cobrado um dia antes em metade dos meses.
function somarMeses(base, meses) {
  const d = new Date(base);
  const diaOriginal = d.getDate();
  d.setMonth(d.getMonth() + meses);
  if (d.getDate() < diaOriginal) d.setDate(0);
  return d.getTime();
}
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

// Fim da tolerancia: ate aqui a unidade continua premium mesmo vencida.
function fimDaTolerancia(sub) {
  if (!sub.currentPeriodEnd) return null;
  return sub.currentPeriodEnd + GRACE_DAYS * 86400000;
}

// O plano efetivo considera o relogio: trial vencido vira free sozinho,
// assinatura vencida idem. Chamado antes de qualquer decisao de limite.
//
// A tolerancia entra aqui de proposito, e nao no job de ciclo: mesmo que o
// job nao rode (servidor reiniciado, container parado), o calculo continua
// certo. Estado derivado do relogio nao depende de nada ter rodado na hora.
function effectivePlan(venue) {
  const sub = ensureSubscription(venue);
  const now = Date.now();
  if (sub.status === 'trialing') {
    return sub.trialEndsAt && sub.trialEndsAt > now ? 'premium' : 'free';
  }
  if (sub.status === 'active' || sub.status === 'past_due') {
    if (!sub.currentPeriodEnd) return 'premium';
    return fimDaTolerancia(sub) > now ? 'premium' : 'free';
  }
  // Cancelada segue premium ate o fim do ciclo ja pago — o cliente pagou por
  // ele. Cobrar e cortar antes seria ficar com dinheiro sem entregar.
  if (sub.status === 'canceled') {
    return sub.currentPeriodEnd && sub.currentPeriodEnd > now ? 'premium' : 'free';
  }
  return 'free';
}

// --------------- Ciclo de cobranca ---------------
//
// O que deve acontecer com esta assinatura AGORA, dado o relogio.
//
// Funcao pura de proposito: o calendario inteiro de um ano da para testar em
// milissegundos, sem esperar um mes passar e sem simular temporizador. O job
// que roda de hora em hora so aplica o que esta funcao decide.
//
// Cada acao acontece uma vez por ciclo. O controle e a marca em `avisos`,
// comparada com o inicio do ciclo atual — assim reiniciar o servidor nao
// reenvia nada, e renovar limpa tudo naturalmente.
function acaoDoCiclo(venue, agora = Date.now()) {
  const sub = ensureSubscription(venue);
  if (sub.status !== 'active' && sub.status !== 'past_due') return null;
  if (!sub.currentPeriodEnd) return null;

  const avisos = sub.avisos || {};
  const fim = sub.currentPeriodEnd;
  const tolerancia = fimDaTolerancia(sub);
  const jaFeito = (chave) => avisos[chave] && avisos[chave] > (sub.currentPeriodStart || 0);

  // Vencido alem da tolerancia: cai para o gratuito.
  if (agora >= tolerancia) {
    return jaFeito('rebaixado') ? null : { tipo: 'rebaixar', chave: 'rebaixado' };
  }

  // Vencido, dentro da tolerancia: ultimo aviso antes de cair.
  if (agora >= fim) {
    return jaFeito('atraso')
      ? null
      : { tipo: 'atraso', chave: 'atraso', diasParaCair: Math.ceil((tolerancia - agora) / 86400000) };
  }

  // Dia do vencimento.
  if (agora >= fim - 86400000) {
    return jaFeito('vencimento') ? null : { tipo: 'vencimento', chave: 'vencimento' };
  }

  // Aviso previo: e aqui que a cobranca do proximo ciclo e emitida, para o
  // cliente ja receber o Pix junto com o aviso em vez de ter que ir procurar.
  if (agora >= fim - AVISO_PREVIO_DIAS * 86400000) {
    return jaFeito('previo')
      ? null
      : { tipo: 'previo', chave: 'previo', diasRestantes: Math.ceil((fim - agora) / 86400000) };
  }

  return null;
}

function marcarAviso(venue, chave, agora = Date.now()) {
  const sub = ensureSubscription(venue);
  if (!sub.avisos) sub.avisos = {};
  sub.avisos[chave] = agora;
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
    priceLabel: rotuloDeReais(PRICE_CENTS),
    interval: sub.interval || 'mensal',
    currentPeriodStart: sub.currentPeriodStart || null,
    graceDays: GRACE_DAYS,
    ciclos: {
      mensal: { centavos: PRICE_CENTS, label: rotuloDeReais(PRICE_CENTS), meses: 1 },
      anual: {
        centavos: PRICE_YEAR_CENTS,
        label: rotuloDeReais(PRICE_YEAR_CENTS),
        meses: 12,
        economiaLabel: rotuloDeReais(PRICE_CENTS * 12 - PRICE_YEAR_CENTS),
      },
    },
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

// O cliente escolhe o CICLO; o servidor decide o PRECO.
//
// A diferenca importa: aceitar "anual" de fora e seguro porque o nome e
// validado contra uma tabela fechada e o valor sai dela. Aceitar um valor de
// fora nunca e seguro, e continua nao acontecendo em lugar nenhum.
async function criarCobrancaPix({ venue, email, ciclo, competencia }) {
  const destino = String(email || venue.contactEmail || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino)) {
    throw new Error('E-mail invalido para a cobranca.');
  }

  const adaptador = PROVIDER === 'mercadopago' ? mercadopago : sandbox;
  if (!adaptador.configurado()) {
    throw new Error('Provedor de pagamento nao configurado.');
  }

  const nome = cicloValido(ciclo);
  const centavos = precoDoCiclo(nome);

  const cobranca = await adaptador.criarCobrancaPix({
    referencia: venue.slug,
    valorCentavos: centavos,
    email: destino,
    descricao: `Fila Virtual premium ${nome} — ${venue.name || venue.slug}`,
    competencia: competencia || new Date().toISOString().slice(0, 7),
  });

  return {
    ...cobranca,
    ciclo: nome,
    provider: adaptador.nome,
    valorLabel: rotuloDeReais(centavos),
  };
}

// Cobranca no cartao a partir de um token de carteira (Google Pay) ou da
// tokenizacao do proprio provedor.
//
// O `totalPrice` que a bandeja do Google Pay mostra e exibicao do lado do
// cliente. Quem cobra e este servidor, com PRICE_CENTS. Se alguem editar o
// valor no navegador, a bandeja mostra outro numero e a cobranca sai igual.
async function criarCobrancaCartao({ venue, email, token, bandeira, parcelas, ciclo, competencia }) {
  const destino = String(email || venue.contactEmail || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino)) {
    throw new Error('E-mail invalido para a cobranca.');
  }
  if (!token) throw new Error('Cobranca no cartao sem token.');

  const adaptador = PROVIDER === 'mercadopago' ? mercadopago : sandbox;
  if (!adaptador.configurado()) {
    throw new Error('Provedor de pagamento nao configurado.');
  }

  const nome = cicloValido(ciclo);
  const centavos = precoDoCiclo(nome);

  const cobranca = await adaptador.criarCobrancaCartao({
    referencia: venue.slug,
    valorCentavos: centavos,
    email: destino,
    descricao: `Fila Virtual premium — ${venue.name || venue.slug}`,
    token,
    bandeira,
    parcelas,
    competencia: competencia || new Date().toISOString().slice(0, 7),
  });

  return {
    ...cobranca,
    ciclo: nome,
    provider: adaptador.nome,
    valorLabel: rotuloDeReais(centavos),
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
    const renovacao = sub.status === 'active' || sub.status === 'past_due';
    const ciclo = cicloValido(event.ciclo || sub.interval || 'mensal');
    const agora = Date.now();

    // Quem paga adiantado nao pode perder os dias que faltavam. O ciclo novo
    // comeca onde o antigo terminava, e so cai para "agora" se ja passou.
    const inicio = sub.currentPeriodEnd && sub.currentPeriodEnd > agora
      ? sub.currentPeriodEnd
      : agora;

    sub.status = 'active';
    sub.interval = ciclo;
    sub.currentPeriodStart = inicio;
    sub.currentPeriodEnd = Number(event.currentPeriodEnd) || somarMeses(inicio, CICLOS[ciclo].meses);
    // Ciclo novo, avisos zerados: a cobranca do proximo so sai no fim dele.
    sub.avisos = {};
    sub.cobrancaDoCiclo = null;

    return {
      plan: 'premium',
      email: renovacao ? 'subscription_renewed' : 'premium_started',
      ciclo,
    };
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
  PRICE_YEAR_CENTS,
  GRACE_DAYS,
  AVISO_PREVIO_DIAS,
  CICLOS,
  cicloValido,
  precoDoCiclo,
  rotuloDeReais,
  somarMeses,
  fimDaTolerancia,
  acaoDoCiclo,
  marcarAviso,
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
