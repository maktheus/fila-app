// Rotas da prospeccao. Uso do dono do sistema: montadas atras de
// requireAnalyticsAuth no server.js.
//
// Minimizacao: so entram os campos abaixo. O que vier a mais no corpo e
// descartado sem ser guardado.

const express = require('express');
const { validarCnpj } = require('./cnpj');
const { avaliarElegibilidade, pontuar, emailPessoal } = require('./elegibilidade');

const UFS = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]);

const SITUACOES = new Set(['ATIVA', 'SUSPENSA', 'INAPTA', 'BAIXADA', 'NULA']);

function texto(v, max) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

// Valida a oferta. Segmentos sao prefixos de CNAE (2 a 7 digitos).
function validarOferta(corpo) {
  const erros = [];
  const nome = texto(corpo.nome, 120);
  if (!nome || nome.length < 3) erros.push('nome precisa ter pelo menos 3 caracteres');

  const segmentos = Array.isArray(corpo.segmentos) ? corpo.segmentos.map(s => String(s).trim()) : null;
  if (!segmentos) erros.push('segmentos precisa ser uma lista de prefixos de CNAE');
  else if (segmentos.some(s => !/^\d{2,7}$/.test(s))) erros.push('cada segmento precisa ser de 2 a 7 digitos (prefixo de CNAE)');

  const area = Array.isArray(corpo.area_uf) ? corpo.area_uf.map(u => String(u).trim().toUpperCase()) : [];
  if (area.some(u => !UFS.has(u))) erros.push('area_uf tem uma UF invalida');

  return { erros, valor: { nome, segmentos: segmentos || [], area_uf: area } };
}

// Valida um prospect vindo de entrada manual. Retorna { erros, valor }.
function validarProspect(corpo) {
  const erros = [];
  const cnpj = validarCnpj(corpo.cnpj);
  if (!cnpj.valido) erros.push(cnpj.motivo);

  const email = texto(corpo.email, 160);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) erros.push('e-mail invalido');

  const uf = texto(corpo.uf, 2);
  if (uf && !UFS.has(uf.toUpperCase())) erros.push('UF invalida');

  const situacao = texto(corpo.situacao, 20);
  if (situacao && !SITUACOES.has(situacao.toUpperCase())) erros.push('situacao cadastral invalida');

  const cnae = texto(corpo.cnae, 10);
  if (cnae && !/^\d{7}$/.test(cnae.replace(/\D/g, ''))) erros.push('CNAE precisa ter 7 digitos');

  return {
    erros,
    valor: {
      cnpj: cnpj.cnpj,
      razaoSocial: texto(corpo.razaoSocial, 160),
      cnae: cnae ? cnae.replace(/\D/g, '') : null,
      municipio: texto(corpo.municipio, 80),
      uf: uf ? uf.toUpperCase() : null,
      porte: texto(corpo.porte, 20),
      situacao: situacao ? situacao.toUpperCase() : null,
      email: email ? email.toLowerCase() : null,
    },
  };
}

function criarRouter({ repo = require('./repo'), temBanco = () => !!process.env.DATABASE_URL } = {}) {
  const router = express.Router();

  // Sem Postgres, nada aqui funciona: 503 explicito, nunca gravacao silenciosa.
  router.use((req, res, next) => {
    if (!temBanco()) {
      return res.status(503).json({ error: 'Prospeccao precisa de Postgres (DATABASE_URL).' });
    }
    next();
  });

  router.get('/oferta', async (_req, res) => {
    try {
      res.json({ oferta: await repo.obterOferta() });
    } catch (e) {
      res.status(500).json({ error: 'Nao consegui ler a oferta.' });
    }
  });

  router.put('/oferta', async (req, res) => {
    const { erros, valor } = validarOferta(req.body || {});
    if (erros.length) return res.status(400).json({ error: erros.join('; ') });
    try {
      res.json({ oferta: await repo.salvarOferta(valor) });
    } catch (e) {
      res.status(500).json({ error: 'Nao consegui salvar a oferta.' });
    }
  });

  router.get('/prospects', async (req, res) => {
    try {
      res.json({ prospects: await repo.listarProspects({ limite: Number(req.query.limite) || 100 }) });
    } catch (e) {
      res.status(500).json({ error: 'Nao consegui listar os prospects.' });
    }
  });

  router.post('/prospects', async (req, res) => {
    const { erros, valor } = validarProspect(req.body || {});
    if (erros.length) return res.status(400).json({ error: erros.join('; ') });
    try {
      const oferta = await repo.obterOferta();
      const suprimidos = await repo.hashesSuprimidos();
      const elegibilidade = avaliarElegibilidade(valor, { suprimidos });
      const nota = pontuar(valor, oferta || {});
      const salvo = await repo.salvarProspect({
        ...valor,
        score: nota.score,
        motivos: nota.motivos,
        elegibilidade: elegibilidade.elegibilidade,
        motivosElegibilidade: elegibilidade.motivos,
      });
      res.status(201).json({ prospect: salvo, contatoPessoal: emailPessoal(valor.email) });
    } catch (e) {
      res.status(500).json({ error: 'Nao consegui salvar o prospect.' });
    }
  });

  return router;
}

module.exports = { criarRouter, validarProspect, validarOferta, UFS };
