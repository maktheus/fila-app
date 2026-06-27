const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json());

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
};

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

app.post('/api/tickets/call-next', (_req, res) => {
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

app.post('/api/tickets/:id/call', (req, res) => {
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

app.post('/api/tickets/:id/finish', (req, res) => {
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
