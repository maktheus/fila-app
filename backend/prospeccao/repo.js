// Persistencia da prospeccao. Postgres apenas: sem DATABASE_URL, as rotas
// respondem 503 em vez de guardar prospects num lugar que some no restart.
//
// Tudo com SQL parametrizado. Nada de dado de socio: a tabela nao tem essa
// coluna, de proposito.

const db = require('../db');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS prospect_offers (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    segmentos JSONB NOT NULL DEFAULT '[]',
    area_uf JSONB NOT NULL DEFAULT '[]',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS prospects (
    cnpj TEXT PRIMARY KEY,
    razao_social TEXT,
    cnae TEXT,
    municipio TEXT,
    uf TEXT,
    porte TEXT,
    situacao TEXT,
    email TEXT,
    score INTEGER NOT NULL DEFAULT 0,
    score_motivos JSONB NOT NULL DEFAULT '[]',
    elegibilidade TEXT NOT NULL,
    motivos_elegibilidade JSONB NOT NULL DEFAULT '[]',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS prospects_score_idx ON prospects (score DESC);
  CREATE TABLE IF NOT EXISTS prospect_suppression (
    valor_hash TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,
    motivo TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

let schemaPronto = false;
async function garantirSchema() {
  if (schemaPronto) return;
  await db.query(SCHEMA);
  schemaPronto = true;
}

function linha(r) {
  return {
    cnpj: r.cnpj,
    razaoSocial: r.razao_social,
    cnae: r.cnae,
    municipio: r.municipio,
    uf: r.uf,
    porte: r.porte,
    situacao: r.situacao,
    email: r.email,
    score: r.score,
    motivos: r.score_motivos,
    elegibilidade: r.elegibilidade,
    motivosElegibilidade: r.motivos_elegibilidade,
    criadoEm: r.criado_em,
  };
}

async function obterOferta() {
  await garantirSchema();
  const { rows } = await db.query(
    'SELECT id, nome, segmentos, area_uf FROM prospect_offers ORDER BY id DESC LIMIT 1'
  );
  if (!rows.length) return null;
  const r = rows[0];
  return { id: r.id, nome: r.nome, segmentos: r.segmentos, area_uf: r.area_uf };
}

async function salvarOferta({ nome, segmentos, area_uf }) {
  await garantirSchema();
  const { rows } = await db.query(
    'INSERT INTO prospect_offers (nome, segmentos, area_uf) VALUES ($1, $2, $3) RETURNING id',
    [nome, JSON.stringify(segmentos), JSON.stringify(area_uf)]
  );
  return { id: rows[0].id, nome, segmentos, area_uf };
}

async function listarProspects({ limite = 100 } = {}) {
  await garantirSchema();
  const { rows } = await db.query(
    'SELECT * FROM prospects ORDER BY score DESC, criado_em DESC LIMIT $1',
    [Math.min(Math.max(1, limite), 500)]
  );
  return rows.map(linha);
}

async function salvarProspect(p) {
  await garantirSchema();
  const { rows } = await db.query(
    `INSERT INTO prospects
       (cnpj, razao_social, cnae, municipio, uf, porte, situacao, email,
        score, score_motivos, elegibilidade, motivos_elegibilidade)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (cnpj) DO UPDATE SET
       razao_social = EXCLUDED.razao_social, cnae = EXCLUDED.cnae,
       municipio = EXCLUDED.municipio, uf = EXCLUDED.uf, porte = EXCLUDED.porte,
       situacao = EXCLUDED.situacao, email = EXCLUDED.email,
       score = EXCLUDED.score, score_motivos = EXCLUDED.score_motivos,
       elegibilidade = EXCLUDED.elegibilidade,
       motivos_elegibilidade = EXCLUDED.motivos_elegibilidade,
       atualizado_em = now()
     RETURNING *`,
    [
      p.cnpj, p.razaoSocial, p.cnae, p.municipio, p.uf, p.porte, p.situacao, p.email,
      p.score, JSON.stringify(p.motivos), p.elegibilidade, JSON.stringify(p.motivosElegibilidade),
    ]
  );
  return linha(rows[0]);
}

// Conjunto de hashes suprimidos. O elegibilidade.js compara por hash.
async function hashesSuprimidos() {
  await garantirSchema();
  const { rows } = await db.query('SELECT valor_hash FROM prospect_suppression');
  return new Set(rows.map(r => r.valor_hash));
}

module.exports = {
  garantirSchema,
  obterOferta,
  salvarOferta,
  listarProspects,
  salvarProspect,
  hashesSuprimidos,
};
