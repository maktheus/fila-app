// Rotas da prospeccao, com repositorio falso. Testam o contrato HTTP sem
// Postgres: validacao, supressao, minimizacao de dados e o 503 sem banco.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { criarRouter } = require('../prospeccao/rotas');
const { hashValor } = require('../prospeccao/elegibilidade');

function repoFalso({ suprimidos = [] } = {}) {
  const salvos = [];
  let oferta = null;
  return {
    salvos,
    get oferta() { return oferta; },
    async obterOferta() { return oferta; },
    async salvarOferta(o) { oferta = { id: 1, ...o }; return oferta; },
    async listarProspects() { return salvos; },
    async salvarProspect(p) { salvos.push(p); return p; },
    async hashesSuprimidos() { return new Set(suprimidos.map(hashValor)); },
  };
}

async function subir(router) {
  const app = express();
  app.use(express.json());
  app.use('/api/prospeccao', router);
  const servidor = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${servidor.address().port}/api/prospeccao`;
  return { servidor, base };
}

async function chamar(base, metodo, caminho, corpo) {
  const res = await fetch(base + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

describe('sem Postgres', () => {
  let s;
  before(async () => { s = await subir(criarRouter({ repo: repoFalso(), temBanco: () => false })); });
  after(() => s.servidor.close());

  test('responde 503 explicito, nunca grava em silencio', async () => {
    const r = await chamar(s.base, 'POST', '/prospects', { cnpj: '11222333000181' });
    assert.strictEqual(r.status, 503);
    assert.match(r.body.error, /Postgres/);
  });
});

describe('com banco (repositorio falso)', () => {
  let s;
  let repo;
  before(async () => {
    repo = repoFalso({ suprimidos: ['11222333000181'] });
    s = await subir(criarRouter({ repo, temBanco: () => true }));
  });
  after(() => s.servidor.close());

  test('recusa CPF com motivo, sem guardar nada', async () => {
    const before = repo.salvos.length;
    const r = await chamar(s.base, 'POST', '/prospects', { cnpj: '123.456.789-09' });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.error, /CPF/);
    assert.strictEqual(repo.salvos.length, before);
  });

  test('CNPJ suprimido sai SUPPRESSED, e a nota continua calculada', async () => {
    const r = await chamar(s.base, 'POST', '/prospects', {
      cnpj: '11.222.333/0001-81', situacao: 'ATIVA', email: 'contato@clinica.com.br', cnae: '8630501',
    });
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.body.prospect.elegibilidade, 'SUPPRESSED');
    assert.strictEqual(typeof r.body.prospect.score, 'number');
  });

  test('e-mail pessoal marca CONSENT_REQUIRED e avisa na resposta', async () => {
    const r = await chamar(s.base, 'POST', '/prospects', {
      cnpj: '00.000.000/0001-91', situacao: 'ATIVA', email: 'maria@gmail.com',
    });
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.body.prospect.elegibilidade, 'CONSENT_REQUIRED');
    assert.strictEqual(r.body.contatoPessoal, true);
  });

  test('campos fora da lista, como socios, nao sao guardados', async () => {
    await chamar(s.base, 'POST', '/prospects', {
      cnpj: '00.000.000/0001-91', situacao: 'ATIVA', email: 'c@clinica.com.br',
      socios: [{ nome: 'Fulano', cpf: '12345678909' }], cpf: '12345678909',
    });
    const ultimo = repo.salvos[repo.salvos.length - 1];
    assert.strictEqual(ultimo.socios, undefined);
    assert.strictEqual(ultimo.cpf, undefined);
  });

  test('UF e CNAE invalidos sao recusados', async () => {
    const uf = await chamar(s.base, 'POST', '/prospects', { cnpj: '00.000.000/0001-91', uf: 'XX' });
    assert.strictEqual(uf.status, 400);
    const cnae = await chamar(s.base, 'POST', '/prospects', { cnpj: '00.000.000/0001-91', cnae: '12' });
    assert.strictEqual(cnae.status, 400);
  });

  test('oferta com segmento que nao e prefixo de CNAE e recusada', async () => {
    const r = await chamar(s.base, 'PUT', '/oferta', { nome: 'Agendamento', segmentos: ['clinica'], area_uf: ['SC'] });
    assert.strictEqual(r.status, 400);
  });

  test('oferta valida e salva; a nota passa a usar o segmento', async () => {
    const r = await chamar(s.base, 'PUT', '/oferta', { nome: 'Agendamento', segmentos: ['8630'], area_uf: ['sc'] });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(repo.oferta.area_uf, ['SC']);
    const p = await chamar(s.base, 'POST', '/prospects', {
      cnpj: '00.000.000/0001-91', situacao: 'ATIVA', email: 'c@clinica.com.br', cnae: '8630501', uf: 'SC',
    });
    assert.strictEqual(p.body.prospect.score, 100);
  });
});
