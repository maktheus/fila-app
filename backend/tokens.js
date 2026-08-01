// Links assinados para acoes sem senha.
//
// Cancelar tem que ser tao facil quanto contratar — e quem perdeu a senha do
// operador nao entra no painel. Sem um caminho sem senha, cancelar vira uma
// conversa com o dono do produto, que e exatamente o que nao pode acontecer.
//
// O token e autocontido: nada e guardado no servidor, entao reiniciar nao
// invalida link nenhum e nao ha tabela para crescer. Em troca, ele nao e de
// uso unico — o controle e a validade curta e o proposito amarrado.
//
// Tres coisas que este arquivo faz de proposito:
//
// 1. O PROPOSITO entra na assinatura. Um token de cancelamento nao serve para
//    excluir dados, mesmo que alguem troque a URL. Sao poderes diferentes e o
//    de exclusao e irreversivel.
// 2. A comparacao e em tempo constante. Comparar HMAC com === vaza, por
//    tempo, quantos bytes iniciais o atacante acertou.
// 3. Sem segredo configurado em producao, a assinatura e RECUSADA em vez de
//    cair num padrao. Segredo padrao em codigo aberto nao e segredo.

const crypto = require('crypto');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const VALIDADE_PADRAO_MS = Number(process.env.LINK_TOKEN_TTL_HOURS || 72) * 3600 * 1000;

// Fora de producao, um segredo efemero por processo: os links funcionam
// enquanto o servidor estiver de pe e morrem no restart, o que e o
// comportamento certo para desenvolvimento.
const SEGREDO = process.env.LINK_SECRET
  || (IS_PRODUCTION ? '' : crypto.randomBytes(32).toString('hex'));

function configurado() {
  return !!SEGREDO;
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function assinar(corpo) {
  return crypto.createHmac('sha256', SEGREDO).update(corpo).digest('base64url');
}

/**
 * @param {string} slug      unidade a que o token da acesso
 * @param {string} proposito 'cancelar' | 'excluir' | ...
 */
function gerarToken({ slug, proposito, validadeMs }) {
  if (!configurado()) throw new Error('LINK_SECRET nao configurado.');
  if (!slug || !proposito) throw new Error('Token precisa de unidade e proposito.');

  const expiraEm = Date.now() + (Number(validadeMs) || VALIDADE_PADRAO_MS);
  const dados = base64url(JSON.stringify({ s: slug, p: proposito, e: expiraEm }));
  return `${dados}.${assinar(dados)}`;
}

function verificarToken(token, propositoEsperado) {
  if (!configurado()) return { ok: false, motivo: 'LINK_SECRET nao configurado' };

  const partes = String(token || '').split('.');
  if (partes.length !== 2) return { ok: false, motivo: 'formato invalido' };

  const [dados, assinatura] = partes;
  const esperada = assinar(dados);
  const a = Buffer.from(esperada);
  const b = Buffer.from(assinatura);
  // Comprimento diferente ja e invalido, e comparar buffers de tamanhos
  // diferentes com timingSafeEqual estoura.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, motivo: 'assinatura invalida' };
  }

  let corpo;
  try {
    corpo = JSON.parse(Buffer.from(dados, 'base64url').toString('utf8'));
  } catch (e) {
    return { ok: false, motivo: 'corpo ilegivel' };
  }

  if (!corpo.e || Date.now() > corpo.e) return { ok: false, motivo: 'link expirado' };
  // O proposito e conferido DEPOIS da assinatura: assim um token forjado nao
  // consegue nem chegar aqui, e um token legitimo de outro poder e recusado.
  if (corpo.p !== propositoEsperado) return { ok: false, motivo: 'link nao serve para esta acao' };

  return { ok: true, slug: corpo.s, proposito: corpo.p, expiraEm: corpo.e };
}

function linkDeCancelamento(appUrl, slug) {
  const token = gerarToken({ slug, proposito: 'cancelar' });
  return `${appUrl}/cancelar.html?venue=${encodeURIComponent(slug)}&t=${token}`;
}

module.exports = {
  configurado,
  gerarToken,
  verificarToken,
  linkDeCancelamento,
  VALIDADE_PADRAO_MS,
};
