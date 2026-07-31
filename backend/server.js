const express = require('express');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const QRCode = require('qrcode');
const billing = require('./billing');
const notify = require('./notify');
const analytics = require('./analytics');

const app = express();
// Atras de nginx/Caddy: sem isto req.ip vira o IP do proxy e o rate limit
// passa a ser um balde unico compartilhado por todos os clientes.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const APP_VERSION = process.env.APP_VERSION || '0.1.0';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'store.json');
const USE_POSTGRES = !!process.env.DATABASE_URL;
const db = USE_POSTGRES ? require('./db') : null;
// Fila de demonstracao: ligada por padrao fora de producao, desligavel por env.
const SEED_DEMO = process.env.SEED_DEMO
  ? process.env.SEED_DEMO === 'true'
  : !IS_PRODUCTION;
// LGPD: nome do cliente e dado pessoal — tickets encerrados sao expurgados.
const TICKET_RETENTION_HOURS = Number(process.env.TICKET_RETENTION_HOURS || 12);
const PURGE_INTERVAL_MS = Number(process.env.PURGE_INTERVAL_MINUTES || 15) * 60000;
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_HOURS || 8) * 3600 * 1000;
// URL publica do app do cliente — e o que o QR code aponta.
const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || 'http://localhost').replace(/\/$/, '');
const DEFAULT_SLUG = process.env.VENUE_SLUG || 'centro';
const FREE_LIMITS = {
  dailyTickets: Number(process.env.FREE_DAILY_TICKETS || 50),
  counters: Number(process.env.FREE_COUNTERS || 1),
};

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin || (!IS_PRODUCTION && allowedOrigins.length === 0) || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    return cb(new Error('Origem nao permitida pelo CORS.'));
  },
}));
// rawBody fica guardado para conferir a assinatura HMAC do webhook.
app.use(express.json({
  limit: '32kb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); },
}));

// --------------- Store multi-unidade ---------------

/** @type {Map<string, object>} slug -> unidade com sua fila */
const venues = new Map();

function pad(n) { return String(n).padStart(2, '0'); }
function clockShort() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function today() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function slugify(text) {
  return String(text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function safeEquals(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function createVenue(input) {
  const venue = {
    slug: input.slug,
    name: input.name,
    operatorName: input.operatorName || 'Equipe balcão',
    contactEmail: input.contactEmail || '',
    subscription: input.subscription || null,
    trialWarned: false,
    trialEndedNotified: false,
    qrToken: input.qrToken || crypto.randomBytes(9).toString('base64url'),
    passwordHash: input.passwordHash || '',
    latitude: Number.isFinite(input.latitude) ? input.latitude : null,
    longitude: Number.isFinite(input.longitude) ? input.longitude : null,
    proximityRadiusMeters: input.proximityRadiusMeters || 120,
    countersTotal: input.countersTotal || 3,
    plan: input.plan === 'premium' ? 'premium' : 'free',
    adsEnabled: input.adsEnabled !== false,
    servedToday: 0,
    lastCalled: 0,
    nextId: 1,
    dailyCount: 0,
    dailyDate: today(),
    createdAt: Date.now(),
    tickets: [],
    log: [],
  };
  if (!venue.subscription) billing.startTrial(venue);
  venue.plan = billing.effectivePlan(venue);
  venues.set(venue.slug, venue);
  return venue;
}

// Unidade padrao: configurada por env, e a que responde as rotas legadas.
function seedDefaultVenue() {
  const password = process.env.OPERATOR_PASSWORD || process.env.ADMIN_TOKEN || '';
  const venue = createVenue({
    slug: DEFAULT_SLUG,
    name: process.env.VENUE_NAME || 'Unidade Centro',
    operatorName: process.env.OPERATOR_NAME || 'Equipe balcão',
    qrToken: process.env.VENUE_QR_TOKEN || 'demo-centro',
    passwordHash: password ? hashPassword(password) : '',
    latitude: Number(process.env.VENUE_LAT || -3.119028),
    longitude: Number(process.env.VENUE_LNG || -60.021731),
    proximityRadiusMeters: Number(process.env.PROXIMITY_RADIUS_METERS || 120),
    adsEnabled: process.env.ADS_ENABLED === 'false' ? false : process.env.PLAN !== 'premium',
    // PLAN=premium no ambiente vira assinatura ativa sem vencimento.
    subscription: process.env.PLAN === 'premium'
      ? { status: 'active', trialEndsAt: null, currentPeriodEnd: null, externalId: null, lastEventAt: null }
      : null,
  });
  if (SEED_DEMO) {
    venue.tickets = seedTickets();
    venue.servedToday = 47;
    venue.lastCalled = 42;
    venue.nextId = 52;
  }
  return venue;
}

// Fila de demonstracao: so fora de producao e apenas com primeiro nome (LGPD).
function seedTickets() {
  const min = 60000;
  const now = Date.now();
  return [
    { id: 38, code: 'M-038', name: 'Helena', status: 'served', counter: 1, waitMin: 0, source: 'qr', createdAt: now, closedAt: now },
    { id: 39, code: 'M-039', name: 'Bruno', status: 'served', counter: 2, waitMin: 0, source: 'senha', createdAt: now, closedAt: now },
    { id: 40, code: 'M-040', name: 'Sofia', status: 'served', counter: 1, waitMin: 0, source: 'qr', createdAt: now, closedAt: now },
    { id: 41, code: 'M-041', name: 'Marcos', status: 'absent', counter: null, waitMin: 0, source: 'qr', createdAt: now, closedAt: now },
    { id: 42, code: 'M-042', name: 'Cliente', status: 'calling', counter: 3, waitMin: 0, source: 'qr', createdAt: now },
    { id: 43, code: 'M-043', name: 'Carlos', status: 'waiting', counter: null, waitMin: 14, source: 'qr', createdAt: now - 14 * min },
    { id: 44, code: 'M-044', name: 'Júlia', status: 'waiting', counter: null, waitMin: 12, source: 'passou', createdAt: now - 12 * min },
    { id: 45, code: 'M-045', name: 'Pedro', status: 'waiting', counter: null, waitMin: 10, source: 'senha', createdAt: now - 10 * min },
    { id: 46, code: 'M-046', name: 'Mariana', status: 'waiting', counter: null, waitMin: 9, source: 'qr', createdAt: now - 9 * min },
    { id: 47, code: 'M-047', name: 'Rafael', status: 'waiting', counter: null, waitMin: 7, source: 'qr', createdAt: now - 7 * min },
    { id: 48, code: 'M-048', name: 'Beatriz', status: 'waiting', counter: null, waitMin: 5, source: 'senha', createdAt: now - 5 * min },
    { id: 49, code: 'M-049', name: 'Tiago', status: 'waiting', counter: null, waitMin: 4, source: 'qr', createdAt: now - 4 * min },
    { id: 50, code: 'M-050', name: 'Larissa', status: 'waiting', counter: null, waitMin: 2, source: 'passou', createdAt: now - 2 * min },
    { id: 51, code: 'M-051', name: 'Diego', status: 'waiting', counter: null, waitMin: 1, source: 'qr', createdAt: now - min },
  ];
}

// --------------- Rate limit ---------------

function createRateLimit(windowMs, maxHits) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || 'local';
    const bucket = (hits.get(key) || []).filter(ts => now - ts < windowMs);
    bucket.push(now);
    hits.set(key, bucket);
    if (bucket.length > maxHits) return res.status(429).json({ error: 'Muitas tentativas. Aguarde um pouco.' });
    next();
  };
}

const publicTicketLimiter = createRateLimit(60 * 1000, Number(process.env.RATE_LIMIT_TICKETS || 20));
const loginLimiter = createRateLimit(15 * 60 * 1000, Number(process.env.RATE_LIMIT_LOGIN || 8));
const signupLimiter = createRateLimit(60 * 60 * 1000, Number(process.env.RATE_LIMIT_SIGNUP || 5));

// --------------- Sessao do operador (por unidade) ---------------

const sessions = new Map(); // token -> { expiresAt, slug }

function createSession(slug) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(token, { expiresAt, slug });
  return { token, expiresAt };
}

function sessionFor(token) {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function purgeExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

function bearerToken(req) {
  const auth = req.get('authorization') || '';
  return auth.replace(/^Bearer\s+/i, '') || req.get('x-admin-token') || '';
}

// Um token so comanda a unidade em que fez login. O ADMIN_TOKEN continua
// valendo como credencial de automacao, em qualquer unidade.
function isOperatorOf(token, slug) {
  if (!token) return false;
  if (process.env.ADMIN_TOKEN && safeEquals(token, process.env.ADMIN_TOKEN)) return true;
  const session = sessionFor(token);
  return !!session && session.slug === slug;
}

function requireOperator(req, res, next) {
  const slug = req.venue.slug;
  if (isOperatorOf(bearerToken(req), slug)) return next();
  // Dev sem senha configurada: libera para nao travar o desenvolvimento local.
  if (!IS_PRODUCTION && !req.venue.passwordHash && !process.env.ADMIN_TOKEN) return next();
  return res.status(401).json({ error: 'Operador nao autenticado.' });
}

// --------------- Helpers de fila ---------------

function planLimits(venue) {
  return billing.effectivePlan(venue) === 'premium'
    ? { dailyTickets: null, counters: null }
    : { dailyTickets: FREE_LIMITS.dailyTickets, counters: FREE_LIMITS.counters };
}

function availableCounters(venue) {
  const limit = planLimits(venue).counters;
  return limit ? Math.min(venue.countersTotal, limit) : venue.countersTotal;
}

function freeCounter(venue) {
  const used = venue.tickets.filter(t => t.status === 'calling').map(t => t.counter);
  for (let n = 1; n <= availableCounters(venue); n++) {
    if (!used.includes(n)) return n;
  }
  return null;
}

function pushLog(venue, text) {
  const entry = { t: clockShort(), text, ts: Date.now() };
  venue.log = [entry, ...venue.log].slice(0, 20);
  return entry;
}

function updateWaitTimes(venue) {
  const now = Date.now();
  venue.tickets.forEach(t => {
    if (t.status === 'waiting') t.waitMin = Math.round((now - t.createdAt) / 60000);
  });
}

// Avisa o dono antes do trial acabar e quando ele acaba — cada aviso uma vez.
function checkTrials() {
  for (const venue of venues.values()) {
    const sub = billing.ensureSubscription(venue);
    if (sub.status !== 'trialing') continue;
    const daysLeft = billing.trialDaysLeft(venue);
    const view = billing.subscriptionView(venue);

    if (daysLeft === 0 && !venue.trialEndedNotified) {
      venue.trialEndedNotified = true;
      venue.plan = 'free';
      notify.track('trial_ended', { venue: venue.slug });
      notify.sendEmail('trial_ended', venue, { priceLabel: view.priceLabel });
      broadcast(venue, { action: 'trial-ended' });
    } else if (daysLeft > 0 && daysLeft <= Number(process.env.TRIAL_WARN_DAYS || 3) && !venue.trialWarned) {
      venue.trialWarned = true;
      notify.track('trial_ending', { venue: venue.slug, daysLeft });
      notify.sendEmail('trial_ending', venue, { trialDaysLeft: daysLeft, priceLabel: view.priceLabel });
    }
  }
}

// LGPD: expurga tickets encerrados depois da janela de retencao. Mantem o
// contador do dia, que e agregado e nao identifica ninguem.
function purgeOldTickets() {
  const cutoff = Date.now() - TICKET_RETENTION_HOURS * 3600 * 1000;
  let removed = 0;
  for (const venue of venues.values()) {
    const before = venue.tickets.length;
    venue.tickets = venue.tickets.filter(t => {
      const closed = t.status === 'served' || t.status === 'absent';
      if (!closed) return true;
      return (t.closedAt || t.createdAt || 0) > cutoff;
    });
    removed += before - venue.tickets.length;
  }
  if (removed > 0) {
    console.log(`LGPD: ${removed} ticket(s) encerrado(s) expurgado(s) apos ${TICKET_RETENTION_HOURS}h.`);
    for (const venue of venues.values()) broadcast(venue, { action: 'purged' });
  }
  return removed;
}

function entitlement(venue) {
  const plan = billing.effectivePlan(venue);
  const premium = plan === 'premium';
  return {
    plan,
    adsEnabled: !premium && venue.adsEnabled,
    premiumRemovesAds: true,
    limits: planLimits(venue),
    usage: { ticketsToday: venue.dailyDate === today() ? venue.dailyCount : 0 },
    subscription: billing.subscriptionView(venue),
  };
}

function joinUrl(venue) {
  return `${PUBLIC_APP_URL}/?venue=${encodeURIComponent(venue.slug)}&token=${encodeURIComponent(venue.qrToken)}`;
}

function publicConfig(venue) {
  return {
    venue: {
      name: venue.name,
      slug: venue.slug,
      qrToken: venue.qrToken,
      proximityRadiusMeters: venue.proximityRadiusMeters,
      hasCoordinates: Number.isFinite(venue.latitude) && Number.isFinite(venue.longitude),
    },
    monetization: entitlement(venue),
  };
}

function sanitizeName(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)[0]
    .replace(/[^\p{L}\p{N}'-]/gu, '')
    .slice(0, 28);
}

function ticketView(venue, ticket) {
  if (!ticket) return null;
  const waiting = venue.tickets.filter(t => t.status === 'waiting');
  const waitingIndex = waiting.findIndex(t => t.id === ticket.id);
  return {
    id: ticket.id,
    code: ticket.code,
    name: ticket.name,
    status: ticket.status,
    counter: ticket.counter,
    waitMin: ticket.waitMin,
    source: ticket.source,
    venue: venue.slug,
    lastPresenceAt: ticket.lastPresenceAt || null,
    position: waitingIndex >= 0 ? waitingIndex + 1 : 0,
    ahead: waitingIndex >= 0 ? waitingIndex : 0,
    etaMin: waitingIndex >= 0 ? Math.max(2, waitingIndex * 4 + 3) : 0,
  };
}

function toRad(value) { return value * Math.PI / 180; }

function distanceMeters(aLat, aLng, bLat, bLng) {
  const earth = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const a = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
  return Math.round(earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function checkProximity(venue, body) {
  if (body.qrToken && body.qrToken === venue.qrToken) {
    return { ok: true, method: 'qr', distanceMeters: 0 };
  }
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const hasVenueCoords = Number.isFinite(venue.latitude) && Number.isFinite(venue.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !hasVenueCoords) {
    return { ok: false, method: 'unknown', distanceMeters: null };
  }
  const distance = distanceMeters(latitude, longitude, venue.latitude, venue.longitude);
  return { ok: distance <= venue.proximityRadiusMeters, method: 'gps', distanceMeters: distance };
}

// Devolve null quando o ticket ja esta no fim da fila e nao ha para quem passar.
function moveTicketBack(venue, ticket, steps) {
  const waiting = venue.tickets.filter(t => t.status === 'waiting');
  const currentPos = waiting.findIndex(t => t.id === ticket.id);
  if (currentPos < 0) return null;
  const targetPos = Math.min(waiting.length - 1, currentPos + steps);
  if (targetPos === currentPos) return null;

  const target = waiting[targetPos];
  const fromIndex = venue.tickets.findIndex(t => t.id === ticket.id);
  venue.tickets.splice(fromIndex, 1);
  const targetIndex = venue.tickets.findIndex(t => t.id === target.id);
  venue.tickets.splice(targetIndex + 1, 0, ticket);
  ticket.source = 'passou';
  ticket.passedAt = Date.now();
  ticket.lastPresenceAt = Date.now();
  return ticketView(venue, ticket);
}

// LGPD: o nome so vai para quem esta autenticado como operador. Telao e app do
// cliente trabalham com codigo/posicao, nao precisam saber quem e quem.
function buildState(venue, withNames = false) {
  updateWaitTimes(venue);
  const waiting = venue.tickets.filter(t => t.status === 'waiting');
  const calling = venue.tickets.filter(t => t.status === 'calling');
  const absent = venue.tickets.filter(t => t.status === 'absent');
  const avg = waiting.length ? Math.round(waiting.reduce((a, t) => a + t.waitMin, 0) / waiting.length) : 0;

  const counters = [];
  for (let n = 1; n <= availableCounters(venue); n++) {
    const t = calling.find(x => x.counter === n);
    counters.push({
      id: n,
      name: 'Balcão ' + n,
      busy: !!t,
      ticketCode: t ? t.code : null,
      ticketId: t ? t.id : null,
    });
  }

  const hero = calling.find(t => t.id === venue.lastCalled) || calling[calling.length - 1] || null;

  return {
    venue: venue.name,
    operator: venue.operatorName,
    kpis: {
      waiting: waiting.length,
      calling: calling.length,
      avgWait: avg,
      servedToday: venue.servedToday,
      absent: absent.length,
    },
    tickets: venue.tickets.map(t => ({
      id: t.id,
      code: t.code,
      name: withNames ? t.name : null,
      status: t.status,
      counter: t.counter,
      waitMin: t.waitMin,
      source: t.source,
      createdAt: t.createdAt,
      lastPresenceAt: t.lastPresenceAt || null,
    })),
    venueMeta: {
      slug: venue.slug,
      proximityRadiusMeters: venue.proximityRadiusMeters,
    },
    monetization: entitlement(venue),
    hero: hero ? { id: hero.id, code: hero.code, name: withNames ? hero.name : null, counter: hero.counter } : null,
    counters,
    log: venue.log.slice(0, 7),
    lastCalled: venue.lastCalled,
  };
}

// --------------- Persistencia ---------------

function snapshot() {
  return { venues: [...venues.values()] };
}

function applyVenues(list) {
  if (!Array.isArray(list) || list.length === 0) return false;
  venues.clear();
  for (const v of list) venues.set(v.slug, v);
  return true;
}

async function loadPersistedStore() {
  if (USE_POSTGRES) {
    await db.ensureSchema();
    if (!applyVenues(await db.loadVenues())) seedDefaultVenue();
    return;
  }
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (applyVenues(data.venues)) return;
    }
  } catch (error) {
    console.warn('Nao foi possivel carregar persistencia local:', error.message);
  }
  seedDefaultVenue();
}

function persistStore() {
  if (USE_POSTGRES) {
    db.saveVenues([...venues.values()]).catch(error => {
      console.warn('Nao foi possivel salvar no Postgres:', error.message);
    });
    return;
  }
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify({ ...snapshot(), savedAt: new Date().toISOString() }, null, 2));
  } catch (error) {
    console.warn('Nao foi possivel salvar persistencia local:', error.message);
  }
}

// --------------- WebSocket ---------------

const clients = new Set();

wss.on('connection', (ws, req) => {
  let slug = DEFAULT_SLUG;
  let token = '';
  try {
    const params = new URL(req.url, 'http://localhost').searchParams;
    slug = params.get('venue') || DEFAULT_SLUG;
    token = params.get('token') || '';
  } catch (e) { /* url malformada: cai na unidade padrao */ }

  const venue = venues.get(slug);
  if (!venue) {
    ws.send(JSON.stringify({ type: 'error', error: 'Unidade nao encontrada.' }));
    ws.close();
    return;
  }

  ws.venueSlug = slug;
  ws.isOperator = isOperatorOf(token, slug);
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'state', data: buildState(venue, ws.isOperator) }));
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

function broadcast(venue, event) {
  persistStore();
  let publicMsg = null;
  let operatorMsg = null;
  for (const ws of clients) {
    if (ws.readyState !== 1 || ws.venueSlug !== venue.slug) continue;
    if (ws.isOperator) {
      operatorMsg = operatorMsg || JSON.stringify({ type: 'state', data: buildState(venue, true), event });
      ws.send(operatorMsg);
    } else {
      publicMsg = publicMsg || JSON.stringify({ type: 'state', data: buildState(venue, false), event });
      ws.send(publicMsg);
    }
  }
}

// --------------- Rotas globais ---------------

// Health de verdade: se o Postgres nao responde, o endpoint falha. Um health
// que responde ok com o banco fora nao serve para monitorar nada.
app.get('/api/health', async (_req, res) => {
  const base = {
    status: 'ok',
    uptime: process.uptime(),
    version: APP_VERSION,
    venues: venues.size,
    websocketClients: clients.size,
    storage: USE_POSTGRES ? 'postgres' : 'file',
  };

  if (!USE_POSTGRES) return res.json(base);

  try {
    base.dbLatencyMs = await db.ping();
    res.json(base);
  } catch (error) {
    res.status(503).json({ ...base, status: 'degraded', error: 'Banco de dados indisponivel.' });
  }
});

// Cadastro self-service: cria a unidade e devolve a senha do operador uma
// unica vez (guardamos apenas o hash).
app.post('/api/venues', signupLimiter, (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim().slice(0, 80);
  if (name.length < 3) {
    return res.status(400).json({ error: 'Informe o nome do estabelecimento (minimo 3 letras).' });
  }

  const base = slugify(name) || 'unidade';
  let slug = base;
  let suffix = 2;
  while (venues.has(slug)) slug = `${base}-${suffix++}`;

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const operatorPassword = crypto.randomBytes(6).toString('base64url');

  const venue = createVenue({
    slug,
    name,
    operatorName: String(body.operatorName || 'Equipe balcão').trim().slice(0, 40),
    passwordHash: hashPassword(operatorPassword),
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    proximityRadiusMeters: Number(body.proximityRadiusMeters) || 120,
  });

  venue.contactEmail = String(body.contactEmail || '').trim().slice(0, 120);
  pushLog(venue, 'Unidade criada');
  notify.track('venue_created', { venue: venue.slug });
  notify.sendEmail('venue_created', venue, { trialDays: billing.TRIAL_DAYS });
  persistStore();

  res.status(201).json({
    venue: publicConfig(venue).venue,
    operatorPassword,
    joinUrl: joinUrl(venue),
    qrUrl: `/api/venues/${venue.slug}/qr.png`,
    operatorUrl: `/operador.html?venue=${venue.slug}`,
    telaoUrl: `/telao.html?venue=${venue.slug}`,
    subscription: billing.subscriptionView(venue),
    message: 'Unidade criada. Guarde a senha do operador — ela nao sera mostrada de novo.',
  });
});

// --------------- Pagamentos ---------------

const cobrancaLimiter = createRateLimit(60 * 60 * 1000, Number(process.env.RATE_LIMIT_COBRANCA || 10));

// Gera o Pix da assinatura de uma unidade.
//
// Repare no que NAO existe aqui: nenhum campo de valor. O preco sai de
// billing.PRICE_CENTS e nada no corpo da requisicao muda isso. E a diferenca
// entre um chatbot que fecha venda e um chatbot que alguem convence a vender
// por R$ 1,00.
app.post('/api/venues/:slug/cobranca', cobrancaLimiter, async (req, res) => {
  const venue = venues.get(String(req.params.slug || ''));
  if (!venue) return res.status(404).json({ error: 'Unidade nao encontrada.' });

  const email = String((req.body || {}).email || '').trim().slice(0, 120);
  try {
    const cobranca = await billing.criarCobrancaPix({ venue, email });

    // Guardamos so o que precisamos para reconciliar o webhook depois.
    venue.pendingCharge = {
      externalId: cobranca.externalId,
      valorCentavos: cobranca.valorCentavos,
      criadaEm: Date.now(),
      expiraEm: cobranca.expiraEm,
    };
    if (email) venue.contactEmail = email;
    persistStore();

    notify.track('cobranca_gerada', { venue: venue.slug });
    res.json({
      externalId: cobranca.externalId,
      copiaECola: cobranca.copiaECola,
      qrBase64: cobranca.qrBase64,
      ticketUrl: cobranca.ticketUrl,
      valorLabel: cobranca.valorLabel,
      expiraEm: cobranca.expiraEm,
      provider: cobranca.provider,
      sandbox: cobranca.provider === 'sandbox',
    });
  } catch (error) {
    console.warn('[cobranca] falhou:', error.message);
    res.status(502).json({ error: error.message });
  }
});

// Confirma uma cobranca de mentira. So existe fora de producao e so com o
// provedor sandbox — e o que permite testar a jornada inteira sem conta em
// banco. Em producao quem confirma e o webhook do provedor.
app.post('/api/cobrancas/:id/confirmar-sandbox', (req, res) => {
  if (IS_PRODUCTION || billing.PROVIDER !== 'sandbox') {
    return res.status(404).json({ error: 'Indisponivel.' });
  }
  const cobranca = billing.sandbox.buscar(req.params.id);
  if (!cobranca) return res.status(404).json({ error: 'Cobranca nao encontrada.' });

  const venue = venues.get(cobranca.referencia);
  if (!venue) return res.status(404).json({ error: 'Unidade nao encontrada.' });

  const result = billing.applyEvent(venue, {
    type: 'payment.confirmed',
    id: cobranca.externalId,
  });
  venue.plan = result.plan;
  venue.pendingCharge = null;
  billing.sandbox.esquecer(cobranca.externalId);
  pushLog(venue, 'Assinatura: pagamento confirmado (sandbox)');
  notify.track(result.email, { venue: venue.slug });
  broadcast(venue, { action: 'subscription', status: venue.subscription.status });
  persistStore();

  res.json({ ok: true, plan: venue.plan, status: venue.subscription.status });
});

// Webhook do Mercado Pago. O corpo so traz o id do recurso: quem manda no
// estado da assinatura e o que a API do MP responde quando perguntamos, nao o
// que chegou pela rede. Um corpo forjado nao vira premium.
app.post('/api/webhooks/mercadopago', async (req, res) => {
  const ok = billing.verifyWebhook({
    rawBody: req.rawBody,
    headers: { 'x-signature': req.get('x-signature') || '', 'x-request-id': req.get('x-request-id') || '' },
    query: req.query,
    isProduction: IS_PRODUCTION,
  });
  if (!ok) return res.status(401).json({ error: 'Assinatura invalida.' });

  const corpo = req.body || {};
  const tipo = String(corpo.type || corpo.topic || '');
  const id = String((corpo.data && corpo.data.id) || req.query['data.id'] || '');
  if (!id) return res.json({ ok: true, ignored: 'sem id' });

  // O MP reenvia o mesmo evento ate receber 200. Idempotencia por recurso.
  if (billing.alreadyProcessed(`mp:${tipo}:${id}`)) {
    return res.json({ ok: true, duplicated: true });
  }

  try {
    const recurso = tipo.startsWith('order')
      ? await billing.mercadopago.consultarOrder(id)
      : await billing.mercadopago.consultarPagamento(id);

    const slug = String(recurso.external_reference || '');
    const venue = venues.get(slug);
    if (!venue) return res.json({ ok: true, ignored: 'unidade desconhecida' });

    const evento = billing.mercadopago.traduzirStatus(recurso.status, recurso.status_detail);
    if (!evento) return res.json({ ok: true, pending: recurso.status });

    const result = billing.applyEvent(venue, { type: evento, id, subscriptionId: id });
    if (!result) return res.json({ ok: true, ignored: evento });

    venue.plan = result.plan;
    if (evento === 'payment.confirmed') venue.pendingCharge = null;
    pushLog(venue, `Assinatura: ${evento}`);
    notify.track(result.email, { venue: venue.slug });
    notify.sendEmail(result.email, venue, { priceLabel: billing.subscriptionView(venue).priceLabel });
    broadcast(venue, { action: 'subscription', status: venue.subscription.status });
    persistStore();

    res.json({ ok: true, plan: venue.plan, status: venue.subscription.status });
  } catch (error) {
    console.warn('[webhook mp] falhou:', error.message);
    // 500 faz o MP reenviar — melhor que engolir um pagamento confirmado.
    res.status(500).json({ error: 'Nao consegui consultar o recurso.' });
  }
});

// Webhook generico (Cakto e afins). Aqui a unidade vem no corpo do evento.
app.post('/api/webhooks/payments', (req, res) => {
  const signature = req.get('x-signature') || req.get('x-webhook-signature') || '';
  if (!billing.verifySignature(req.rawBody || '', signature, IS_PRODUCTION)) {
    return res.status(401).json({ error: 'Assinatura invalida.' });
  }

  const event = req.body || {};
  const slug = String(event.reference || event.venue || '');
  const venue = venues.get(slug);
  if (!venue) return res.status(404).json({ error: 'Unidade nao encontrada.' });

  // O provedor reenvia eventos: processar duas vezes nao pode dobrar o efeito.
  if (billing.alreadyProcessed(event.id)) {
    return res.json({ ok: true, duplicated: true });
  }

  const result = billing.applyEvent(venue, event);
  if (!result) return res.json({ ok: true, ignored: event.type });

  venue.plan = result.plan;
  pushLog(venue, `Assinatura: ${event.type}`);
  notify.track(result.email, { venue: venue.slug });
  notify.sendEmail(result.email, venue, { priceLabel: billing.subscriptionView(venue).priceLabel });
  broadcast(venue, { action: 'subscription', status: venue.subscription.status });
  persistStore();

  res.json({ ok: true, plan: venue.plan, status: venue.subscription.status });
});

// --------------- Chatbot de vendas ---------------

const chatAgent = require('./chat/agent');
const chatTools = require('./chat/tools');
const chatLimiter = createRateLimit(60 * 1000, Number(process.env.RATE_LIMIT_CHAT || 12));

function fatosDoPlano() {
  const venue = venues.get(DEFAULT_SLUG);
  const assinatura = billing.subscriptionView(venue);
  return {
    precoMensal: billing.PRICE_CENTS / 100,
    precoLabel: assinatura.priceLabel,
    diasDeTeste: billing.TRIAL_DAYS,
    limiteDiario: FREE_LIMITS.dailyTickets,
    balcoes: FREE_LIMITS.counters,
  };
}

// Estado dos provedores — o laboratório usa para dizer o que está no ar.
app.get('/api/chat/provedores', async (_req, res) => {
  const local = await chatAgent.verificarLocal();
  res.json({
    padrao: chatAgent.PROVEDOR,
    local,
    claude: { configurado: chatAgent.configurado('claude') },
  });
});

// Mesma execução do chat, mas devolvendo o que aconteceu por dentro:
// trechos recuperados, chamadas de ferramenta e veredito dos guardrails.
// Estado da conversa que o cliente devolve a cada mensagem. Hoje guarda so a
// unidade criada nela — e de onde sai a cobranca, em vez de sair do que o
// modelo conseguiu transcrever. Vem do cliente, entao passa por normalizacao.
function contextoDaSessao(sessao) {
  const unidade = chatTools.normalizarSlug((sessao || {}).unidade);
  return chatTools.slugValido(unidade) ? { unidade } : {};
}

app.post('/api/chat/debug', chatLimiter, requireAnalyticsAuth, async (req, res) => {
  const body = req.body || {};
  const contexto = contextoDaSessao(body.sessao);
  try {
    const resultado = await chatAgent.responder({
      mensagem: body.message,
      historico: Array.isArray(body.history) ? body.history.slice(-20) : [],
      fatos: fatosDoPlano(),
      provedor: body.provider,
      contexto,
    });
    // O codigo Pix vai por fora do texto do modelo: ele nao transcreve
    // string opaca sem corromper. A interface desenha o bloco de pagamento.
    const { pagamento, ...sessao } = contexto;
    res.json({ resposta: resultado.resposta, diagnostico: resultado.diagnostico, sessao, pagamento });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.post('/api/chat', chatLimiter, async (req, res) => {
  const body = req.body || {};
  const historico = Array.isArray(body.history) ? body.history.slice(-20) : [];
  const contexto = contextoDaSessao(body.sessao);

  try {
    const resultado = await chatAgent.responder({
      mensagem: body.message,
      historico,
      fatos: fatosDoPlano(),
      provedor: body.provider,
      contexto,
    });

    notify.track('chat:resposta', {
      motivo: resultado.recusado ? 'recusado'
        : resultado.bloqueado ? 'bloqueado'
        : resultado.foraDeEscopo ? 'fora-de-escopo'
        : 'ok',
    });
    if (resultado.ferramentas.length) {
      notify.track('chat:ferramenta', { alvo: resultado.ferramentas.join(',') });
    }
    if (resultado.bloqueado) {
      console.warn('[chat] guardrail barrou a resposta:', resultado.bloqueado.join('; '));
    }

    const { pagamento, ...sessao } = contexto;
    res.json({ resposta: resultado.resposta, ferramentas: resultado.ferramentas, sessao, pagamento });
  } catch (error) {
    console.warn('[chat] falha:', error.message);
    notify.track('chat:erro');
    res.status(503).json({
      error: 'O assistente está indisponível agora. Você pode criar sua fila em /cadastro.html.',
    });
  }
});

// --------------- Comportamento (analytics) ---------------

// Sem Postgres os eventos ficam em memoria, so para o dev conseguir ver o
// funil rodando local.
const eventosMemoria = [];
const eventsLimiter = createRateLimit(60 * 1000, Number(process.env.RATE_LIMIT_EVENTS || 120));

app.post('/api/events', eventsLimiter, (req, res) => {
  const eventos = analytics.normalizar(req.body);
  if (!eventos.length) return res.status(204).end();

  if (USE_POSTGRES) {
    db.insertEvents(eventos).catch(error => {
      console.warn('Nao foi possivel gravar eventos:', error.message);
    });
  } else {
    eventosMemoria.push(...eventos);
    if (eventosMemoria.length > 5000) eventosMemoria.splice(0, eventosMemoria.length - 5000);
  }
  // Telemetria responde rapido e sem corpo: o front nao espera por isso.
  res.status(204).end();
});

function requireAnalyticsAuth(req, res, next) {
  if (isOperatorOf(bearerToken(req), DEFAULT_SLUG)) return next();
  if (!IS_PRODUCTION && !venues.get(DEFAULT_SLUG).passwordHash && !process.env.ADMIN_TOKEN) return next();
  return res.status(401).json({ error: 'Operador nao autenticado.' });
}

function contagensEmMemoria(desde) {
  const porChave = new Map();
  for (const evento of eventosMemoria) {
    if (evento.at < desde) continue;
    const chave = evento.name + ' ' + evento.surface;
    if (!porChave.has(chave)) porChave.set(chave, new Set());
    porChave.get(chave).add(evento.session);
  }
  return [...porChave.entries()].map(([chave, sessoes]) => {
    const [name, surface] = chave.split(' ');
    return { name, surface, sessoes: sessoes.size };
  });
}

// Funil com a queda entre etapas — e onde se enxerga o problema.
app.get('/api/analytics/funnel', requireAnalyticsAuth, async (req, res) => {
  const horas = Math.min(Number(req.query.hours || 24), 24 * 90);
  const desde = Date.now() - horas * 3600 * 1000;

  try {
    const linhas = USE_POSTGRES
      ? await db.sessionsByNameAndSurface(desde)
      : contagensEmMemoria(desde);

    // Indexa por nome e por nome@superficie, para as etapas dos dois formatos.
    const contagens = {};
    for (const linha of linhas) {
      contagens[linha.name] = (contagens[linha.name] || 0) + linha.sessoes;
      contagens[`${linha.name}@${linha.surface}`] = linha.sessoes;
    }

    res.json({
      horas,
      funis: Object.entries(analytics.FUNIS).map(([id, def]) => ({
        id,
        titulo: def.titulo,
        etapas: analytics.montarFunil(def, contagens),
      })),
    });
  } catch (error) {
    res.status(503).json({ error: 'Nao foi possivel ler os eventos.' });
  }
});

app.get('/api/analytics/events', requireAnalyticsAuth, async (req, res) => {
  const horas = Math.min(Number(req.query.hours || 24), 24 * 90);
  const desde = Date.now() - horas * 3600 * 1000;
  try {
    if (!USE_POSTGRES) {
      const agregado = contagensEmMemoria(desde)
        .sort((a, b) => b.sessoes - a.sessoes)
        .slice(0, 60)
        .map(l => ({ name: l.name, total: l.sessoes, sessoes: l.sessoes }));
      return res.json({ horas, eventos: agregado });
    }
    res.json({ horas, eventos: await db.countEventsByName(desde) });
  } catch (error) {
    res.status(503).json({ error: 'Nao foi possivel ler os eventos.' });
  }
});

app.get('/api/analytics/errors', requireAnalyticsAuth, async (req, res) => {
  const horas = Math.min(Number(req.query.hours || 24), 24 * 90);
  const desde = Date.now() - horas * 3600 * 1000;
  try {
    if (!USE_POSTGRES) {
      const erros = eventosMemoria
        .filter(e => e.at >= desde && e.name.startsWith('erro:'))
        .slice(-25)
        .map(e => ({ name: e.name, props: e.props, total: 1 }));
      return res.json({ horas, erros });
    }
    res.json({ horas, erros: await db.recentErrors(desde) });
  } catch (error) {
    res.status(503).json({ error: 'Nao foi possivel ler os eventos.' });
  }
});

// --------------- Leads ---------------

const leads = [];
const leadLimiter = createRateLimit(60 * 60 * 1000, Number(process.env.RATE_LIMIT_LEADS || 10));

app.post('/api/leads', leadLimiter, (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim().slice(0, 80);
  const email = String(body.email || '').trim().slice(0, 120);
  const phone = String(body.phone || '').replace(/[^\d+\s()-]/g, '').slice(0, 24);
  const segment = String(body.segment || '').trim().slice(0, 40);

  if (name.length < 2) return res.status(400).json({ error: 'Informe seu nome.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'Informe um e-mail válido.' });
  }

  const lead = { name, email, phone, segment, at: Date.now(), source: String(body.source || 'landing').slice(0, 40) };
  leads.push(lead);
  if (leads.length > 1000) leads.shift();

  notify.track('lead_captured', { segment: segment || 'nao-informado', source: lead.source });
  // Resposta automatica para o interessado, com o caminho de autoatendimento.
  notify.sendEmail('lead_received', { name, slug: 'lead', contactEmail: email }, {
    signupUrl: `${PUBLIC_APP_URL}/cadastro.html`,
  });
  console.log(`[lead] ${name} <${email}> segmento=${segment || '-'} origem=${lead.source}`);

  res.status(201).json({
    ok: true,
    signupUrl: `${PUBLIC_APP_URL}/cadastro.html`,
    message: 'Recebemos seu contato. Enquanto isso, você já pode criar sua fila.',
  });
});

app.get('/api/leads', (req, res) => {
  if (!isOperatorOf(bearerToken(req), DEFAULT_SLUG)) {
    return res.status(401).json({ error: 'Operador nao autenticado.' });
  }
  res.json({ total: leads.length, leads: leads.slice(-100).reverse() });
});

app.get('/api/funnel', (req, res) => {
  if (!isOperatorOf(bearerToken(req), DEFAULT_SLUG)) {
    return res.status(401).json({ error: 'Operador nao autenticado.' });
  }
  const hours = Number(req.query.hours || 24);
  res.json(notify.funnelSummary(hours * 3600 * 1000));
});

// --------------- Handlers por unidade ---------------

function resolveVenue(getSlug) {
  return (req, res, next) => {
    const slug = getSlug(req);
    const venue = venues.get(slug);
    if (!venue) return res.status(404).json({ error: 'Unidade nao encontrada.' });
    req.venue = venue;
    next();
  };
}

const venueRouter = express.Router({ mergeParams: true });

venueRouter.get('/config', (req, res) => {
  res.json(publicConfig(req.venue));
});

venueRouter.get('/qr.png', async (req, res) => {
  try {
    const png = await QRCode.toBuffer(joinUrl(req.venue), {
      type: 'png',
      width: Number(req.query.size) || 512,
      margin: 2,
      color: { dark: '#191919', light: '#FFFFFF' },
    });
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(png);
  } catch (error) {
    res.status(500).json({ error: 'Nao foi possivel gerar o QR code.' });
  }
});

venueRouter.get('/subscription', requireOperator, (req, res) => {
  res.json(billing.subscriptionView(req.venue));
});

// Gera o link de pagamento. Em sandbox aponta para a pagina local de simulacao.
venueRouter.post('/checkout', requireOperator, (req, res) => {
  const appUrl = PUBLIC_APP_URL;
  const checkout = billing.checkoutUrl(req.venue, appUrl);
  notify.track('checkout_started', { venue: req.venue.slug });
  res.json({ ...checkout, subscription: billing.subscriptionView(req.venue) });
});

// Só existe em modo sandbox: simula o provedor confirmando o pagamento para o
// fluxo poder ser testado inteiro antes de haver conta no provedor.
venueRouter.post('/sandbox/confirm', (req, res) => {
  if (billing.PROVIDER !== 'sandbox') {
    return res.status(404).json({ error: 'Disponivel apenas em modo sandbox.' });
  }
  const venue = req.venue;
  const result = billing.applyEvent(venue, {
    id: 'sandbox-' + Date.now(),
    type: 'subscription.paid',
    reference: venue.slug,
  });
  venue.plan = result.plan;
  pushLog(venue, 'Assinatura ativada (sandbox)');
  notify.track(result.email, { venue: venue.slug });
  notify.sendEmail(result.email, venue, { priceLabel: billing.subscriptionView(venue).priceLabel });
  broadcast(venue, { action: 'subscription', status: venue.subscription.status });
  persistStore();
  res.json({ ok: true, plan: venue.plan, subscription: billing.subscriptionView(venue) });
});

venueRouter.get('/state', (req, res) => {
  const isOperator = isOperatorOf(bearerToken(req), req.venue.slug);
  res.json(buildState(req.venue, isOperator));
});

venueRouter.post('/operator/login', loginLimiter, (req, res) => {
  const venue = req.venue;
  if (!venue.passwordHash) {
    return res.status(503).json({ error: 'Login indisponivel: esta unidade nao tem senha configurada.' });
  }
  const password = (req.body && req.body.password) || '';
  if (!verifyPassword(password, venue.passwordHash)) {
    return res.status(401).json({ error: 'Senha incorreta.' });
  }
  purgeExpiredSessions();
  const session = createSession(venue.slug);
  res.json({
    token: session.token,
    expiresAt: session.expiresAt,
    operator: venue.operatorName,
    venue: venue.slug,
  });
});

venueRouter.get('/operator/session', (req, res) => {
  const session = sessionFor(bearerToken(req));
  if (!session || session.slug !== req.venue.slug) {
    return res.status(401).json({ error: 'Sessao expirada.' });
  }
  res.json({ valid: true, expiresAt: session.expiresAt, operator: req.venue.operatorName });
});

venueRouter.post('/operator/logout', (req, res) => {
  sessions.delete(bearerToken(req));
  res.json({ ok: true });
});

venueRouter.post('/tickets', publicTicketLimiter, (req, res) => {
  const venue = req.venue;
  const { name, source } = req.body || {};
  const firstName = sanitizeName(name);
  if (!firstName) return res.status(400).json({ error: 'Nome e obrigatorio.' });

  // Limite diario do plano free.
  if (venue.dailyDate !== today()) {
    venue.dailyDate = today();
    venue.dailyCount = 0;
  }
  const limit = planLimits(venue).dailyTickets;
  if (limit && venue.dailyCount >= limit) {
    notify.track('free_limit_reached', { venue: venue.slug });
    return res.status(402).json({
      error: `Limite do plano gratuito atingido (${limit} entradas por dia). Migre para o premium para liberar a fila.`,
      limits: planLimits(venue),
    });
  }

  const id = venue.nextId++;
  venue.dailyCount++;
  const code = 'M-' + String(id).padStart(3, '0');
  const ticket = {
    id,
    code,
    name: firstName,
    status: 'waiting',
    counter: null,
    waitMin: 0,
    source: source || 'qr',
    createdAt: Date.now(),
    lastPresenceAt: Date.now(),
  };
  venue.tickets.push(ticket);
  pushLog(venue, code + ' entrou na fila');
  notify.track('queue_joined', { venue: venue.slug, source: ticket.source });
  broadcast(venue, { action: 'joined', ticketId: id });
  res.status(201).json({ ticket: ticketView(venue, ticket), config: publicConfig(venue) });
});

venueRouter.get('/tickets/:id', (req, res) => {
  const venue = req.venue;
  const t = venue.tickets.find(x => x.id === parseInt(req.params.id, 10));
  if (!t) return res.status(404).json({ error: 'Ticket nao encontrado.' });
  res.json({ ticket: ticketView(venue, t), state: buildState(venue, false) });
});

venueRouter.post('/tickets/:id/presence', publicTicketLimiter, (req, res) => {
  const venue = req.venue;
  const id = parseInt(req.params.id, 10);
  const t = venue.tickets.find(x => x.id === id);
  if (!t) return res.status(404).json({ error: 'Ticket nao encontrado.' });
  if (t.status !== 'waiting') {
    return res.status(409).json({ error: 'A presenca so pode ser confirmada enquanto voce aguarda.' });
  }
  if (!req.body || req.body.qrToken !== venue.qrToken) {
    return res.status(403).json({ error: 'QR code invalido para este local.' });
  }

  t.lastPresenceAt = Date.now();
  pushLog(venue, t.code + ' confirmou presenca');
  broadcast(venue, { action: 'presence-confirmed', ticketId: id });
  res.json({ ticket: ticketView(venue, t), message: 'Presenca confirmada.' });
});

venueRouter.post('/tickets/:id/pass', publicTicketLimiter, (req, res) => {
  const venue = req.venue;
  const id = parseInt(req.params.id, 10);
  const t = venue.tickets.find(x => x.id === id);
  if (!t) return res.status(404).json({ error: 'Ticket nao encontrado.' });
  if (t.status !== 'waiting') return res.status(409).json({ error: 'So da para passar a vez enquanto voce esta aguardando.' });

  const proximity = checkProximity(venue, req.body || {});
  if (!proximity.ok) {
    return res.status(403).json({
      error: 'Voce precisa estar perto do ponto de entrada para passar a vez.',
      proximity,
    });
  }

  const moved = moveTicketBack(venue, t, 3);
  if (!moved) {
    return res.status(409).json({
      error: 'Voce ja e o ultimo da fila — nao ha para quem passar a vez.',
      ticket: ticketView(venue, t),
    });
  }
  pushLog(venue, t.code + ' passou a vez');
  broadcast(venue, { action: 'passed', ticketId: id, proximity });
  res.json({ ticket: moved, proximity, message: t.code + ' passou a vez.' });
});

venueRouter.post('/tickets/call-next', requireOperator, (req, res) => {
  const venue = req.venue;
  const next = venue.tickets.find(t => t.status === 'waiting');
  if (!next) return res.status(409).json({ error: 'A fila está vazia.' });
  const cn = freeCounter(venue);
  if (!cn) return res.status(409).json({ error: 'Todos os balcões estão ocupados — conclua um atendimento primeiro.' });

  next.status = 'calling';
  next.counter = cn;
  venue.lastCalled = next.id;
  const log = pushLog(venue, next.code + ' chamada · Balcão ' + cn);
  notify.track('queue_called', { venue: venue.slug });
  broadcast(venue, { action: 'called', ticketId: next.id, counter: cn });
  res.json({ ticket: next, log, message: next.code + ' chamada para o Balcão ' + cn + '.' });
});

venueRouter.post('/tickets/:id/call', requireOperator, (req, res) => {
  const venue = req.venue;
  const id = parseInt(req.params.id, 10);
  const t = venue.tickets.find(x => x.id === id);
  if (!t) return res.status(404).json({ error: 'Ticket não encontrado.' });
  if (t.status !== 'waiting') return res.status(409).json({ error: 'Ticket não está na fila.' });
  const cn = freeCounter(venue);
  if (!cn) return res.status(409).json({ error: 'Todos os balcões estão ocupados.' });

  t.status = 'calling';
  t.counter = cn;
  venue.lastCalled = id;
  pushLog(venue, t.code + ' chamada · Balcão ' + cn);
  broadcast(venue, { action: 'called', ticketId: id, counter: cn });
  res.json({ ticket: t });
});

venueRouter.post('/tickets/:id/finish', requireOperator, (req, res) => {
  const venue = req.venue;
  const id = parseInt(req.params.id, 10);
  const t = venue.tickets.find(x => x.id === id);
  if (!t) return res.status(404).json({ error: 'Ticket não encontrado.' });
  if (t.status !== 'calling') return res.status(409).json({ error: 'Ticket não está sendo chamado.' });

  pushLog(venue, t.code + ' atendida · Balcão ' + t.counter);
  t.status = 'served';
  t.closedAt = Date.now();
  venue.servedToday++;
  broadcast(venue, { action: 'finished', ticketId: id });
  res.json({ ticket: t });
});

venueRouter.post('/tickets/:id/recall', requireOperator, (req, res) => {
  const venue = req.venue;
  const id = parseInt(req.params.id, 10);
  const t = venue.tickets.find(x => x.id === id);
  if (!t) return res.status(404).json({ error: 'Ticket não encontrado.' });
  if (t.status !== 'calling') return res.status(409).json({ error: 'Ticket não está sendo chamado.' });

  venue.lastCalled = id;
  pushLog(venue, t.code + ' rechamada · Balcão ' + t.counter);
  broadcast(venue, { action: 'recalled', ticketId: id });
  res.json({ ticket: t, message: 'Rechamando ' + t.code + '.' });
});

venueRouter.post('/tickets/:id/absent', requireOperator, (req, res) => {
  const venue = req.venue;
  const id = parseInt(req.params.id, 10);
  const t = venue.tickets.find(x => x.id === id);
  if (!t) return res.status(404).json({ error: 'Ticket não encontrado.' });
  if (t.status !== 'waiting') return res.status(409).json({ error: 'Ticket não está na fila.' });

  t.status = 'absent';
  t.counter = null;
  t.closedAt = Date.now();
  pushLog(venue, t.code + ' marcada como ausente');
  broadcast(venue, { action: 'absent', ticketId: id });
  res.json({ ticket: t });
});

// Rotas por unidade e rotas legadas (apontam para a unidade padrao, mantendo
// o app Android ja publicado funcionando).
app.use('/api/venues/:slug', resolveVenue(req => req.params.slug), venueRouter);
app.use('/api', resolveVenue(() => DEFAULT_SLUG), venueRouter);

// --------------- Start ---------------

const PORT = process.env.PORT || 3000;

loadPersistedStore()
  .then(() => {
    purgeOldTickets();
    checkTrials();
    setInterval(() => {
      purgeOldTickets();
      purgeExpiredSessions();
      checkTrials();
      if (USE_POSTGRES) {
        const corte = Date.now() - analytics.RETENCAO_DIAS * 86400000;
        db.purgeEvents(corte).catch(() => {});
      }
    }, PURGE_INTERVAL_MS).unref();

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Fila Virtual API running on port ${PORT}`);
      console.log(`Persistencia: ${USE_POSTGRES ? 'Postgres' : 'arquivo JSON (' + DATA_FILE + ')'}`);
      console.log(`Unidades carregadas: ${[...venues.keys()].join(', ')}`);
      console.log(`Retencao LGPD: ${TICKET_RETENTION_HOURS}h · fila demo: ${SEED_DEMO ? 'ligada' : 'desligada'}`);
      console.log(`WebSocket available at ws://0.0.0.0:${PORT}/ws`);
    });
  })
  .catch(error => {
    console.error('Falha ao carregar persistencia:', error.message);
    process.exit(1);
  });
