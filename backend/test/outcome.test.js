// Precificacao por resultado. Um erro aqui e cobranca errada no fim do mes,
// entao cada regra de fatura tem teste proprio: minimo, variavel, teto, o
// que nao e cobrado e a validacao de entrada.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const outcome = require('../outcome');

const POLITICA = { minimoCentavos: 2900, porAtendimentoCentavos: 12, tetoCentavos: 24900 };

describe('calcularFatura', () => {
  test('cobra o minimo quando o volume e baixo', () => {
    const f = outcome.calcularFatura(10, POLITICA); // 10 * 12 = 120 < 2900
    assert.strictEqual(f.totalCentavos, 2900);
    assert.strictEqual(f.tetoAplicado, false);
  });

  test('cobra a parte variavel quando ela passa do minimo', () => {
    const f = outcome.calcularFatura(1000, POLITICA); // 1000 * 12 = 12000
    assert.strictEqual(f.variavelCentavos, 12000);
    assert.strictEqual(f.totalCentavos, 12000);
  });

  test('limita no teto e avisa que o teto foi aplicado', () => {
    const f = outcome.calcularFatura(5000, POLITICA); // 60000 > teto 24900
    assert.strictEqual(f.totalCentavos, 24900);
    assert.strictEqual(f.tetoAplicado, true);
  });

  test('zero atendimentos ainda cobra o minimo, nao zero', () => {
    assert.strictEqual(outcome.calcularFatura(0, POLITICA).totalCentavos, 2900);
  });

  test('nunca passa do teto nem fica abaixo do minimo, em qualquer volume', () => {
    for (let n = 0; n <= 4000; n += 37) {
      const { totalCentavos } = outcome.calcularFatura(n, POLITICA);
      assert.ok(totalCentavos >= POLITICA.minimoCentavos, `abaixo do minimo em ${n}`);
      assert.ok(totalCentavos <= POLITICA.tetoCentavos, `acima do teto em ${n}`);
    }
  });

  test('a fatura e monotonica: mais atendimentos nunca custa menos', () => {
    let anterior = -1;
    for (let n = 0; n <= 3000; n++) {
      const atual = outcome.calcularFatura(n, POLITICA).totalCentavos;
      assert.ok(atual >= anterior, `caiu em ${n}`);
      anterior = atual;
    }
  });

  test('rejeita entrada que nao e inteiro nao negativo', () => {
    assert.throws(() => outcome.calcularFatura(-1, POLITICA));
    assert.throws(() => outcome.calcularFatura(1.5, POLITICA));
    assert.throws(() => outcome.calcularFatura('abc', POLITICA));
  });

  test('rejeita politica com teto menor que o minimo', () => {
    assert.throws(() => outcome.calcularFatura(1, { ...POLITICA, tetoCentavos: 100 }));
  });
});

describe('contarAtendimentos', () => {
  const inicio = Date.UTC(2026, 10, 1);
  const fim = Date.UTC(2026, 11, 1);
  const dentro = inicio + 1000;

  test('conta so atendimentos concluidos dentro do periodo', () => {
    const tickets = [
      { status: 'served', closedAt: dentro },
      { status: 'served', closedAt: dentro + 5 },
      { status: 'served', closedAt: fim - 1 },          // ultimo instante do periodo
      { status: 'served', closedAt: fim },              // ja e o proximo periodo
      { status: 'served', closedAt: inicio - 1 },       // periodo anterior
    ];
    assert.strictEqual(outcome.contarAtendimentos(tickets, { inicio, fim }), 3);
  });

  test('nao cobra quem faltou nem quem ainda esta na fila', () => {
    const tickets = [
      { status: 'absent', closedAt: dentro },
      { status: 'waiting', closedAt: null },
      { status: 'calling', closedAt: null },
    ];
    assert.strictEqual(outcome.contarAtendimentos(tickets, { inicio, fim }), 0);
  });

  test('ignora ticket servido sem data de fechamento valida', () => {
    const tickets = [
      { status: 'served', closedAt: null },
      { status: 'served', closedAt: 'nao-e-data' },
      { status: 'served', closedAt: dentro },
    ];
    assert.strictEqual(outcome.contarAtendimentos(tickets, { inicio, fim }), 1);
  });

  test('lista ausente conta zero', () => {
    assert.strictEqual(outcome.contarAtendimentos(undefined, { inicio, fim }), 0);
  });
});

describe('politicaDoEnv', () => {
  test('usa os padroes quando nada e configurado', () => {
    assert.deepStrictEqual(outcome.politicaDoEnv({}), {
      minimoCentavos: 2900,
      porAtendimentoCentavos: 12,
      tetoCentavos: 24900,
    });
  });

  test('aceita sobrescrita por env', () => {
    const p = outcome.politicaDoEnv({ OUTCOME_POR_ATENDIMENTO_CENTAVOS: '20' });
    assert.strictEqual(p.porAtendimentoCentavos, 20);
  });

  test('recusa env com valor que nao e inteiro', () => {
    assert.throws(() => outcome.politicaDoEnv({ OUTCOME_MINIMO_CENTAVOS: 'vinte' }));
  });
});

describe('previsao', () => {
  test('bate com a fatura final para o mesmo volume', () => {
    for (const n of [0, 50, 400, 3000]) {
      assert.strictEqual(
        outcome.previsao(n, POLITICA),
        outcome.calcularFatura(n, POLITICA).totalCentavos,
      );
    }
  });
});
