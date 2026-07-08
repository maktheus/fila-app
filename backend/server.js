const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json());

// Local dev convenience: serve the frontend when the folder is present
// (in Docker the image has no ../frontend — nginx/GitHub Pages serve it).
const frontendDir = path.join(__dirname, '..', 'frontend');
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
}

// --------------- In-memory store ---------------

const store = {
  venue: process.env.VENUE_NAME || 'Unidade Centro',
  operator: process.env.OPERATOR_NAME || 'Equipe balcão',
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
  events: [],
};

// --------------- Metrics events ---------------
// Every queue movement is recorded as an event so /api/metrics can
// aggregate history. Seeded with a plausible day (since 08:00) so the
// dashboard has data on a fresh boot, matching servedToday.

function recordEvent(type, extra) {
  store.events.push(Object.assign({ ts: Date.now(), type }, extra || {}));
  if (store.events.length > 5000) store.events = store.events.slice(-4000);
}

function seedEvents() {
  const now = Date.now();
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
  // Last 8 hours of demo traffic, never crossing into yesterday
  const start = Math.max(midnight.getTime(), now - 8 * 3600000);
  const hours = Math.max((now - start) / 3600000, 1);
  const sources = ['qr', 'qr', 'qr', 'senha', 'senha', 'passou'];
  let seq = 0;
  // Hourly intensity curve: ramps up to a mid-window peak, tapers off
  for (let h = 0; h < Math.ceil(hours); h++) {
    const hourStart = start + h * 3600000;
    const intensity = 4 + Math.round(4 * Math.sin((h + 1) / (hours + 1) * Math.PI));
    for (let i = 0; i < intensity; i++) {
      const ts = hourStart + Math.floor((i + 0.3) / intensity * 3600000);
      if (ts > now) continue;
      const source = sources[seq++ % sources.length];
      recordEventAt(ts, 'joined', { source });
      // Wait grows with the hour's load plus per-ticket jitter
      const waitMin = 2 + intensity + ((seq * 5) % 9);
      const calledTs = ts + waitMin * 60000;
      if (calledTs > now) continue;
      if (seq % 9 !== 0) {
        recordEventAt(calledTs, 'called', { waitMin });
        const serviceMin = 3 + ((seq * 5) % 7);
        const servedTs = calledTs + serviceMin * 60000;
        if (servedTs <= now) recordEventAt(servedTs, 'served', { serviceMin, counter: (seq % store.countersTotal) + 1 });
      } else {
        recordEventAt(calledTs, 'called', { waitMin });
        const absentTs = calledTs + 4 * 60000;
        if (absentTs <= now) recordEventAt(absentTs, 'absent', {});
      }
    }
  }
  // The tickets currently waiting in the store also joined recently
  store.tickets.filter(t => t.status === 'waiting').forEach(t => {
    recordEventAt(t.createdAt, 'joined', { source: t.source });
  });
  store.events.sort((a, b) => a.ts - b.ts);
  store.servedToday = store.events.filter(e => e.type === 'served').length;
}

function recordEventAt(ts, type, extra) {
  store.events.push(Object.assign({ ts, type }, extra || {}));
}

seedEvents();

// --------------- Helpers ---------------

function pad(n) { return String(n).padStart(2, '0'); }
function clockShort() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

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
    })),
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
  const state = buildState();
  const msg = JSON.stringify({ type: 'state', data: state, event });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

// --------------- REST API ---------------

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/state', (_req, res) => {
  res.json(buildState());
});

// Observability: aggregated history for the overview dashboard.
// ?range=today|4h|1h scopes every series and KPI to the same slice.
app.get('/api/metrics', (req, res) => {
  const now = Date.now();
  const range = req.query.range === '4h' ? '4h' : req.query.range === '1h' ? '1h' : 'today';
  let from;
  if (range === '4h') from = now - 4 * 3600000;
  else if (range === '1h') from = now - 3600000;
  else { const d = new Date(now); d.setHours(0, 0, 0, 0); from = d.getTime(); }

  const evs = store.events.filter(e => e.ts >= from && e.ts <= now);
  const byType = t => evs.filter(e => e.type === t);
  const joined = byType('joined'), called = byType('called'), servedEv = byType('served'), absentEv = byType('absent');

  const waits = called.map(e => e.waitMin).filter(v => typeof v === 'number').sort((a, b) => a - b);
  const avgWait = waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0;
  const p90Wait = waits.length ? waits[Math.min(waits.length - 1, Math.floor(waits.length * 0.9))] : 0;
  const services = servedEv.map(e => e.serviceMin).filter(v => typeof v === 'number');
  const avgService = services.length ? Math.round(services.reduce((a, b) => a + b, 0) / services.length) : 0;
  const finished = servedEv.length + absentEv.length;
  const absentRate = finished ? Math.round(absentEv.length / finished * 100) : 0;

  // Buckets: hourly for "today", 30 min for 4h, 10 min for 1h
  const bucketMs = range === 'today' ? 3600000 : range === '4h' ? 1800000 : 600000;
  const bucketStart = Math.floor(from / bucketMs) * bucketMs;
  const nBuckets = Math.ceil((now - bucketStart) / bucketMs);
  const buckets = [];
  for (let i = 0; i < nBuckets; i++) {
    const t0 = bucketStart + i * bucketMs, t1 = t0 + bucketMs;
    const inB = e => e.ts >= t0 && e.ts < t1;
    const bWaits = called.filter(inB).map(e => e.waitMin).filter(v => typeof v === 'number');
    buckets.push({
      t0,
      label: new Date(t0).toTimeString().slice(0, 5),
      joined: joined.filter(inB).length,
      served: servedEv.filter(inB).length,
      avgWait: bWaits.length ? Math.round(bWaits.reduce((a, b) => a + b, 0) / bWaits.length) : null,
    });
  }

  const sources = { qr: 0, senha: 0, passou: 0 };
  joined.forEach(e => { if (sources[e.source] !== undefined) sources[e.source]++; });

  const perCounter = [];
  for (let n = 1; n <= store.countersTotal; n++) {
    perCounter.push({ id: n, name: 'Balcão ' + n, served: servedEv.filter(e => e.counter === n).length });
  }

  const hoursElapsed = Math.max((now - from) / 3600000, 0.25);
  const state = buildState();

  res.json({
    generatedAt: now,
    range,
    health: {
      status: 'ok',
      uptimeSec: Math.round(process.uptime()),
      wsClients: clients.size,
      memoryMb: Math.round(process.memoryUsage().rss / 1048576),
      node: process.version,
      eventsStored: store.events.length,
    },
    kpis: {
      waitingNow: state.kpis.waiting,
      callingNow: state.kpis.calling,
      joined: joined.length,
      served: servedEv.length,
      absent: absentEv.length,
      absentRate,
      avgWait,
      p90Wait,
      avgService,
      throughputHour: Math.round(servedEv.length / hoursElapsed * 10) / 10,
    },
    buckets,
    sources,
    perCounter,
  });
});

app.post('/api/tickets/call-next', (_req, res) => {
  const next = store.tickets.find(t => t.status === 'waiting');
  if (!next) return res.status(409).json({ error: 'A fila está vazia.' });
  const cn = freeCounter();
  if (!cn) return res.status(409).json({ error: 'Todos os balcões estão ocupados — conclua um atendimento primeiro.' });

  next.status = 'calling';
  next.counter = cn;
  next.calledAt = Date.now();
  store.lastCalled = next.id;
  recordEvent('called', { waitMin: Math.round((Date.now() - next.createdAt) / 60000) });
  const log = pushLog(next.code + ' chamada · Balcão ' + cn);
  broadcast({ action: 'called', ticketId: next.id, counter: cn });
  res.json({ ticket: next, log, message: next.code + ' chamada para o Balcão ' + cn + '.' });
});

app.post('/api/tickets/:id/call', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const t = store.tickets.find(x => x.id === id);
  if (!t) return res.status(404).json({ error: 'Ticket não encontrado.' });
  if (t.status !== 'waiting') return res.status(409).json({ error: 'Ticket não está na fila.' });
  const cn = freeCounter();
  if (!cn) return res.status(409).json({ error: 'Todos os balcões estão ocupados.' });

  t.status = 'calling';
  t.counter = cn;
  t.calledAt = Date.now();
  store.lastCalled = id;
  recordEvent('called', { waitMin: Math.round((Date.now() - t.createdAt) / 60000) });
  pushLog(t.code + ' chamada · Balcão ' + cn);
  broadcast({ action: 'called', ticketId: id, counter: cn });
  res.json({ ticket: t });
});

app.post('/api/tickets/:id/finish', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const t = store.tickets.find(x => x.id === id);
  if (!t) return res.status(404).json({ error: 'Ticket não encontrado.' });
  if (t.status !== 'calling') return res.status(409).json({ error: 'Ticket não está sendo chamado.' });

  pushLog(t.code + ' atendida · Balcão ' + t.counter);
  t.status = 'served';
  store.servedToday++;
  recordEvent('served', {
    serviceMin: t.calledAt ? Math.round((Date.now() - t.calledAt) / 60000) : null,
    counter: t.counter,
  });
  broadcast({ action: 'finished', ticketId: id });
  res.json({ ticket: t });
});

app.post('/api/tickets/:id/recall', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const t = store.tickets.find(x => x.id === id);
  if (!t) return res.status(404).json({ error: 'Ticket não encontrado.' });
  if (t.status !== 'calling') return res.status(409).json({ error: 'Ticket não está sendo chamado.' });

  store.lastCalled = id;
  pushLog(t.code + ' rechamada · Balcão ' + t.counter);
  broadcast({ action: 'recalled', ticketId: id });
  res.json({ ticket: t, message: 'Rechamando ' + t.code + '.' });
});

app.post('/api/tickets/:id/absent', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const t = store.tickets.find(x => x.id === id);
  if (!t) return res.status(404).json({ error: 'Ticket não encontrado.' });
  if (t.status !== 'waiting') return res.status(409).json({ error: 'Ticket não está na fila.' });

  t.status = 'absent';
  t.counter = null;
  recordEvent('absent', {});
  pushLog(t.code + ' marcada como ausente');
  broadcast({ action: 'absent', ticketId: id });
  res.json({ ticket: t });
});

app.post('/api/tickets', (req, res) => {
  const { name, source } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });

  const id = store.nextId++;
  const code = 'M-' + String(id).padStart(3, '0');
  const ticket = {
    id,
    code,
    name,
    status: 'waiting',
    counter: null,
    waitMin: 0,
    source: source || 'qr',
    createdAt: Date.now(),
  };
  store.tickets.push(ticket);
  recordEvent('joined', { source: ticket.source });
  pushLog(code + ' entrou na fila');
  broadcast({ action: 'joined', ticketId: id });
  res.status(201).json({ ticket });
});

// --------------- Start ---------------

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Fila Virtual API running on port ${PORT}`);
  console.log(`WebSocket available at ws://0.0.0.0:${PORT}/ws`);
});
