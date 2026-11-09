// Nucleo da prospeccao: CNPJ, elegibilidade e pontuacao. Funcoes puras.
//
// Os testes de elegibilidade existem por um motivo: a nota nunca pode liberar
// um contato que a regra bloqueou. Se isso falhar, a ferramenta vira spam.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { validarCnpj } = require('../prospeccao/cnpj');
const { avaliarElegibilidade, pontuar, ESTADOS, PESOS, hashValor } = require('../prospeccao/elegibilidade');

describe('validarCnpj', () => {
  test('aceita CNPJ com digitos verificadores corretos, com ou sem pontuacao', () => {
    assert.strictEqual(validarCnpj('11.222.333/0001-81').valido, true);
    assert.strictEqual(validarCnpj('11222333000181').valido, true);
    assert.strictEqual(validarCnpj('11222333000181').cnpj, '11222333000181');
  });

  test('recusa digito verificador errado', () => {
    const r = validarCnpj('11222333000182');
    assert.strictEqual(r.valido, false);
    assert.match(r.motivo, /verificador/);
  });

  test('recusa CPF: nao guardamos dado de pessoa fisica como prospect', () => {
    const r = validarCnpj('123.456.789-09');
    assert.strictEqual(r.valido, false);
    assert.match(r.motivo, /CPF/);
  });

  test('recusa tamanho errado e entrada vazia', () => {
    assert.strictEqual(validarCnpj('1234').valido, false);
    assert.strictEqual(validarCnpj('').valido, false);
    assert.strictEqual(validarCnpj(null).valido, false);
  });

  test('recusa sequencia de digitos iguais', () => {
    assert.strictEqual(validarCnpj('00000000000000').valido, false);
  });
});

describe('avaliarElegibilidade', () => {
  const ativa = { cnpj: '11222333000181', situacao: 'ATIVA', email: 'contato@clinica.com.br' };

  test('empresa ativa com contato corporativo e elegivel', () => {
    assert.strictEqual(avaliarElegibilidade(ativa).elegibilidade, ESTADOS.ELIGIBLE);
  });

  test('suprimido vence qualquer outra condicao, mesmo com nota maxima', () => {
    const ctx = { suprimidos: new Set([hashValor('11222333000181')]) };
    const r = avaliarElegibilidade(ativa, ctx);
    assert.strictEqual(r.elegibilidade, ESTADOS.SUPPRESSED);
  });

  test('e-mail suprimido tambem bloqueia', () => {
    const ctx = { suprimidos: new Set([hashValor('contato@clinica.com.br')]) };
    assert.strictEqual(avaliarElegibilidade(ativa, ctx).elegibilidade, ESTADOS.SUPPRESSED);
  });

  test('empresa baixada ou inapta nao recebe contato', () => {
    const baixada = { ...ativa, situacao: 'BAIXADA' };
    assert.strictEqual(avaliarElegibilidade(baixada).elegibilidade, ESTADOS.SUPPRESSED);
  });

  test('e-mail pessoal exige consentimento, nao e tratado como B2B', () => {
    const pessoal = { ...ativa, email: 'maria@gmail.com' };
    assert.strictEqual(avaliarElegibilidade(pessoal).elegibilidade, ESTADOS.CONSENT_REQUIRED);
  });

  test('sem nenhum canal de contato, o estado e UNKNOWN', () => {
    const sem = { ...ativa, email: null };
    assert.strictEqual(avaliarElegibilidade(sem).elegibilidade, ESTADOS.UNKNOWN);
  });

  test('suprimido tem precedencia sobre consentimento', () => {
    const pessoalSuprimido = { ...ativa, email: 'maria@gmail.com' };
    const ctx = { suprimidos: new Set([hashValor('11222333000181')]) };
    assert.strictEqual(avaliarElegibilidade(pessoalSuprimido, ctx).elegibilidade, ESTADOS.SUPPRESSED);
  });

  test('o motivo vem junto da decisao', () => {
    const r = avaliarElegibilidade({ ...ativa, situacao: 'INAPTA' });
    assert.ok(r.motivos.length > 0);
    assert.match(r.motivos[0], /INAPTA/);
  });
});

describe('pontuar', () => {
  const oferta = { segmentos: ['8630', '9602'], area_uf: ['SC'] };
  const otimo = { cnae: '8630501', situacao: 'ATIVA', email: 'contato@clinica.com.br', uf: 'SC' };

  test('prospect que encaixa em tudo recebe a nota maxima', () => {
    const r = pontuar(otimo, oferta);
    assert.strictEqual(r.score, 100);
    assert.strictEqual(r.motivos.length, 4);
  });

  test('cada criterio tem motivo legivel, e a soma bate com a nota', () => {
    const r = pontuar({ ...otimo, uf: 'RS' }, oferta);
    const soma = r.motivos.reduce((acc, m) => acc + m.pontos, 0);
    assert.strictEqual(soma, r.score);
    const area = r.motivos.find(m => m.criterio === 'area');
    assert.strictEqual(area.pontos, 0);
    assert.match(area.motivo, /Fora da área/);
  });

  test('a nota vai de 0 a 100 em qualquer combinacao', () => {
    const combinacoes = [
      {}, { cnae: '1234567' }, { email: 'a@gmail.com' }, { situacao: 'BAIXADA' }, otimo,
    ];
    for (const p of combinacoes) {
      const { score } = pontuar(p, oferta);
      assert.ok(score >= 0 && score <= 100, `fora da faixa: ${score}`);
    }
  });

  test('pesos somam 100', () => {
    const total = Object.values(PESOS).reduce((a, b) => a + b, 0);
    assert.strictEqual(total, 100);
  });

  test('sem oferta configurada, segmento e area nao pontuam', () => {
    const r = pontuar(otimo, {});
    assert.strictEqual(r.motivos.find(m => m.criterio === 'segmento').pontos, 0);
    assert.strictEqual(r.motivos.find(m => m.criterio === 'area').pontos, 0);
  });
});

describe('invariante: a nota nunca altera a elegibilidade', () => {
  test('um prospect suprimido continua suprimido com nota 100', () => {
    const p = { cnpj: '11222333000181', cnae: '8630501', situacao: 'ATIVA', email: 'c@clinica.com.br', uf: 'SC' };
    const ctx = { suprimidos: new Set([hashValor(p.cnpj)]) };
    const nota = pontuar(p, { segmentos: ['8630'], area_uf: ['SC'] }).score;
    assert.strictEqual(nota, 100);
    assert.strictEqual(avaliarElegibilidade(p, ctx).elegibilidade, ESTADOS.SUPPRESSED);
  });
});
