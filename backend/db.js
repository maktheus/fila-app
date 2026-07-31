// Persistência em Postgres. Ativada quando DATABASE_URL está definida;
// sem ela o server.js cai no fallback de arquivo JSON (dev sem Docker).
const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 5),
    });
    pool.on('error', err => console.warn('Postgres pool:', err.message));
  }
  return pool;
}

async function ensureSchema() {
  const retries = Number(process.env.PG_CONNECT_RETRIES || 15);
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await getPool().query(`
        CREATE TABLE IF NOT EXISTS tickets (
          id BIGINT PRIMARY KEY,
          code TEXT NOT NULL,
          name TEXT NOT NULL,
          status TEXT NOT NULL,
          counter INT,
          wait_min INT NOT NULL DEFAULT 0,
          source TEXT NOT NULL DEFAULT 'qr',
          created_at BIGINT NOT NULL,
          last_presence_at BIGINT,
          passed_at BIGINT,
          sort_order INT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS queue_meta (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL
        );
        CREATE TABLE IF NOT EXISTS queue_log (
          id BIGSERIAL PRIMARY KEY,
          t TEXT NOT NULL,
          text TEXT NOT NULL,
          ts BIGINT NOT NULL
        );
      `);
      return;
    } catch (error) {
      if (attempt === retries) throw error;
      console.warn(`Postgres indisponivel (tentativa ${attempt}/${retries}): ${error.message}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function loadStore() {
  const client = getPool();
  const meta = await client.query('SELECT key, value FROM queue_meta');
  if (meta.rowCount === 0) return null;

  const metaMap = Object.fromEntries(meta.rows.map(r => [r.key, r.value]));
  const tickets = await client.query('SELECT * FROM tickets ORDER BY sort_order ASC');
  const log = await client.query('SELECT t, text, ts FROM queue_log ORDER BY ts DESC, id DESC LIMIT 20');

  return {
    servedToday: metaMap.servedToday,
    lastCalled: metaMap.lastCalled,
    nextId: metaMap.nextId,
    tickets: tickets.rows.map(r => ({
      id: Number(r.id),
      code: r.code,
      name: r.name,
      status: r.status,
      counter: r.counter,
      waitMin: r.wait_min,
      source: r.source,
      createdAt: Number(r.created_at),
      lastPresenceAt: r.last_presence_at ? Number(r.last_presence_at) : null,
      passedAt: r.passed_at ? Number(r.passed_at) : null,
    })),
    log: log.rows.map(r => ({ t: r.t, text: r.text, ts: Number(r.ts) })),
  };
}

async function saveStore(snapshot) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE tickets, queue_log');
    for (let i = 0; i < snapshot.tickets.length; i++) {
      const t = snapshot.tickets[i];
      await client.query(
        `INSERT INTO tickets (id, code, name, status, counter, wait_min, source, created_at, last_presence_at, passed_at, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [t.id, t.code, t.name, t.status, t.counter, t.waitMin || 0, t.source || 'qr',
         t.createdAt, t.lastPresenceAt || null, t.passedAt || null, i]
      );
    }
    for (const entry of snapshot.log) {
      await client.query('INSERT INTO queue_log (t, text, ts) VALUES ($1,$2,$3)', [entry.t, entry.text, entry.ts]);
    }
    for (const [key, value] of Object.entries({
      servedToday: snapshot.servedToday,
      lastCalled: snapshot.lastCalled,
      nextId: snapshot.nextId,
    })) {
      await client.query(
        `INSERT INTO queue_meta (key, value) VALUES ($1, $2::jsonb)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, JSON.stringify(value)]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { ensureSchema, loadStore, saveStore };
