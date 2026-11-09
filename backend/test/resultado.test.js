// Cobranca por resultado: a janela de fatura. Estes testes existem porque um
// erro aqui e cobranca errada ou uso de graca, e nenhum dos dois aparece no log.
//
// Invariantes que cada teste confere:
//  - nenhum atendimento e cobrado duas vezes (janelas sao [inicio, fim));
//  - nenhum atendimento some (o uso da tolerancia cai na fatura seguinte);
//  - a migracao nao cobra o ciclo que ja foi pago no preco fixo.

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

const DIA = 86400000;

function carregar(env = {}) {
  Object.assign(process.env, { PAYMENT_PROVIDER: 'sandbox', ...env });
  for (const m of ['../billing', '../outcome', '../payments/sandbox', '../payments/mercadopago']) {
    delete require.cache[require.resolve(m)];
  }
  return require('../billing');
}

// Assinatura por resultado, ativa, com a janela atual de 30 dias.
function ativa(billing, { inicio, dias = 30, atendimentos = [], faturadoAte = null, pagoAntecipado = 0 }) {
  return {
    slug: 'clinica',
    name: 'Clinica',
    subscription: {
      status: 'active',
      modelo: 'resultado',
      interval: 'mensal',
      currentPeriodStart: inicio,
      currentPeriodEnd: inicio + dias * DIA,
      faturadoAte,
      pagoAntecipado,
      atendimentos,
      avisos: {},
      cobrancaDoCiclo: null,
      externalId: null,
      lastEventAt: null,
    },
  };
}

describe('faturaDoVencimento', () => {
  let billing;
  beforeEach(() => { billing = carregar(); });

  test('cobra so os atendimentos da janela, com o minimo como piso', () => {
    const inicio = Date.now() - 30 * DIA;
    const venue = ativa(billing, { inicio, atendimentos: [inicio + DIA, inicio + 2 * DIA] });
    const f = billing.faturaDoVencimento(venue);
    assert.strictEqual(f.atendimentos, 2);
    assert.strictEqual(f.totalCentavos, 2900); // 2 x 12 < minimo
    assert.strictEqual(f.devidoCentavos, 2900);
  });

  test('parte variavel passa do minimo quando o movimento e alto', () => {
    const inicio = Date.now() - 30 * DIA;
    const atendimentos = Array.from({ length: 1000 }, (_, i) => inicio + i * 1000);
    const venue = ativa(billing, { inicio, atendimentos });
    assert.strictEqual(billing.faturaDoVencimento(venue).totalCentavos, 12000);
  });

  test('atendimento antes da janela nao entra na fatura', () => {
    const inicio = Date.now() - 30 * DIA;
    const venue = ativa(billing, { inicio, atendimentos: [inicio - 1, inicio - DIA] });
    assert.strictEqual(billing.faturaDoVencimento(venue).atendimentos, 0);
  });

  test('o adiantamento do primeiro mes e descontado da fatura', () => {
    const inicio = Date.now() - 30 * DIA;
    const venue = ativa(billing, { inicio, atendimentos: [inicio + DIA], pagoAntecipado: 2900 });
    const f = billing.faturaDoVencimento(venue);
    assert.strictEqual(f.totalCentavos, 2900);
    assert.strictEqual(f.devidoCentavos, 0);
  });

  test('adiantamento maior que a fatura nao gera credito negativo', () => {
    const inicio = Date.now() - 30 * DIA;
    const venue = ativa(billing, { inicio, pagoAntecipado: 2900 });
    assert.strictEqual(billing.faturaDoVencimento(venue).devidoCentavos, 0);
  });
});

describe('janela entre faturas (sem cobrar duas vezes, sem perder uso)', () => {
  let billing;
  beforeEach(() => { billing = carregar(); });

  test('atendimento exatamente no fim cai so na janela seguinte', () => {
    const inicio = Date.now() - 30 * DIA;
    const fim = inicio + 30 * DIA;
    const venue = ativa(billing, { inicio, atendimentos: [fim] });
    assert.strictEqual(billing.faturaDoVencimento(venue).atendimentos, 0);
    venue.subscription.faturadoAte = fim;
    venue.subscription.currentPeriodStart = fim;
    venue.subscription.currentPeriodEnd = fim + 30 * DIA;
    assert.strictEqual(billing.faturaDoVencimento(venue).atendimentos, 1);
  });

  test('pagamento atrasado: o uso entre o vencimento e o pagamento vai para a proxima fatura', () => {
    const inicio = Date.now() - 30 * DIA;
    const fim = inicio + 30 * DIA;
    const venue = ativa(billing, { inicio, atendimentos: [inicio + DIA] });
    // Vencimento: fatura emitida com o fim da janela.
    venue.subscription.cobrancaDoCiclo = { fimFaturado: fim, valorCentavos: 2900 };
    // Uso na tolerancia, depois do vencimento e antes do pagamento:
    venue.subscription.atendimentos.push(fim + DIA);
    // Pagamento chega tres dias depois. Quem paga tarde nao perde o uso.
    const agoraPagamento = fim + 3 * DIA;
    billing.avancarJanela(venue.subscription, { fimFaturado: fim, agora: agoraPagamento });

    assert.strictEqual(venue.subscription.faturadoAte, fim);
    assert.strictEqual(billing.faturaDoVencimento(venue).atendimentos, 1, 'o uso da tolerancia deve ser cobrado na proxima');
    assert.strictEqual(venue.subscription.currentPeriodStart, agoraPagamento);
  });

  test('atendimentos ja quitados sao descartados da lista', () => {
    const inicio = Date.now() - 60 * DIA;
    const fim = inicio + 30 * DIA;
    const venue = ativa(billing, { inicio, atendimentos: [inicio + DIA, fim + DIA] });
    billing.avancarJanela(venue.subscription, { fimFaturado: fim, agora: fim + DIA });
    assert.deepStrictEqual(venue.subscription.atendimentos, [fim + DIA]);
  });
});

describe('avancar a janela sem cobranca (uso zero ou coberto)', () => {
  let billing;
  beforeEach(() => { billing = carregar(); });

  test('a janela nova comeca no fim da antiga, sem Pix', () => {
    const inicio = Date.now() - 30 * DIA;
    const fim = inicio + 30 * DIA;
    const venue = ativa(billing, { inicio, pagoAntecipado: 2900 });
    billing.avancarJanela(venue.subscription, { fimFaturado: fim, agora: fim - DIA });
    assert.strictEqual(venue.subscription.currentPeriodStart, fim);
    assert.strictEqual(venue.subscription.pagoAntecipado, 0);
    assert.strictEqual(venue.subscription.cobrancaDoCiclo, null);
  });
});

describe('migracao de assinatura antiga', () => {
  let billing;
  beforeEach(() => { billing = carregar(); });

  test('legado ativo migra e a janela ja paga pelo fixo nao vira fatura', () => {
    const inicio = Date.now() - 27 * DIA;
    const venue = {
      slug: 'antiga',
      subscription: {
        status: 'active', interval: 'mensal',
        currentPeriodStart: inicio, currentPeriodEnd: inicio + 30 * DIA,
        avisos: {}, cobrancaDoCiclo: null,
      },
    };
    assert.strictEqual(billing.modeloDe(venue.subscription), 'fixo');
    assert.strictEqual(billing.migrarParaResultado(venue), true);
    assert.strictEqual(billing.modeloDe(venue.subscription), 'resultado');
    // O ciclo pago ate o fim nao gera fatura: a janela billable esta vazia.
    assert.strictEqual(billing.faturaDoVencimento(venue).devidoCentavos, 0);
  });

  test('migrar duas vezes nao muda nada', () => {
    const venue = { slug: 'x', subscription: { status: 'active', currentPeriodEnd: Date.now() + DIA, currentPeriodStart: Date.now() - DIA, avisos: {}, cobrancaDoCiclo: null } };
    billing.migrarParaResultado(venue);
    const apos = JSON.stringify(venue.subscription);
    assert.strictEqual(billing.migrarParaResultado(venue), false);
    assert.strictEqual(JSON.stringify(venue.subscription), apos);
  });

  test('trial nao migra: nunca foi pago no preco fixo', () => {
    const venue = { slug: 'x', subscription: { status: 'trialing', trialEndsAt: Date.now() + DIA } };
    assert.strictEqual(billing.migrarParaResultado(venue), false);
  });
});

describe('primeiro pagamento (entrada)', () => {
  let billing;
  beforeEach(() => { billing = carregar(); });

  test('o minimo vira adiantamento e a janela comeca agora', () => {
    const venue = { slug: 'nova', contactEmail: '', subscription: { status: 'trialing', trialEndsAt: Date.now() + DIA, atendimentos: [] } };
    const antes = Date.now();
    const r = billing.applyEvent(venue, { type: 'payment.confirmed', id: 'e1' });
    assert.strictEqual(r.email, 'premium_started');
    assert.strictEqual(venue.subscription.status, 'active');
    assert.strictEqual(venue.subscription.modelo, 'resultado');
    assert.strictEqual(venue.subscription.pagoAntecipado, 2900);
    assert.ok(venue.subscription.currentPeriodStart >= antes);
  });

  test('entrada e sempre o minimo, mesmo para quem ja foi legado', () => {
    const venue = { slug: 'volta', subscription: { status: 'canceled', modelo: undefined, currentPeriodEnd: Date.now() - DIA } };
    assert.strictEqual(billing.valorCheckoutResultado(), 2900);
  });
});

describe('registro de atendimento', () => {
  let billing;
  beforeEach(() => { billing = carregar(); });

  test('cada atendimento concluido entra na base da fatura', () => {
    const venue = { slug: 'a', subscription: { status: 'active', modelo: 'resultado', currentPeriodStart: Date.now() - DIA, currentPeriodEnd: Date.now() + DIA, atendimentos: [] } };
    billing.registrarAtendimento(venue, 1000);
    billing.registrarAtendimento(venue, 2000);
    assert.deepStrictEqual(venue.subscription.atendimentos, [1000, 2000]);
  });

  test('sem assinatura, cria o registro ao primeiro atendimento', () => {
    const venue = { slug: 'b' };
    billing.registrarAtendimento(venue, 5);
    assert.deepStrictEqual(venue.subscription.atendimentos, [5]);
  });
});

describe('visao da assinatura', () => {
  let billing;
  beforeEach(() => { billing = carregar(); });

  test('mostra o modelo, o minimo, o uso do periodo e a previsao', () => {
    const inicio = Date.now() - 10 * DIA;
    const venue = ativa(billing, { inicio, atendimentos: Array.from({ length: 500 }, (_, i) => inicio + i) });
    const v = billing.subscriptionView(venue);
    assert.strictEqual(v.modelo, 'resultado');
    assert.strictEqual(v.resultado.minimoLabel, 'R$ 29,00');
    assert.strictEqual(v.resultado.porAtendimentoLabel, 'R$ 0,12');
    assert.strictEqual(v.resultado.usoNoPeriodo, 500);
    assert.strictEqual(v.resultado.previsaoCentavos, 6000);
  });

  test('assinatura legada continua mostrando o modelo fixo', () => {
    const venue = { slug: 'x', subscription: { status: 'active', currentPeriodStart: Date.now() - DIA, currentPeriodEnd: Date.now() + DIA, avisos: {} } };
    assert.strictEqual(billing.subscriptionView(venue).modelo, 'fixo');
  });
});

describe('cancelamento por resultado: fatura final', () => {
  let billing;
  beforeEach(() => { billing = carregar(); });

  function cancelada(fim, agora) {
    const inicio = fim - 30 * DIA;
    return {
      slug: 'cancelou',
      subscription: {
        status: 'canceled', modelo: 'resultado', interval: 'mensal',
        currentPeriodStart: inicio, currentPeriodEnd: fim,
        faturadoAte: inicio, pagoAntecipado: 0,
        atendimentos: [inicio + DIA, inicio + 2 * DIA], avisos: {}, cobrancaDoCiclo: null,
      },
    };
  }

  test('no dia do vencimento, cobra o uso da janela aberta uma unica vez', () => {
    const fim = Date.now() + 12 * 3600 * 1000;
    const venue = cancelada(fim);
    const acao = billing.acaoDoCiclo(venue, Date.now());
    assert.strictEqual(acao.tipo, 'vencimento');
    assert.strictEqual(acao.final, true);
    venue.subscription.avisos.final = Date.now();
    assert.strictEqual(billing.acaoDoCiclo(venue, Date.now()), null);
  });

  test('antes do dia do vencimento nao age', () => {
    const fim = Date.now() + 10 * DIA;
    assert.strictEqual(billing.acaoDoCiclo(cancelada(fim), Date.now()), null);
  });

  test('depois do fim nao cobra: o acesso ja acabou', () => {
    const fim = Date.now() - DIA;
    assert.strictEqual(billing.acaoDoCiclo(cancelada(fim), Date.now()), null);
  });

  test('pagar a fatura final nao abre janela nova nem reativa a assinatura', () => {
    const fim = Date.now() + 2 * 3600 * 1000;
    const venue = cancelada(fim);
    venue.subscription.cobrancaDoCiclo = { fimFaturado: fim, valorCentavos: 2900, final: true };
    const r = billing.applyEvent(venue, { type: 'payment.confirmed', id: 'final-1' });
    assert.strictEqual(venue.subscription.status, 'canceled');
    assert.strictEqual(venue.subscription.currentPeriodEnd, fim);
    assert.strictEqual(venue.subscription.cobrancaDoCiclo, null);
    assert.strictEqual(r.email, null);
  });

  test('cancelamento de legado (preco fixo) continua sem fatura final', () => {
    const fim = Date.now() + 12 * 3600 * 1000;
    const venue = cancelada(fim);
    delete venue.subscription.modelo;
    assert.strictEqual(billing.acaoDoCiclo(venue, Date.now()), null);
  });
});
