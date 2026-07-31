const express = require('express');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const cors = require('cors');

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
app.use(express.json({ limit: '32kb' }));

// --------------- In-memory store ---------------

const store = {
  venue: process.env.VENUE_NAME || 'Unidade Centro',
  operator: process.env.OPERATOR_NAME || 'Equipe balcão',
  venueSlug: process.env.VENUE_SLUG || 'centro',
  qrToken: process.env.VENUE_QR_TOKEN || 'demo-centro',
  latitude: Number(process.env.VENUE_LAT || -3.119028),
  longitude: Number(process.env.VENUE_LNG || -60.021731),
  proximityRadiusMeters: Number(process.env.PROXIMITY_RADIUS_METERS || 120),
  plan: process.env.PLAN === 'premium' ? 'premium' : 'free',
  adsEnabled: process.env.ADS_ENABLED === 'false' ? false : process.env.PLAN !== 'premium',
  countersTotal: 3,
  servedToday: SEED_DEMO ? 47 : 0,
  lastCalled: SEED_DEMO ? 42 : 0,
  nextId: SEED_DEMO ? 52 : 1,
  tickets: seedTickets(),
  log: [],
};

// Fila de demonstracao: so fora de producao e apenas com primeiro nome (LGPD).
function seedTickets() {
  if (!SEED_DEMO) return [];
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

// --------------- Helpers ---------------

function pad(n) { return String(n).padStart(2, '0'); }
function clockShort() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

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

// --------------- Sessao do operador ---------------

const SESSION_TTL_MS = Number(process.env.SESSION_TTL_HOURS || 8) * 3600 * 1000;
const OPERATOR_PASSWORD = process.env.OPERATOR_PASSWORD || process.env.ADMIN_TOKEN || '';
const sessions = new Map(); // token -> expiresAt

function safeEquals(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(token, expiresAt);
  return { token, expiresAt };
}

function sessionValid(token) {
  const expiresAt = sessions.get(token);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function purgeExpiredSessions() {
  const now = Date.now();
  for (const [token, expiresAt] of sessions) {
    if (expiresAt <= now) sessions.delete(token);
  }
}

function bearerToken(req) {
  const auth = req.get('authorization') || '';
  return auth.replace(/^Bearer\s+/i, '') || req.get('x-admin-token') || '';
}

// Humanos entram por sessao (POST /api/operator/login). O ADMIN_TOKEN continua
// valendo como credencial de automacao (scripts, monitoramento).
function requireOperator(req, res, next) {
  const token = bearerToken(req);
  if (sessionValid(token)) return next();
  if (process.env.ADMIN_TOKEN && safeEquals(token, process.env.ADMIN_TOKEN)) return next();
  if (!IS_PRODUCTION && !OPERATOR_PASSWORD) return next();
  return res.status(401).json({ error: 'Operador nao autenticado.' });
}

function freeCounter() {
  const used = store.tickets.filter(t => t.status === 'calling').map(t => t.counter);
  for (let n = 1; n <= store.countersTotal; n++) {
    if (!used.includes(n)) return n;
  }
  return null;
}

function pushLog(text) {
  const entry = { t: clockShort(), text, ts: Date.now() };
  store.log = [entry, ...store.log].slice(0, 20);
  return entry;
}

// LGPD: expurga tickets encerrados depois da janela de retencao. Mantem o
// contador do dia, que e agregado e nao identifica ninguem.
function purgeOldTickets() {
  const cutoff = Date.now() - TICKET_RETENTION_HOURS * 3600 * 1000;
  const before = store.tickets.length;
  store.tickets = store.tickets.filter(t => {
    const closed = t.status === 'served' || t.status === 'absent';
    if (!closed) return true;
    return (t.closedAt || t.createdAt || 0) > cutoff;
  });
  const removed = before - store.tickets.length;
  if (removed > 0) {
    console.log(`LGPD: ${removed} ticket(s) encerrado(s) expurgado(s) apos ${TICKET_RETENTION_HOURS}h.`);
    broadcast({ action: 'purged', removed });
  }
  return removed;
}

function updateWaitTimes() {
  const now = Date.now();
  store.tickets.forEach(t => {
    if (t.status === 'waiting') {
      t.waitMin = Math.round((now - t.createdAt) / 60000);
    }
  });
}

function applyPersistedData(data) {
  if (!data) return;
  if (Number.isFinite(data.servedToday)) store.servedToday = data.servedToday;
  if (Number.isFinite(data.lastCalled)) store.lastCalled = data.lastCalled;
  if (Number.isFinite(data.nextId)) store.nextId = data.nextId;
  if (Array.isArray(data.tickets) && data.tickets.length) store.tickets = data.tickets;
  if (Array.isArray(data.log) && data.log.length) store.log = data.log;
}

async function loadPersistedStore() {
  if (USE_POSTGRES) {
    await db.ensureSchema();
    applyPersistedData(await db.loadStore());
    return;
  }
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    applyPersistedData(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
  } catch (error) {
    console.warn('Nao foi possivel carregar persistencia local:', error.message);
  }
}

function snapshot() {
  return {
    servedToday: store.servedToday,
    lastCalled: store.lastCalled,
    nextId: store.nextId,
    tickets: store.tickets,
    log: store.log,
  };
}

function persistStore() {
  if (USE_POSTGRES) {
    db.saveStore(snapshot()).catch(error => {
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

function entitlement() {
  const premium = store.plan === 'premium';
  return {
    plan: store.plan,
    adsEnabled: !premium && store.adsEnabled,
    premiumRemovesAds: true,
    limits: premium
      ? { dailyTickets: null, counters: null }
      : { dailyTickets: 50, counters: 1 },
  };
}

function publicConfig() {
  return {
    venue: {
      name: store.venue,
      slug: store.venueSlug,
      qrToken: store.qrToken,
      proximityRadiusMeters: store.proximityRadiusMeters,
    },
    monetization: entitlement(),
  };
}

function sanitizeName(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)[0]
    .replace(/[^\p{L}\p{N}'-]/gu, '')
    .slice(0, 28);
}

function ticketView(ticket) {
  if (!ticket) return null;
  const waiting = store.tickets.filter(t => t.status === 'waiting');
  const waitingIndex = waiting.findIndex(t => t.id === ticket.id);
  return {
    id: ticket.id,
    code: ticket.code,
    name: ticket.name,
    status: ticket.status,
    counter: ticket.counter,
    waitMin: ticket.waitMin,
    source: ticket.source,
    lastPresenceAt: ticket.lastPresenceAt || null,
    position: waitingIndex >= 0 ? waitingIndex + 1 : 0,
    ahead: waitingIndex >= 0 ? waitingIndex : 0,
    etaMin: waitingIndex >= 0 ? Math.max(2, waitingIndex * 4 + 3) : 0,
  };
}

function toRad(value) {
  return value * Math.PI / 180;
}

function distanceMeters(aLat, aLng, bLat, bLng) {
  const earth = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const a = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
  return Math.round(earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function checkProximity(body) {
  if (body.qrToken && body.qrToken === store.qrToken) {
    return { ok: true, method: 'qr', distanceMeters: 0 };
  }
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, method: 'unknown', distanceMeters: null };
  }
  const distance = distanceMeters(latitude, longitude, store.latitude, store.longitude);
  return {
    ok: distance <= store.proximityRadiusMeters,
    method: 'gps',
    distanceMeters: distance,
  };
}

// Devolve null quando o ticket ja esta no fim da fila e nao ha para quem passar.
function moveTicketBack(ticket, steps) {
  const waiting = store.tickets.filter(t => t.status === 'waiting');
  const currentPos = waiting.findIndex(t => t.id === ticket.id);
  if (currentPos < 0) return null;
  const targetPos = Math.min(waiting.length - 1, currentPos + steps);
  if (targetPos === currentPos) return null;

  const target = waiting[targetPos];
  const fromIndex = store.tickets.findIndex(t => t.id === ticket.id);
  store.tickets.splice(fromIndex, 1);
  const targetIndex = store.tickets.findIndex(t => t.id === target.id);
  store.tickets.splice(targetIndex + 1, 0, ticket);
  ticket.source = 'passou';
  ticket.passedAt = Date.now();
  ticket.lastPresenceAt = Date.now();
  return ticketView(ticket);
}

// LGPD: o nome so vai para quem esta autenticado como operador. Telao e app do
// cliente trabalham com codigo/posicao, nao precisam saber quem e quem.
function buildState(withNames = false) {
  updateWaitTimes();
  const waiting = store.tickets.filter(t => t.status === 'waiting');
  const calling = store.tickets.filter(t => t.status === 'calling');
  const absent = store.tickets.filter(t => t.status === 'absent');
  const avg = waiting.length ? Math.round(waiting.reduce((a, t) => a + t.waitMin, 0) / waiting.length) : 0;

  const counters = [];
  for (let n = 1; n <= store.countersTotal; n++) {
    const t = calling.find(x => x.counter === n);
    counters.push({
      id: n,
      name: 'Balcão ' + n,
      busy: !!t,
      ticketCode: t ? t.code : null,
      ticketId: t ? t.id : null,
    });
  }

  const hero = calling.find(t => t.id === store.lastCalled) || calling[calling.length - 1] || null;

  return {
    venue: store.venue,
    operator: store.operator,
    kpis: {
      waiting: waiting.length,
      calling: calling.length,
      avgWait: avg,
      servedToday: store.servedToday,
      absent: absent.length,
    },
    tickets: store.tickets.map(t => ({
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
      slug: store.venueSlug,
      proximityRadiusMeters: store.proximityRadiusMeters,
    },
    monetization: entitlement(),
    hero: hero ? { id: hero.id, code: hero.code, name: withNames ? hero.name : null, counter: hero.counter } : null,
    counters,
    log: store.log.slice(0, 7),
    lastCalled: store.lastCalled,
  };
}

// --------------- WebSocket ---------------

const clients = new Set();

wss.on('connection', (ws, req) => {
  let token = '';
  try {
    token = new URL(req.url, 'http://localhost').searchParams.get('token') || '';
  } catch (e) { /* url malformada: trata como publico */ }
  ws.isOperator = sessionValid(token) ||
    (!!process.env.ADMIN_TOKEN && safeEquals(token, process.env.ADMIN_TOKEN));

  clients.add(ws);
  ws.send(JSON.stringify({ type: 'state', data: buildState(ws.isOperator) }));
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

function broadcast(event) {
  persistStore();
  const publicMsg = JSON.stringify({ type: 'state', data: buildState(false), event });
  const operatorMsg = JSON.stringify({ type: 'state', data: buildState(true), event });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(ws.isOperator ? operatorMsg : publicMsg);
  }
}

// --------------- REST API ---------------

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    version: APP_VERSION,
    plan: store.plan,
    websocketClients: clients.size,
  });
});

app.get('/api/config', (_req, res) => {
  res.json(publicConfig());
});

app.get('/api/state', (req, res) => {
  const token = bearerToken(req);
  const isOperator = sessionValid(token) ||
    (!!process.env.ADMIN_TOKEN && safeEquals(token, process.env.ADMIN_TOKEN));
  res.json(buildState(isOperator));
});

app.post('/api/operator/login', loginLimiter, (req, res) => {
  if (!OPERATOR_PASSWORD) {
    return res.status(503).json({ error: 'Login indisponivel: defina OPERATOR_PASSWORD no servidor.' });
  }
  const password = (req.body && req.body.password) || '';
  if (!safeEquals(password, OPERATOR_PASSWORD)) {
    return res.status(401).json({ error: 'Senha incorreta.' });
  }
  purgeExpiredSessions();
  const session = createSession();
  res.json({ token: session.token, expiresAt: session.expiresAt, operator: store.operator });
});

app.get('/api/operator/session', (req, res) => {
  const token = bearerToken(req);
  if (!sessionValid(token)) return res.status(401).json({ error: 'Sessao expirada.' });
  res.json({ valid: true, expiresAt: sessions.get(token), operator: store.operator });
});

app.post('/api/operator/logout', (req, res) => {
  sessions.delete(bearerToken(req));
  res.json({ ok: true });
});

app.post('/api/tickets/call-next', requireOperator, (_req, res) => {
  const next = store.tickets.find(t => t.status === 'waiting');
  if (!next) return res.status(409).json({ error: 'A fila está vazia.' });
  const cn = freeCounter();
  if (!cn) return res.status(409).json({ error: 'Todos os balcões estão ocupados — conclua um atendimento primeiro.' });

  next.status = 'calling';
  next.counter = cn;
  store.lastCalled = next.id;
  const log = pushLog(next.code + ' chamada · Balcão ' + cn);
  broadcast({ action: 'called', ticketId: next.id, counter: cn });
  res.json({ ticket: next, log, message: next.code + ' chamada para o Balcão ' + cn + '.' });
});

app.get('/api/tickets/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const t = store.tickets.find(x => x.id === id);
  if (!t) return res.status(404).json({ error: 'Ticket nao encontrado.' });
  res.json({ ticket: ticketView(t), state: buildState(false) });
});

app.post('/api/tickets/:id/presence', publicTicketLimiter, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const t = store.tickets.find(x => x.id === id);
  if (!t) return res.status(404).json({ error: 'Ticket nao encontrado.' });
  if (t.status !== 'waiting') {
    return res.status(409).json({ error: 'A presenca so pode ser confirmada enquanto voce aguarda.' });
  }
  if (!req.body || req.body.qrToken !== store.qrToken) {
    return res.status(403).json({ error: 'QR code invalido para este local.' });
  }

  t.lastPresenceAt = Date.now();
  pushLog(t.code + ' confirmou presenca');
  broadcast({ action: 'presence-confirmed', ticketId: id });
  res.json({ ticket: ticketView(t), message: 'Presenca confirmada.' });
});

app.post('/api/tickets/:id/pass', publicTicketLimiter, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const t = store.tickets.find(x => x.id === id);
  if (!t) return res.status(404).json({ error: 'Ticket nao encontrado.' });
  if (t.status !== 'waiting') return res.status(409).json({ error: 'So da para passar a vez enquanto voce esta aguardando.' });

  const proximity = checkProximity(req.body || {});
  if (!proximity.ok) {
    return res.status(403).json({
      error: 'Voce precisa estar perto do ponto de entrada para passar a vez.',
      proximity,
    });
  }

  const moved = moveTicketBack(t, 3);
  if (!moved) {
    return res.status(409).json({
      error: 'Voce ja e o ultimo da fila — nao ha para quem passar a vez.',
      ticket: ticketView(t),
    });
  }
  pushLog(t.code + ' passou a vez');
  broadcast({ action: 'passed', ticketId: id, proximity });
  res.json({ ticket: moved, proximity, message: t.code + ' passou a vez.' });
});

app.post('/api/tickets/:id/call', requireOperator, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const t = store.tickets.find(x => x.id === id);
  if (!t) return res.status(404).json({ error: 'Ticket não encontrado.' });
  if (t.status !== 'waiting') return res.status(409).json({ error: 'Ticket não está na fila.' });
  const cn = freeCounter();
  if (!cn) return res.status(409).json({ error: 'Todos os balcões estão ocupados.' });

  t.status = 'calling';
  t.counter = cn;
  store.lastCalled = id;
  pushLog(t.code + ' chamada · Balcão ' + cn);
  broadcast({ action: 'called', ticketId: id, counter: cn });
  res.json({ ticket: t });
});

app.post('/api/tickets/:id/finish', requireOperator, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const t = store.tickets.find(x => x.id === id);
  if (!t) return res.status(404).json({ error: 'Ticket não encontrado.' });
  if (t.status !== 'calling') return res.status(409).json({ error: 'Ticket não está sendo chamado.' });

  pushLog(t.code + ' atendida · Balcão ' + t.counter);
  t.status = 'served';
  t.closedAt = Date.now();
  store.servedToday++;
  broadcast({ action: 'finished', ticketId: id });
  res.json({ ticket: t });
});

app.post('/api/tickets/:id/recall', requireOperator, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const t = store.tickets.find(x => x.id === id);
  if (!t) return res.status(404).json({ error: 'Ticket não encontrado.' });
  if (t.status !== 'calling') return res.status(409).json({ error: 'Ticket não está sendo chamado.' });

  store.lastCalled = id;
  pushLog(t.code + ' rechamada · Balcão ' + t.counter);
  broadcast({ action: 'recalled', ticketId: id });
  res.json({ ticket: t, message: 'Rechamando ' + t.code + '.' });
});

app.post('/api/tickets/:id/absent', requireOperator, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const t = store.tickets.find(x => x.id === id);
  if (!t) return res.status(404).json({ error: 'Ticket não encontrado.' });
  if (t.status !== 'waiting') return res.status(409).json({ error: 'Ticket não está na fila.' });

  t.status = 'absent';
  t.counter = null;
  t.closedAt = Date.now();
  pushLog(t.code + ' marcada como ausente');
  broadcast({ action: 'absent', ticketId: id });
  res.json({ ticket: t });
});

app.post('/api/tickets', publicTicketLimiter, (req, res) => {
  const { name, source } = req.body;
  const firstName = sanitizeName(name);
  if (!firstName) return res.status(400).json({ error: 'Nome e obrigatorio.' });

  const id = store.nextId++;
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
  store.tickets.push(ticket);
  pushLog(code + ' entrou na fila');
  broadcast({ action: 'joined', ticketId: id });
  res.status(201).json({ ticket: ticketView(ticket), config: publicConfig() });
});

// --------------- Start ---------------

const PORT = process.env.PORT || 3000;

loadPersistedStore()
  .then(() => {
    purgeOldTickets();
    setInterval(() => {
      purgeOldTickets();
      purgeExpiredSessions();
    }, PURGE_INTERVAL_MS).unref();

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Fila Virtual API running on port ${PORT}`);
      console.log(`Persistencia: ${USE_POSTGRES ? 'Postgres' : 'arquivo JSON (' + DATA_FILE + ')'}`);
      console.log(`Retencao LGPD: ${TICKET_RETENTION_HOURS}h · fila demo: ${SEED_DEMO ? 'ligada' : 'desligada'}`);
      console.log(`WebSocket available at ws://0.0.0.0:${PORT}/ws`);
    });
  })
  .catch(error => {
    console.error('Falha ao carregar persistencia:', error.message);
    process.exit(1);
  });
