// Elegibilidade e pontuacao de prospects. Funcoes puras.
//
// Duas coisas separadas de proposito:
//  - ELEGIBILIDADE: pode ou nao haver contato? Regra deterministica.
//  - PONTUACAO: quao boa e a oportunidade? Explicavel, ponto por ponto.
// A nota nunca muda a elegibilidade. Um prospect com nota 100 e suprimido
// continua suprimido.

const crypto = require('crypto');

const ESTADOS = Object.freeze({
  ELIGIBLE: 'ELIGIBLE',
  CONSENT_REQUIRED: 'CONSENT_REQUIRED',
  SUPPRESSED: 'SUPPRESSED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  UNKNOWN: 'UNKNOWN',
});

// Precedencia: a primeira regra que bate decide. Nao ha excecao.
const PRECEDENCIA = [
  ESTADOS.SUPPRESSED,
  ESTADOS.REVIEW_REQUIRED,
  ESTADOS.CONSENT_REQUIRED,
  ESTADOS.UNKNOWN,
  ESTADOS.ELIGIBLE,
];

// Provedores de e-mail pessoal. Endereco nesses dominios e de pessoa fisica,
// nao de empresa: contato exigiria consentimento, nao interesse legitimo B2B.
const DOMINIOS_PESSOAIS = new Set([
  'gmail.com', 'hotmail.com', 'outlook.com', 'live.com', 'yahoo.com',
  'yahoo.com.br', 'icloud.com', 'bol.com.br', 'uol.com.br', 'terra.com.br',
  'ig.com.br', 'msn.com', 'protonmail.com',
]);

// Hash da chave de supressao. Normaliza para que "Contato@X.com " e
// "contato@x.com" caiam no mesmo registro.
function hashValor(valor) {
  const n = String(valor == null ? '' : valor).trim().toLowerCase();
  return crypto.createHash('sha256').update(n).digest('hex');
}

function dominioDe(email) {
  const m = String(email || '').trim().toLowerCase().match(/@([^@\s]+)$/);
  return m ? m[1] : null;
}

function emailPessoal(email) {
  const d = dominioDe(email);
  return !!d && DOMINIOS_PESSOAIS.has(d);
}

// Avalia um prospect. `ctx.suprimidos` e um Set com CNPJs e e-mails bloqueados.
// Retorna { elegibilidade, motivos[] } com todos os motivos que se aplicam.
function avaliarElegibilidade(prospect, ctx = {}) {
  const suprimidos = ctx.suprimidos || new Set();
  const motivos = { SUPPRESSED: [], REVIEW_REQUIRED: [], CONSENT_REQUIRED: [], UNKNOWN: [], ELIGIBLE: [] };

  // A lista de supressao guarda hashes, nunca o CNPJ ou o e-mail em claro.
  const chaves = [hashValor(prospect.cnpj)];
  if (prospect.email) chaves.push(hashValor(prospect.email));
  if (chaves.some(c => suprimidos.has(c))) {
    motivos.SUPPRESSED.push('Esta empresa ou contato pediu para não receber mensagens.');
  }
  if (prospect.situacao && prospect.situacao !== 'ATIVA') {
    motivos.SUPPRESSED.push(`Situação cadastral "${prospect.situacao}": só contatamos empresas ativas.`);
  }

  if (prospect.email && emailPessoal(prospect.email)) {
    motivos.CONSENT_REQUIRED.push('O contato é de e-mail pessoal. Sem consentimento, não entra.');
  }

  if (!prospect.email) {
    motivos.UNKNOWN.push('Sem canal de contato conhecido.');
  }

  let elegibilidade = ESTADOS.ELIGIBLE;
  for (const estado of PRECEDENCIA) {
    if (motivos[estado].length) { elegibilidade = estado; break; }
  }
  if (elegibilidade === ESTADOS.ELIGIBLE) {
    motivos.ELIGIBLE.push('Empresa ativa com contato corporativo.');
  }
  return { elegibilidade, motivos: motivos[elegibilidade] };
}

// Pontuacao explicavel, 0 a 100. Cada criterio tem peso fixo e um motivo.
const PESOS = Object.freeze({ segmento: 40, situacao: 15, contato: 20, area: 25 });

function pontuar(prospect, oferta = {}) {
  const itens = [];

  const prefixos = (oferta.segmentos || []).map(String);
  const cnae = String(prospect.cnae || '');
  const noSegmento = prefixos.length > 0 && prefixos.some(p => cnae.startsWith(p));
  itens.push({
    criterio: 'segmento',
    pontos: noSegmento ? PESOS.segmento : 0,
    motivo: noSegmento ? 'Atividade (CNAE) está entre os segmentos da oferta' : 'Atividade fora dos segmentos da oferta',
  });

  const ativa = prospect.situacao === 'ATIVA';
  itens.push({
    criterio: 'situacao',
    pontos: ativa ? PESOS.situacao : 0,
    motivo: ativa ? 'Empresa ativa' : 'Empresa não está ativa',
  });

  const corporativo = !!prospect.email && !emailPessoal(prospect.email);
  itens.push({
    criterio: 'contato',
    pontos: corporativo ? PESOS.contato : 0,
    motivo: corporativo ? 'Contato corporativo disponível' : 'Sem contato corporativo',
  });

  const areas = (oferta.area_uf || []).map(u => String(u).toUpperCase());
  const naArea = areas.length > 0 && areas.includes(String(prospect.uf || '').toUpperCase());
  itens.push({
    criterio: 'area',
    pontos: naArea ? PESOS.area : 0,
    motivo: naArea ? 'Dentro da área atendida' : 'Fora da área atendida',
  });

  const total = itens.reduce((acc, i) => acc + i.pontos, 0);
  return { score: Math.min(100, Math.max(0, total)), motivos: itens };
}

module.exports = {
  ESTADOS,
  PRECEDENCIA,
  DOMINIOS_PESSOAIS,
  hashValor,
  emailPessoal,
  avaliarElegibilidade,
  pontuar,
  PESOS,
};
