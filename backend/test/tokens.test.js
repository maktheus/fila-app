// Links assinados: o unico caminho de cancelamento que funciona sem senha.
//
// Este arquivo existe porque um furo aqui e grave de formas diferentes: um
// token forjado cancela a assinatura de outra pessoa, e um token de
// cancelamento que sirva para excluir apaga o negocio de alguem.

const { test, describe } = require('node:test');
const assert = require('node:assert');

function carregar(env = {}) {
  delete process.env.NODE_ENV;
  delete process.env.LINK_SECRET;
  delete process.env.LINK_TOKEN_TTL_HOURS;
  Object.assign(process.env, env);
  delete require.cache[require.resolve('../tokens')];
  return require('../tokens');
}

const SEGREDO = 'segredo-de-teste-bem-longo-para-hmac';

describe('token assinado', () => {
  test('ida e volta devolve a unidade', () => {
    const t = carregar({ LINK_SECRET: SEGREDO });
    const token = t.gerarToken({ slug: 'clinica-teste', proposito: 'cancelar' });
    const r = t.verificarToken(token, 'cancelar');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.slug, 'clinica-teste');
  });

  test('token adulterado e recusado', () => {
    const t = carregar({ LINK_SECRET: SEGREDO });
    const token = t.gerarToken({ slug: 'clinica-teste', proposito: 'cancelar' });
    const [dados, assinatura] = token.split('.');

    // Troca a unidade mantendo a assinatura: e a tentativa obvia.
    const outro = Buffer.from(JSON.stringify({
      s: 'clinica-da-vitima', p: 'cancelar', e: Date.now() + 3600000,
    })).toString('base64url');
    assert.strictEqual(t.verificarToken(`${outro}.${assinatura}`, 'cancelar').ok, false);

    // Mexe na assinatura.
    assert.strictEqual(t.verificarToken(`${dados}.${assinatura}x`, 'cancelar').ok, false);
    assert.strictEqual(t.verificarToken(`${dados}.`, 'cancelar').ok, false);
    assert.strictEqual(t.verificarToken(dados, 'cancelar').ok, false);
    assert.strictEqual(t.verificarToken('', 'cancelar').ok, false);
    assert.strictEqual(t.verificarToken(null, 'cancelar').ok, false);
  });

  // Poderes diferentes. Excluir e irreversivel; cancelar nao.
  test('token de cancelar nao serve para excluir', () => {
    const t = carregar({ LINK_SECRET: SEGREDO });
    const token = t.gerarToken({ slug: 'clinica-teste', proposito: 'cancelar' });
    const r = t.verificarToken(token, 'excluir');
    assert.strictEqual(r.ok, false);
    assert.match(r.motivo, /nao serve/);
  });

  test('token expirado e recusado', () => {
    const t = carregar({ LINK_SECRET: SEGREDO });
    const token = t.gerarToken({ slug: 'clinica-teste', proposito: 'cancelar', validadeMs: -1000 });
    const r = t.verificarToken(token, 'cancelar');
    assert.strictEqual(r.ok, false);
    assert.match(r.motivo, /expirado/);
  });

  test('segredo diferente nao valida', () => {
    const a = carregar({ LINK_SECRET: SEGREDO });
    const token = a.gerarToken({ slug: 'clinica-teste', proposito: 'cancelar' });
    const b = carregar({ LINK_SECRET: 'outro-segredo-completamente-diferente' });
    assert.strictEqual(b.verificarToken(token, 'cancelar').ok, false);
  });

  // Segredo padrao em codigo aberto nao e segredo: qualquer um geraria tokens
  // validos para qualquer instalacao.
  test('em producao, sem LINK_SECRET, nada e assinado nem aceito', () => {
    const t = carregar({ NODE_ENV: 'production' });
    assert.strictEqual(t.configurado(), false);
    assert.throws(() => t.gerarToken({ slug: 'x', proposito: 'cancelar' }), /LINK_SECRET/);
    assert.strictEqual(t.verificarToken('qualquer.coisa', 'cancelar').ok, false);
  });

  test('fora de producao funciona com segredo efemero', () => {
    const t = carregar({});
    assert.strictEqual(t.configurado(), true);
    const token = t.gerarToken({ slug: 'clinica-teste', proposito: 'cancelar' });
    assert.strictEqual(t.verificarToken(token, 'cancelar').ok, true);
  });

  test('o token nao esconde a unidade, e tudo bem — ele so nao pode ser forjado', () => {
    const t = carregar({ LINK_SECRET: SEGREDO });
    const token = t.gerarToken({ slug: 'clinica-teste', proposito: 'cancelar' });
    const corpo = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
    assert.strictEqual(corpo.s, 'clinica-teste');
    // O que importa e que mexer nisso invalida a assinatura, ja coberto acima.
  });

  // Link de login e diferente dos outros: ele CRIA sessao. Reaproveitar um
  // significa uma sessao a mais para quem pegou o e-mail de alguem.
  test('token de uso unico queima depois de usado', () => {
    const t = carregar({ LINK_SECRET: SEGREDO });
    const token = t.gerarToken({ slug: 'clinica-teste', proposito: 'acesso', usoUnico: true });

    assert.strictEqual(t.verificarToken(token, 'acesso').ok, true);
    t.consumir(token);
    const r = t.verificarToken(token, 'acesso');
    assert.strictEqual(r.ok, false);
    assert.match(r.motivo, /ja usado/);
  });

  test('queimar um token nao afeta os outros', () => {
    const t = carregar({ LINK_SECRET: SEGREDO });
    const a = t.gerarToken({ slug: 'clinica-teste', proposito: 'acesso', usoUnico: true });
    const b = t.gerarToken({ slug: 'clinica-teste', proposito: 'acesso', usoUnico: true });
    t.consumir(a);
    assert.strictEqual(t.verificarToken(a, 'acesso').ok, false);
    assert.strictEqual(t.verificarToken(b, 'acesso').ok, true);
  });

  test('token sem uso unico continua valendo depois de consumir', () => {
    const t = carregar({ LINK_SECRET: SEGREDO });
    const token = t.gerarToken({ slug: 'clinica-teste', proposito: 'cancelar' });
    t.consumir(token);
    // Cancelar e idempotente: nao faz mal repetir, e queimar o link so
    // atrapalharia quem clicou duas vezes.
    assert.strictEqual(t.verificarToken(token, 'cancelar').ok, true);
  });

  test('token de acesso nao serve para cancelar nem excluir', () => {
    const t = carregar({ LINK_SECRET: SEGREDO });
    const token = t.gerarToken({ slug: 'clinica-teste', proposito: 'acesso', usoUnico: true });
    assert.strictEqual(t.verificarToken(token, 'cancelar').ok, false);
    assert.strictEqual(t.verificarToken(token, 'excluir').ok, false);
  });

  test('o link de cancelamento carrega unidade e token', () => {
    const t = carregar({ LINK_SECRET: SEGREDO });
    const link = t.linkDeCancelamento('https://fila.exemplo.com', 'clinica-teste');
    assert.ok(link.startsWith('https://fila.exemplo.com/cancelar.html?'));
    const url = new URL(link);
    assert.strictEqual(url.searchParams.get('venue'), 'clinica-teste');
    assert.strictEqual(t.verificarToken(url.searchParams.get('t'), 'cancelar').ok, true);
  });
});
