// Cobranca Pix: adaptador do Mercado Pago, sandbox e a ferramenta do chat.
//
// O que mais importa aqui nao e "o Pix e gerado" — e que ninguem consiga
// mexer no valor, e que a assinatura do webhook seja conferida do jeito que o
// Mercado Pago realmente assina.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const http = require('node:http');

function carregarMP(env) {
  Object.assign(process.env, env);
  delete require.cache[require.resolve('../payments/mercadopago')];
  return require('../payments/mercadopago');
}

async function subirStub(responder) {
  const chamadas = [];
  const servidor = http.createServer((req, res) => {
    let corpo = '';
    req.on('data', p => { corpo += p; });
    req.on('end', () => {
      chamadas.push({
        url: req.url,
        metodo: req.method,
        cabecalhos: req.headers,
        corpo: corpo ? JSON.parse(corpo) : {},
      });
      const saida = responder(chamadas.length);
      res.writeHead(saida.status || 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(saida.corpo));
    });
  });
  await new Promise(r => servidor.listen(0, '127.0.0.1', r));
  return { servidor, chamadas, base: 'http://127.0.0.1:' + servidor.address().port };
}

const ORDEM_OK = {
  corpo: {
    id: 'ORD01TESTE',
    status: 'action_required',
    status_detail: 'waiting_transfer',
    external_reference: 'clinica-teste',
    transactions: {
      payments: [{
        id: 'PAY01',
        payment_method: {
          qr_code: '00020126580014br.gov.bcb.pix0136chave-de-teste5204000053039865802BR6304ABCD',
          qr_code_base64: 'iVBORw0KGgo=',
          ticket_url: 'https://www.mercadopago.com.br/sandbox/payments/PAY01',
        },
      }],
    },
  },
};

describe('adaptador do Mercado Pago', () => {
  test('monta a ordem Pix no formato que a Orders API espera', async () => {
    const { servidor, chamadas, base } = await subirStub(() => ORDEM_OK);
    const mp = carregarMP({ MP_API_BASE: base, MP_ACCESS_TOKEN: 'token-de-teste' });

    const r = await mp.criarCobrancaPix({
      referencia: 'clinica-teste',
      valorCentavos: 9900,
      email: 'dono@clinica.com.br',
      competencia: '2026-07',
    });

    const c = chamadas[0];
    assert.strictEqual(c.url, '/v1/orders');
    assert.strictEqual(c.metodo, 'POST');
    assert.strictEqual(c.cabecalhos.authorization, 'Bearer token-de-teste');
    assert.ok(c.cabecalhos['x-idempotency-key'], 'sem chave de idempotencia o retry duplica a cobranca');

    assert.strictEqual(c.corpo.type, 'online');
    assert.strictEqual(c.corpo.processing_mode, 'automatic');
    assert.strictEqual(c.corpo.total_amount, '99.00');
    assert.strictEqual(c.corpo.external_reference, 'clinica-teste');
    assert.strictEqual(c.corpo.payer.email, 'dono@clinica.com.br');

    const pagamento = c.corpo.transactions.payments[0];
    assert.strictEqual(pagamento.amount, '99.00');
    assert.strictEqual(pagamento.payment_method.id, 'pix');
    assert.strictEqual(pagamento.payment_method.type, 'bank_transfer');

    assert.ok(r.copiaECola.startsWith('00020126'));
    assert.strictEqual(r.externalId, 'ORD01TESTE');
    servidor.close();
  });

  test('a chave de idempotencia repete no mesmo ciclo e muda no seguinte', () => {
    const mp = carregarMP({ MP_ACCESS_TOKEN: 'x' });
    const julho = mp.chaveDeIdempotencia('clinica-teste', '2026-07');
    assert.strictEqual(julho, mp.chaveDeIdempotencia('clinica-teste', '2026-07'));
    assert.notStrictEqual(julho, mp.chaveDeIdempotencia('clinica-teste', '2026-08'));
    assert.notStrictEqual(julho, mp.chaveDeIdempotencia('outra-clinica', '2026-07'));
  });

  test('resposta sem codigo Pix vira erro em vez de cobranca fantasma', async () => {
    const { servidor, base } = await subirStub(() => ({
      corpo: { id: 'ORD02', transactions: { payments: [{ payment_method: {} }] } },
    }));
    const mp = carregarMP({ MP_API_BASE: base, MP_ACCESS_TOKEN: 'x' });
    await assert.rejects(
      () => mp.criarCobrancaPix({ referencia: 'a', valorCentavos: 9900, email: 'a@b.co' }),
      /codigo Pix/,
    );
    servidor.close();
  });

  test('valor invalido nao chega a sair daqui', async () => {
    const mp = carregarMP({ MP_ACCESS_TOKEN: 'x' });
    for (const valor of [0, -100, NaN, undefined]) {
      await assert.rejects(
        () => mp.criarCobrancaPix({ referencia: 'a', valorCentavos: valor, email: 'a@b.co' }),
        /Valor de cobranca invalido/,
      );
    }
  });

  test('erro do MP nao vaza o corpo inteiro no log', async () => {
    const { servidor, base } = await subirStub(() => ({
      status: 400, corpo: { message: 'invalid payer email dono@clinica.com.br' },
    }));
    const mp = carregarMP({ MP_API_BASE: base, MP_ACCESS_TOKEN: 'x' });
    await assert.rejects(
      () => mp.criarCobrancaPix({ referencia: 'a', valorCentavos: 9900, email: 'a@b.co' }),
      /400/,
    );
    servidor.close();
  });

  test('status do MP vira o evento interno certo', () => {
    const mp = carregarMP({ MP_ACCESS_TOKEN: 'x' });
    assert.strictEqual(mp.traduzirStatus('approved'), 'payment.confirmed');
    assert.strictEqual(mp.traduzirStatus('processed', 'accredited'), 'payment.confirmed');
    assert.strictEqual(mp.traduzirStatus('rejected'), 'payment.failed');
    assert.strictEqual(mp.traduzirStatus('cancelled'), 'payment.failed');
    // Pendente nao mexe na assinatura: nem ativa nem suspende.
    assert.strictEqual(mp.traduzirStatus('action_required', 'waiting_transfer'), null);
    assert.strictEqual(mp.traduzirStatus('pending'), null);
  });
});

// O esquema do MP NAO e HMAC sobre o corpo cru — e um manifesto remontado.
// Conferir do jeito errado recusa todo webhook legitimo, e a assinatura paga
// do cliente nunca ativa o premium. Foi assim que o codigo estava.
describe('assinatura do webhook do Mercado Pago', () => {
  const SEGREDO = 'segredo-do-webhook';

  function assinar(dataId, requestId, ts) {
    const manifesto = `id:${dataId};request-id:${requestId};ts:${ts};`;
    return crypto.createHmac('sha256', SEGREDO).update(manifesto).digest('hex');
  }

  test('assinatura correta passa', () => {
    const mp = carregarMP({ MP_WEBHOOK_SECRET: SEGREDO, MP_ACCESS_TOKEN: 'x' });
    const ts = '1800000000';
    const v1 = assinar('12345', 'req-abc', ts);
    const r = mp.verificarAssinatura({
      assinatura: `ts=${ts},v1=${v1}`,
      requestId: 'req-abc',
      dataId: '12345',
    });
    assert.strictEqual(r.ok, true);
  });

  test('corpo trocado com a mesma assinatura nao passa', () => {
    const mp = carregarMP({ MP_WEBHOOK_SECRET: SEGREDO, MP_ACCESS_TOKEN: 'x' });
    const ts = '1800000000';
    const v1 = assinar('12345', 'req-abc', ts);
    const r = mp.verificarAssinatura({
      assinatura: `ts=${ts},v1=${v1}`,
      requestId: 'req-abc',
      dataId: '99999', // outro recurso
    });
    assert.strictEqual(r.ok, false);
  });

  test('id em maiuscula e normalizado, como o MP faz', () => {
    const mp = carregarMP({ MP_WEBHOOK_SECRET: SEGREDO, MP_ACCESS_TOKEN: 'x' });
    const ts = '1800000000';
    const v1 = assinar('ord01teste', 'req-abc', ts);
    const r = mp.verificarAssinatura({
      assinatura: `ts=${ts},v1=${v1}`,
      requestId: 'req-abc',
      dataId: 'ORD01TESTE',
    });
    assert.strictEqual(r.ok, true);
  });

  test('cabecalho malformado e sem segredo sao recusados', () => {
    const mp = carregarMP({ MP_WEBHOOK_SECRET: SEGREDO, MP_ACCESS_TOKEN: 'x' });
    assert.strictEqual(mp.verificarAssinatura({ assinatura: 'lixo', requestId: 'r', dataId: '1' }).ok, false);
    assert.strictEqual(mp.verificarAssinatura({ assinatura: '', requestId: 'r', dataId: '1' }).ok, false);

    const semSegredo = carregarMP({ MP_WEBHOOK_SECRET: '', MP_ACCESS_TOKEN: 'x' });
    assert.strictEqual(
      semSegredo.verificarAssinatura({ assinatura: 'ts=1,v1=abc', requestId: 'r', dataId: '1' }).ok,
      false,
      'sem segredo configurado nada pode passar',
    );
  });

  test('separa ts e v1 do cabecalho com espacos', () => {
    const mp = carregarMP({ MP_WEBHOOK_SECRET: SEGREDO, MP_ACCESS_TOKEN: 'x' });
    const p = mp.partesDaAssinatura('ts=123, v1=abc');
    assert.strictEqual(p.ts, '123');
    assert.strictEqual(p.v1, 'abc');
  });
});

describe('o valor da cobranca nao e negociavel', () => {
  test('billing cobra PRICE_CENTS, ignorando o que vier junto', async () => {
    process.env.PLAN_PRICE_CENTS = '9900';
    process.env.PAYMENT_PROVIDER = 'sandbox';
    delete require.cache[require.resolve('../billing')];
    delete require.cache[require.resolve('../payments/sandbox')];
    const billing = require('../billing');

    const venue = { slug: 'clinica-teste', name: 'Clinica Teste', contactEmail: '' };
    const cobranca = await billing.criarCobrancaPix({
      venue,
      email: 'dono@clinica.com.br',
      // Campos que um atacante tentaria colar no corpo da requisicao:
      valorCentavos: 1,
      amount: 1,
      total_amount: '0.01',
    });

    assert.strictEqual(cobranca.valorCentavos, 9900);
    assert.strictEqual(cobranca.valorLabel, 'R$ 99,00');
  });

  test('e-mail invalido derruba a cobranca antes de falar com o provedor', async () => {
    delete require.cache[require.resolve('../billing')];
    const billing = require('../billing');
    const venue = { slug: 'clinica-teste', name: 'X', contactEmail: '' };
    for (const email of ['', 'nao-e-email', 'a@b', undefined]) {
      await assert.rejects(() => billing.criarCobrancaPix({ venue, email }), /E-mail invalido/);
    }
  });
});

// A pior mentira possivel aqui: dizer que gerou uma cobranca sem ter gerado.
// A pessoa fica esperando um Pix que nao existe e some. O qwen2.5:7b escreveu
// "Ja gerei o Pix... copie esse codigo: [codigo Pix aparece aqui]" sem chamar
// ferramenta nenhuma, e a versao anterior dos guardrails liberou.
describe('o bot nao pode dizer que gerou Pix sem ter gerado', () => {
  const guardrails = require('../chat/guardrails');
  const FATOS = { precoMensal: 99, precoLabel: 'R$ 99,00', diasDeTeste: 14 };

  test('afirmacao sem cobranca criada e barrada', () => {
    for (const frase of [
      'Perfeito! Já gerei o Pix. Copie esse código: [código Pix aparece aqui].',
      'Aqui está o código copia e cola para pagamento.',
      'O Pix está pronto na tela.',
      'Segue o código para você pagar.',
    ]) {
      const r = guardrails.validarSaida(frase, FATOS, { pagamentoGerado: false });
      assert.strictEqual(r.ok, false, frase);
      assert.ok(r.problemas.some(p => /Pix sem cobranca/i.test(p)));
      // A troca precisa ser honesta e oferecer o proximo passo.
      assert.ok(/n[aã]o cheguei a gerar/i.test(r.texto));
    }
  });

  test('a mesma frase passa quando a cobranca existe', () => {
    const r = guardrails.validarSaida(
      'O Pix já apareceu na tela com o valor de R$ 99,00.',
      FATOS,
      { pagamentoGerado: true },
    );
    assert.strictEqual(r.ok, true);
  });

  test('falar de Pix como meio de pagamento nao dispara o alarme', () => {
    for (const frase of [
      'O pagamento é por Pix, sem fidelidade. Quer que eu gere a cobrança?',
      'Aceitamos Pix. Custa R$ 99,00 por mês por unidade.',
    ]) {
      assert.strictEqual(guardrails.validarSaida(frase, FATOS, {}).ok, true, frase);
    }
  });
});

describe('ferramenta de venda do chat', () => {
  test('nao existe parametro de valor no schema', () => {
    delete require.cache[require.resolve('../chat/tools')];
    const tools = require('../chat/tools');
    const def = tools.DEFINICOES.find(d => d.name === 'gerar_pix_da_assinatura');
    assert.ok(def);
    const campos = Object.keys(def.input_schema.properties);
    assert.deepStrictEqual(campos, ['email'], 'so o e-mail entra; valor e unidade nao');
    assert.strictEqual(def.input_schema.additionalProperties, false);
  });

  test('sem unidade na conversa, nao gera cobranca', async () => {
    delete require.cache[require.resolve('../chat/tools')];
    const tools = require('../chat/tools');
    const r = await tools.executar('gerar_pix_da_assinatura', { email: 'a@b.co' }, {});
    assert.ok(r.erro);
    assert.ok(!r.pix_gerado);
  });

  test('e-mail invalido e recusado antes de qualquer chamada', async () => {
    delete require.cache[require.resolve('../chat/tools')];
    const tools = require('../chat/tools');
    const r = await tools.executar('gerar_pix_da_assinatura', { email: 'zzz' }, { unidade: 'clinica-teste' });
    assert.ok(/e-mail v[aá]lido/i.test(r.erro));
  });

  test('slug com acento ou grafia torta e normalizado', () => {
    delete require.cache[require.resolve('../chat/tools')];
    const tools = require('../chat/tools');
    assert.strictEqual(tools.normalizarSlug('Ótica-Fecha-Agora'), 'otica-fecha-agora');
    assert.strictEqual(tools.normalizarSlug('Clínica Bom Retiro'), 'clinica-bom-retiro');
  });
});
