const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const APP_VERSION = process.env.APP_VERSION || '0.1.0';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'store.json');
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
  servedToday: 47,
  lastCalled: 42,
  nextId: 52,
  tickets: [
    { id: 38, code: 'M-038', name: 'Helena Dias', status: 'served', counter: 1, waitMin: 0, source: 'qr', createdAt: Date.now() },
    { id: 39, code: 'M-039', name: 'Bruno Alves', status: 'served', counter: 2, waitMin: 0, source: 'senha', createdAt: Date.now() },
    { id: 40, code: 'M-040', name: 'Sofia Rocha', status: 'served', counter: 1, waitMin: 0, source: 'qr', createdAt: Date.now() },
    { id: 41, code: 'M-041', name: 'Marcos Pinto', status: 'absent', counter: null, waitMin: 0, source: 'qr', createdAt: Date.now() },
    { id: 42, code: 'M-042', name: 'Cliente do app', status: 'calling', counter: 3, waitMin: 0, source: 'qr', createdAt: Date.now() },
    { id: 43, code: 'M-043', name: 'Carlos Mendes', status: 'waiting', counter: null, waitMin: 14, source: 'qr', createdAt: Date.now() - 14 * 60000 },
    { id: 44, code: 'M-044', name: 'Júlia Nascimento', status: 'waiting', counter: null, waitMin: 12, source: 'passou', createdAt: Date.now() - 12 * 60000 },
    { id: 45, code: 'M-045', name: 'Pedro Albano', status: 'waiting', counter: null, waitMin: 10, source: 'senha', createdAt: Date.now() - 10 * 60000 },
    { id: 46, code: 'M-046', name: 'Mariana Costa', status: 'waiting', counter: null, waitMin: 9, source: 'qr', createdAt: Date.now() - 9 * 60000 },
    { id: 47, code: 'M-047', name: 'Rafael Souza', status: 'waiting', counter: null, waitMin: 7, source: 'qr', createdAt: Date.now() - 7 * 60000 },
    { id: 48, code: 'M-048', name: 'Beatriz Lima', status: 'waiting', counter: null, waitMin: 5, source: 'senha', createdAt: Date.now() - 5 * 60000 },
    { id: 49, code: 'M-049', name: 'Tiago Ferreira', status: 'waiting', counter: null, waitMin: 4, source: 'qr', createdAt: Date.now() - 4 * 60000 },
    { id: 50, code: 'M-050', name: 'Larissa Gomes', status: 'waiting', counter: null, waitMin: 2, source: 'passou', createdAt: Date.now() - 2 * 60000 },
    { id: 51, code: 'M-051', name: 'Diego Martins', status: 'waiting', counter: null, waitMin: 1, source: 'qr', createdAt: Date.now() - 60000 },
  ],
  log: [
    { t: '14:31', text: 'M-042 chamada · Balcão 3', ts: Date.now() },
    { t: '14:29', text: 'M-040 atendida · Balcão 1', ts: Date.now() },
    { t: '14:27', text: 'M-041 marcada como ausente', ts: Date.now() },
    { t: '14:25', text: 'M-039 atendida · Balcão 2', ts: Date.now() },
  ],
};

loadPersistedStore();

// --------------- Helpers ---------------

function pad(n) { return String(n).padStart(2, '0'); }
function clockShort() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

function createRateLimit(windowMs, maxHits) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.headers['x-forwarded-for'] || 'local';
    const bucket = (hits.get(key) || []).filter(ts => now - ts < windowMs);
    bucket.push(now);
    hits.set(key, bucket);
    if (bucket.length > maxHits) return res.status(429).json({ error: 'Muitas tentativas. Aguarde um pouco.' });
    next();
  };
}

const publicTicketLimiter = createRateLimit(60 * 1000, 20);

function requireOperator(req, res, next) {
  if (!IS_PRODUCTION && !process.env.ADMIN_TOKEN) return next();
  const auth = req.get('authorization') || '';
  const bearer = auth.replace(/^Bearer\s+/i, '');
  const token = bearer || req.get('x-admin-token');
  if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) return next();
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

function updateWaitTimes() {
  const now = Date.now();
  store.tickets.forEach(t => {
    if (t.status === 'waiting') {
      t.waitMin = Math.round((now - t.createdAt) / 60000);
    }
  });
}

function loadPersistedStore() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (Number.isFinite(data.servedToday)) store.servedToday = data.servedToday;
    if (Number.isFinite(data.lastCalled)) store.lastCalled = data.lastCalled;
    if (Number.isFinite(data.nextId)) store.nextId = data.nextId;
    if (Array.isArray(data.tickets)) store.tickets = data.tickets;
    if (Array.isArray(data.log)) store.log = data.log;
  } catch (error) {
    console.warn('Nao foi possivel carregar persistencia local:', error.message);
  }
}

function persistStore() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      servedToday: store.servedToday,
      lastCalled: store.lastCalled,
      nextId: store.nextId,
      tickets: store.tickets,
      log: store.log,
      savedAt: new Date().toISOString(),
    }, null, 2));
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

function moveTicketBack(ticket, steps) {
  const waiting = store.tickets.filter(t => t.status === 'waiting');
  const currentPos = waiting.findIndex(t => t.id === ticket.id);
  if (currentPos < 0) return ticketView(ticket);
  const targetPos = Math.min(waiting.length - 1, currentPos + steps);
  if (targetPos === currentPos) return ticketView(ticket);

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

function buildState() {
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
      name: t.name,
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
    hero: hero ? { id: hero.id, code: hero.code, name: hero.name, counter: hero.counter } : null,
    counters,
    log: store.log.slice(0, 7),
    lastCalled: store.lastCalled,
  };
}

// --------------- WebSocket ---------------

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'state', data: buildState() }));
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

function broadcast(event) {
  persistStore();
  const state = buildState();
  const msg = JSON.stringify({ type: 'state', data: state, event });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
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

app.get('/api/state', (_req, res) => {
  res.json(buildState());
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
  res.json({ ticket: ticketView(t), state: buildState() });
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
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Fila Virtual API running on port ${PORT}`);
  console.log(`WebSocket available at ws://0.0.0.0:${PORT}/ws`);
});
