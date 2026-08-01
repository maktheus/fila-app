// Ciclo de cobranca: o calendario de uma assinatura.
//
// `acaoDoCiclo` e pura, entao da para percorrer um ano inteiro em
// milissegundos. Isso importa: bug de calendario so aparece na virada do mes
// ou no fim da tolerancia, e esperar isso acontecer em producao significa
// descobrir com dinheiro de cliente no meio.

const { test, describe } = require('node:test');
const assert = require('node:assert');

function carregar(env = {}) {
  Object.assign(process.env, {
    PLAN_PRICE_CENTS: '9900',
    BILLING_GRACE_DAYS: '3',
    BILLING_NOTICE_DAYS: '3',
    PAYMENT_PROVIDER: 'sandbox',
    ...env,
  });
  delete require.cache[require.resolve('../billing')];
  return require('../billing');
}

const DIA = 86400000;

function assinaturaAtiva(billing, { fim, inicio, ciclo = 'mensal' }) {
  return {
    slug: 'clinica-teste',
    name: 'Clinica Teste',
    subscription: {
      status: 'active',
      interval: ciclo,
      trialEndsAt: null,
      currentPeriodStart: inicio,
      currentPeriodEnd: fim,
      avisos: {},
      externalId: null,
      lastEventAt: null,
    },
  };
}

describe('calendario do ciclo', () => {
  const billing = carregar();
  const INICIO = Date.parse('2026-08-01T10:00:00Z');
  const FIM = billing.somarMeses(INICIO, 1); // 01/09

  test('no meio do ciclo nao faz nada', () => {
    const venue = assinaturaAtiva(billing, { inicio: INICIO, fim: FIM });
    assert.strictEqual(billing.acaoDoCiclo(venue, INICIO + 10 * DIA), null);
  });

  test('tres dias antes emite o aviso previo', () => {
    const venue = assinaturaAtiva(billing, { inicio: INICIO, fim: FIM });
    const acao = billing.acaoDoCiclo(venue, FIM - 3 * DIA + 1000);
    assert.strictEqual(acao.tipo, 'previo');
    assert.strictEqual(acao.diasRestantes, 3);
  });

  test('cada aviso sai uma vez so por ciclo', () => {
    const venue = assinaturaAtiva(billing, { inicio: INICIO, fim: FIM });
    const quando = FIM - 3 * DIA + 1000;
    assert.strictEqual(billing.acaoDoCiclo(venue, quando).tipo, 'previo');
    billing.marcarAviso(venue, 'previo', quando);
    // Sem isto, o job de hora em hora mandaria 72 e-mails no lugar de um.
    assert.strictEqual(billing.acaoDoCiclo(venue, quando + 3600000), null);
    assert.strictEqual(billing.acaoDoCiclo(venue, quando + 12 * 3600000), null);
  });

  test('no dia do vencimento avisa de novo', () => {
    const venue = assinaturaAtiva(billing, { inicio: INICIO, fim: FIM });
    billing.marcarAviso(venue, 'previo', FIM - 3 * DIA);
    const acao = billing.acaoDoCiclo(venue, FIM - 3600000);
    assert.strictEqual(acao.tipo, 'vencimento');
  });

  test('vencido, dentro da tolerancia, avisa quantos dias faltam para cair', () => {
    const venue = assinaturaAtiva(billing, { inicio: INICIO, fim: FIM });
    billing.marcarAviso(venue, 'previo', FIM - 3 * DIA);
    billing.marcarAviso(venue, 'vencimento', FIM - 1000);
    const acao = billing.acaoDoCiclo(venue, FIM + DIA);
    assert.strictEqual(acao.tipo, 'atraso');
    assert.strictEqual(acao.diasParaCair, 2);
  });

  test('passada a tolerancia, rebaixa', () => {
    const venue = assinaturaAtiva(billing, { inicio: INICIO, fim: FIM });
    for (const c of ['previo', 'vencimento', 'atraso']) billing.marcarAviso(venue, c, FIM);
    const acao = billing.acaoDoCiclo(venue, FIM + 3 * DIA + 1000);
    assert.strictEqual(acao.tipo, 'rebaixar');
  });

  test('rebaixar tambem so acontece uma vez', () => {
    const venue = assinaturaAtiva(billing, { inicio: INICIO, fim: FIM });
    const quando = FIM + 4 * DIA;
    billing.marcarAviso(venue, 'rebaixado', quando);
    assert.strictEqual(billing.acaoDoCiclo(venue, quando + DIA), null);
  });

  test('renovar zera os avisos e o calendario recomeca', () => {
    const venue = assinaturaAtiva(billing, { inicio: INICIO, fim: FIM });
    for (const c of ['previo', 'vencimento']) billing.marcarAviso(venue, c, FIM);

    billing.applyEvent(venue, { type: 'payment.confirmed', id: 'p1' });

    assert.deepStrictEqual(venue.subscription.avisos, {});
    // Comeca um ciclo novo, entao nada a fazer logo apos renovar.
    assert.strictEqual(billing.acaoDoCiclo(venue, Date.now()), null);
  });

  test('trial e assinatura cancelada ficam fora do ciclo de cobranca', () => {
    const emTrial = { slug: 'x', name: 'X', subscription: { status: 'trialing', trialEndsAt: Date.now() + DIA } };
    assert.strictEqual(billing.acaoDoCiclo(emTrial, Date.now()), null);

    const cancelada = assinaturaAtiva(billing, { inicio: INICIO, fim: FIM });
    cancelada.subscription.status = 'canceled';
    assert.strictEqual(billing.acaoDoCiclo(cancelada, FIM + 10 * DIA), null);
  });
});

describe('tolerancia e plano efetivo', () => {
  const billing = carregar();
  const INICIO = Date.parse('2026-08-01T10:00:00Z');

  test('vencida mas dentro da tolerancia continua premium', () => {
    const venue = assinaturaAtiva(billing, { inicio: INICIO, fim: Date.now() - DIA });
    assert.strictEqual(billing.effectivePlan(venue), 'premium');
  });

  test('passada a tolerancia cai para o gratuito', () => {
    const venue = assinaturaAtiva(billing, { inicio: INICIO, fim: Date.now() - 4 * DIA });
    assert.strictEqual(billing.effectivePlan(venue), 'free');
  });

  // O calculo nao pode depender do job ter rodado: container parado, servidor
  // reiniciado, job travado — o plano continua certo porque sai do relogio.
  test('o plano nao depende do job de ciclo ter rodado', () => {
    const venue = assinaturaAtiva(billing, { inicio: INICIO, fim: Date.now() - 10 * DIA });
    venue.subscription.avisos = {}; // nenhum aviso, nenhum rebaixamento aplicado
    assert.strictEqual(billing.effectivePlan(venue), 'free');
  });

  // Quem cancelou pagou pelo ciclo corrente. Cortar antes seria ficar com o
  // dinheiro sem entregar o servico.
  test('cancelada segue premium ate o fim do ciclo pago', () => {
    const venue = assinaturaAtiva(billing, { inicio: INICIO, fim: Date.now() + 10 * DIA });
    venue.subscription.status = 'canceled';
    assert.strictEqual(billing.effectivePlan(venue), 'premium');

    venue.subscription.currentPeriodEnd = Date.now() - 1000;
    assert.strictEqual(billing.effectivePlan(venue), 'free');
  });
});

describe('pagamento e ciclos', () => {
  const billing = carregar();

  test('quem paga adiantado nao perde os dias que faltavam', () => {
    const fimAtual = Date.now() + 5 * DIA;
    const venue = assinaturaAtiva(billing, { inicio: Date.now() - 25 * DIA, fim: fimAtual });

    billing.applyEvent(venue, { type: 'payment.confirmed', id: 'p1' });

    // O ciclo novo comeca onde o antigo terminava, nao "agora".
    assert.strictEqual(venue.subscription.currentPeriodStart, fimAtual);
    const esperado = billing.somarMeses(fimAtual, 1);
    assert.strictEqual(venue.subscription.currentPeriodEnd, esperado);
  });

  test('quem paga atrasado comeca do zero, sem herdar o buraco', () => {
    const venue = assinaturaAtiva(billing, { inicio: Date.now() - 35 * DIA, fim: Date.now() - 2 * DIA });
    const antes = Date.now();

    billing.applyEvent(venue, { type: 'payment.confirmed', id: 'p1' });

    assert.ok(venue.subscription.currentPeriodStart >= antes);
    assert.ok(venue.subscription.currentPeriodEnd > Date.now() + 27 * DIA);
  });

  test('anual da doze meses, nao um', () => {
    const venue = assinaturaAtiva(billing, { inicio: Date.now(), fim: Date.now() });
    venue.subscription.status = 'trialing';

    billing.applyEvent(venue, { type: 'payment.confirmed', id: 'p1', ciclo: 'anual' });

    assert.strictEqual(venue.subscription.interval, 'anual');
    const meses = (venue.subscription.currentPeriodEnd - venue.subscription.currentPeriodStart) / DIA;
    assert.ok(meses > 360 && meses < 370, `esperava ~365 dias, deu ${meses.toFixed(0)}`);
  });

  test('a renovacao mantem o ciclo que a pessoa contratou', () => {
    const venue = assinaturaAtiva(billing, { inicio: Date.now() - 300 * DIA, fim: Date.now() + DIA, ciclo: 'anual' });
    billing.applyEvent(venue, { type: 'payment.confirmed', id: 'p2' });
    assert.strictEqual(venue.subscription.interval, 'anual');
  });

  test('primeiro pagamento e renovacao mandam e-mails diferentes', () => {
    const novo = { slug: 'a', name: 'A', subscription: { status: 'trialing', trialEndsAt: Date.now() } };
    assert.strictEqual(billing.applyEvent(novo, { type: 'payment.confirmed', id: '1' }).email, 'premium_started');

    const renovando = assinaturaAtiva(billing, { inicio: Date.now() - 30 * DIA, fim: Date.now() });
    assert.strictEqual(billing.applyEvent(renovando, { type: 'payment.confirmed', id: '2' }).email, 'subscription_renewed');
  });
});

describe('precos dos ciclos', () => {
  const billing = carregar();

  test('anual custa dez meses, nao doze', () => {
    assert.strictEqual(billing.precoDoCiclo('anual'), billing.PRICE_CENTS * 10);
    assert.strictEqual(billing.precoDoCiclo('mensal'), billing.PRICE_CENTS);
  });

  // O ciclo vem do cliente (ele escolhe o plano), o PRECO nao. Um ciclo
  // desconhecido tem que virar mensal, nunca um valor inventado.
  test('ciclo desconhecido cai no mensal em vez de virar preco solto', () => {
    for (const lixo of ['', 'gratis', 'anual; DROP TABLE', null, undefined, 0, {}]) {
      assert.strictEqual(billing.cicloValido(lixo), 'mensal');
      assert.strictEqual(billing.precoDoCiclo(lixo), billing.PRICE_CENTS);
    }
  });

  test('constructor e __proto__ nao viram ciclo valido', () => {
    assert.strictEqual(billing.cicloValido('constructor'), 'mensal');
    assert.strictEqual(billing.cicloValido('__proto__'), 'mensal');
    assert.strictEqual(billing.cicloValido('toString'), 'mensal');
  });
});

describe('virada de mes', () => {
  const billing = carregar();

  test('31 de janeiro nao vira 3 de marco', () => {
    const jan31 = Date.parse('2026-01-31T12:00:00Z');
    assert.strictEqual(new Date(billing.somarMeses(jan31, 1)).getUTCDate(), 28);
  });

  test('assinar dia 31 nao antecipa a cobranca todo mes', () => {
    // Um ano inteiro: nenhum ciclo pode ter menos de 28 dias.
    let atual = Date.parse('2026-01-31T12:00:00Z');
    for (let i = 0; i < 12; i++) {
      const proximo = billing.somarMeses(atual, 1);
      const dias = (proximo - atual) / DIA;
      assert.ok(dias >= 28, `ciclo ${i + 1} teve ${dias.toFixed(1)} dias`);
      atual = proximo;
    }
  });
});
