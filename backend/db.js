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
        CREATE TABLE IF NOT EXISTS venues (
          slug TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          operator_name TEXT NOT NULL,
          qr_token TEXT NOT NULL,
          password_hash TEXT,
          latitude DOUBLE PRECISION,
          longitude DOUBLE PRECISION,
          proximity_radius_meters INT NOT NULL DEFAULT 120,
          counters_total INT NOT NULL DEFAULT 3,
          plan TEXT NOT NULL DEFAULT 'free',
          ads_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          served_today INT NOT NULL DEFAULT 0,
          last_called BIGINT NOT NULL DEFAULT 0,
          next_id BIGINT NOT NULL DEFAULT 1,
          daily_count INT NOT NULL DEFAULT 0,
          daily_date TEXT,
          contact_email TEXT,
          subscription JSONB,
          trial_warned BOOLEAN NOT NULL DEFAULT FALSE,
          trial_ended_notified BOOLEAN NOT NULL DEFAULT FALSE,
          created_at BIGINT NOT NULL
        );
        ALTER TABLE venues ADD COLUMN IF NOT EXISTS contact_email TEXT;
        ALTER TABLE venues ADD COLUMN IF NOT EXISTS subscription JSONB;
        ALTER TABLE venues ADD COLUMN IF NOT EXISTS trial_warned BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE venues ADD COLUMN IF NOT EXISTS trial_ended_notified BOOLEAN NOT NULL DEFAULT FALSE;
        CREATE TABLE IF NOT EXISTS tickets (
          venue_slug TEXT NOT NULL REFERENCES venues(slug) ON DELETE CASCADE,
          id BIGINT NOT NULL,
          code TEXT NOT NULL,
          name TEXT NOT NULL,
          status TEXT NOT NULL,
          counter INT,
          wait_min INT NOT NULL DEFAULT 0,
          source TEXT NOT NULL DEFAULT 'qr',
          created_at BIGINT NOT NULL,
          last_presence_at BIGINT,
          passed_at BIGINT,
          closed_at BIGINT,
          sort_order INT NOT NULL,
          PRIMARY KEY (venue_slug, id)
        );
        CREATE TABLE IF NOT EXISTS queue_log (
          id BIGSERIAL PRIMARY KEY,
          venue_slug TEXT NOT NULL REFERENCES venues(slug) ON DELETE CASCADE,
          t TEXT NOT NULL,
          text TEXT NOT NULL,
          ts BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS tickets_venue_idx ON tickets (venue_slug, sort_order);
        CREATE INDEX IF NOT EXISTS queue_log_venue_idx ON queue_log (venue_slug, ts DESC);
      `);
      return;
    } catch (error) {
      if (attempt === retries) throw error;
      console.warn(`Postgres indisponivel (tentativa ${attempt}/${retries}): ${error.message}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

function rowToVenue(row, tickets, log) {
  return {
    slug: row.slug,
    name: row.name,
    operatorName: row.operator_name,
    qrToken: row.qr_token,
    passwordHash: row.password_hash || '',
    latitude: row.latitude,
    longitude: row.longitude,
    proximityRadiusMeters: row.proximity_radius_meters,
    countersTotal: row.counters_total,
    plan: row.plan,
    adsEnabled: row.ads_enabled,
    servedToday: row.served_today,
    lastCalled: Number(row.last_called),
    nextId: Number(row.next_id),
    dailyCount: row.daily_count,
    dailyDate: row.daily_date || '',
    contactEmail: row.contact_email || '',
    subscription: row.subscription || null,
    trialWarned: !!row.trial_warned,
    trialEndedNotified: !!row.trial_ended_notified,
    createdAt: Number(row.created_at),
    tickets,
    log,
  };
}

// Carrega todas as unidades com suas filas. Retorna null quando o banco
// ainda esta vazio, para o servidor semear a unidade padrao.
async function loadVenues() {
  const client = getPool();
  const venues = await client.query('SELECT * FROM venues ORDER BY created_at ASC');
  if (venues.rowCount === 0) return null;

  const tickets = await client.query('SELECT * FROM tickets ORDER BY venue_slug, sort_order ASC');
  const logs = await client.query('SELECT venue_slug, t, text, ts FROM queue_log ORDER BY ts DESC, id DESC');

  const ticketsBySlug = new Map();
  for (const r of tickets.rows) {
    if (!ticketsBySlug.has(r.venue_slug)) ticketsBySlug.set(r.venue_slug, []);
    ticketsBySlug.get(r.venue_slug).push({
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
      closedAt: r.closed_at ? Number(r.closed_at) : null,
    });
  }

  const logsBySlug = new Map();
  for (const r of logs.rows) {
    if (!logsBySlug.has(r.venue_slug)) logsBySlug.set(r.venue_slug, []);
    const bucket = logsBySlug.get(r.venue_slug);
    if (bucket.length < 20) bucket.push({ t: r.t, text: r.text, ts: Number(r.ts) });
  }

  return venues.rows.map(row =>
    rowToVenue(row, ticketsBySlug.get(row.slug) || [], logsBySlug.get(row.slug) || []));
}

async function saveVenues(venues) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    // tickets e log saem junto pelo ON DELETE CASCADE das FKs
    await client.query('DELETE FROM venues');
    for (const v of venues) {
      await client.query(
        `INSERT INTO venues (slug, name, operator_name, qr_token, password_hash, latitude, longitude,
           proximity_radius_meters, counters_total, plan, ads_enabled, served_today, last_called,
           next_id, daily_count, daily_date, contact_email, subscription, trial_warned,
           trial_ended_notified, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,$21)`,
        [v.slug, v.name, v.operatorName, v.qrToken, v.passwordHash || null, v.latitude, v.longitude,
         v.proximityRadiusMeters, v.countersTotal, v.plan, v.adsEnabled, v.servedToday, v.lastCalled,
         v.nextId, v.dailyCount || 0, v.dailyDate || null, v.contactEmail || null,
         v.subscription ? JSON.stringify(v.subscription) : null,
         !!v.trialWarned, !!v.trialEndedNotified, v.createdAt]
      );
      for (let i = 0; i < v.tickets.length; i++) {
        const t = v.tickets[i];
        await client.query(
          `INSERT INTO tickets (venue_slug, id, code, name, status, counter, wait_min, source,
             created_at, last_presence_at, passed_at, closed_at, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [v.slug, t.id, t.code, t.name, t.status, t.counter, t.waitMin || 0, t.source || 'qr',
           t.createdAt, t.lastPresenceAt || null, t.passedAt || null, t.closedAt || null, i]
        );
      }
      for (const entry of v.log) {
        await client.query(
          'INSERT INTO queue_log (venue_slug, t, text, ts) VALUES ($1,$2,$3,$4)',
          [v.slug, entry.t, entry.text, entry.ts]
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function ping() {
  const started = Date.now();
  await getPool().query('SELECT 1');
  return Date.now() - started;
}

module.exports = { ensureSchema, loadVenues, saveVenues, ping };
