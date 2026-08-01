// Envio de e-mail.
//
// O que este arquivo protege nao e "o e-mail sai" — e que a falha nunca seja
// silenciosa. Ligar MAIL_ENABLED e ver o sistema respondendo normalmente
// enquanto nada e entregue e o pior desfecho possivel: o cliente cria a fila,
// nunca mais ouve falar da gente, e so se descobre semanas depois.

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

function carregar(env) {
  for (const chave of ['MAIL_ENABLED', 'MAIL_FROM', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_RETRIES']) {
    delete process.env[chave];
  }
  Object.assign(process.env, env);
  delete require.cache[require.resolve('../notify')];
  return require('../notify');
}

// Trocamos o transporte por um de mentira, para exercitar retentativa e
// recusa definitiva sem depender de servidor SMTP nenhum.
function trocarTransporte(notify, comportamento) {
  const chamadas = [];
  require.cache[require.resolve('nodemailer')] = {
    exports: {
      createTransport() {
        return {
          async sendMail(mensagem) {
            chamadas.push(mensagem);
            const r = comportamento(chamadas.length);
            if (r instanceof Error) throw r;
            return r || { messageId: 'ok' };
          },
          async verify() {
            const r = comportamento(0);
            if (r instanceof Error) throw r;
            return true;
          },
        };
      },
    },
    loaded: true,
    id: require.resolve('nodemailer'),
  };
  return chamadas;
}

describe('estado do envio de e-mail', () => {
  beforeEach(() => { delete require.cache[require.resolve('nodemailer')]; });

  test('sem MAIL_ENABLED o status diz exatamente isso', async () => {
    const notify = carregar({});
    const e = await notify.verificarEmail();
    assert.strictEqual(e.habilitado, false);
    assert.match(e.motivo, /MAIL_ENABLED/);
  });

  test('ligado sem SMTP_HOST aponta a variavel que falta', async () => {
    const notify = carregar({ MAIL_ENABLED: 'true', MAIL_FROM: 'a@b.co' });
    const e = await notify.verificarEmail();
    assert.strictEqual(e.verificado, false);
    assert.match(e.motivo, /SMTP_HOST/);
  });

  test('ligado e verificado devolve pronto', async () => {
    const notify = carregar({ MAIL_ENABLED: 'true', MAIL_FROM: 'a@b.co', SMTP_HOST: 'smtp.exemplo.com' });
    trocarTransporte(notify, () => null);
    const e = await notify.verificarEmail();
    assert.strictEqual(e.verificado, true);
    assert.strictEqual(e.configurado, true);
  });

  test('SMTP recusando a conexao vira motivo legivel, nao excecao', async () => {
    const notify = carregar({ MAIL_ENABLED: 'true', MAIL_FROM: 'a@b.co', SMTP_HOST: 'smtp.exemplo.com' });
    trocarTransporte(notify, () => new Error('ECONNREFUSED 1.2.3.4:587'));
    const e = await notify.verificarEmail();
    assert.strictEqual(e.verificado, false);
    assert.match(e.motivo, /ECONNREFUSED/);
  });

  test('o status nao vaza a senha do SMTP', async () => {
    const notify = carregar({
      MAIL_ENABLED: 'true', MAIL_FROM: 'a@b.co', SMTP_HOST: 'smtp.exemplo.com',
      SMTP_USER: 'usuario', SMTP_PASS: 'senha-secreta-do-smtp',
    });
    trocarTransporte(notify, () => null);
    await notify.verificarEmail();
    assert.ok(!JSON.stringify(notify.statusEmail()).includes('senha-secreta-do-smtp'));
  });
});

describe('entrega', () => {
  beforeEach(() => { delete require.cache[require.resolve('nodemailer')]; });

  const VENUE = { name: 'Clinica Teste', slug: 'clinica-teste', contactEmail: 'dono@clinica.com.br' };

  test('desligado registra no historico dizendo por que nao saiu', async () => {
    const notify = carregar({});
    const r = await notify.sendEmail('venue_created', VENUE, { trialDays: 14 });
    assert.strictEqual(r.entregue, false);
    assert.match(r.motivo, /MAIL_ENABLED/);
  });

  test('unidade sem e-mail de contato nao vira envio fantasma', async () => {
    const notify = carregar({ MAIL_ENABLED: 'true', MAIL_FROM: 'a@b.co', SMTP_HOST: 'smtp.exemplo.com' });
    trocarTransporte(notify, () => null);
    const r = await notify.sendEmail('venue_created', { ...VENUE, contactEmail: '' }, { trialDays: 14 });
    assert.strictEqual(r.entregue, false);
    assert.match(r.motivo, /sem e-mail/);
  });

  test('entrega e marca o historico', async () => {
    const notify = carregar({ MAIL_ENABLED: 'true', MAIL_FROM: 'a@b.co', SMTP_HOST: 'smtp.exemplo.com' });
    const chamadas = trocarTransporte(notify, () => null);
    const r = await notify.sendEmail('premium_started', VENUE, {});
    assert.strictEqual(r.entregue, true);
    assert.strictEqual(chamadas.length, 1);
    assert.strictEqual(chamadas[0].to, 'dono@clinica.com.br');
    assert.ok(chamadas[0].subject.includes('Clinica Teste'));
  });

  // Falha de SMTP costuma ser transitoria. Uma tentativa so perde o e-mail.
  test('falha transitoria e reentregue', async () => {
    const notify = carregar({
      MAIL_ENABLED: 'true', MAIL_FROM: 'a@b.co', SMTP_HOST: 'smtp.exemplo.com', MAIL_RETRIES: '3',
    });
    trocarTransporte(notify, n => (n < 3 ? new Error('conexao caiu') : null));
    const r = await notify.sendEmail('premium_started', VENUE, {});
    assert.strictEqual(r.entregue, true);
    assert.strictEqual(r.tentativas, 3);
  });

  // 5xx e recusa definitiva: insistir so queima reputacao do dominio.
  test('recusa definitiva do servidor nao e reentregue', async () => {
    const notify = carregar({
      MAIL_ENABLED: 'true', MAIL_FROM: 'a@b.co', SMTP_HOST: 'smtp.exemplo.com', MAIL_RETRIES: '3',
    });
    const erro = new Error('550 mailbox unavailable');
    erro.responseCode = 550;
    const chamadas = trocarTransporte(notify, () => erro);
    const r = await notify.sendEmail('premium_started', VENUE, {});
    assert.strictEqual(r.entregue, false);
    assert.strictEqual(chamadas.length, 1, 'nao pode insistir num 5xx');
  });

  test('falha de e-mail nao estoura para quem chamou', async () => {
    const notify = carregar({ MAIL_ENABLED: 'true', MAIL_FROM: 'a@b.co', SMTP_HOST: 'smtp.exemplo.com', MAIL_RETRIES: '1' });
    trocarTransporte(notify, () => new Error('tudo errado'));
    // O webhook de pagamento chama isto. Estourar aqui derrubaria a ativacao
    // de uma assinatura ja paga.
    const r = await notify.sendEmail('premium_started', VENUE, {});
    assert.strictEqual(r.entregue, false);
    assert.ok(r.motivo);
  });
});

describe('envio de teste', () => {
  beforeEach(() => { delete require.cache[require.resolve('nodemailer')]; });

  test('recusa destino invalido antes de tocar no SMTP', async () => {
    const notify = carregar({ MAIL_ENABLED: 'true', MAIL_FROM: 'a@b.co', SMTP_HOST: 'smtp.exemplo.com' });
    for (const destino of ['', 'nao-e-email', 'a@b', undefined]) {
      const r = await notify.enviarTeste(destino);
      assert.strictEqual(r.ok, false);
    }
  });

  test('avisa quando o e-mail esta desligado, em vez de fingir que enviou', async () => {
    const notify = carregar({});
    const r = await notify.enviarTeste('eu@meudominio.com.br');
    assert.strictEqual(r.ok, false);
    assert.match(r.erro, /MAIL_ENABLED/);
  });

  test('envia e o texto lembra de conferir o spam', async () => {
    const notify = carregar({ MAIL_ENABLED: 'true', MAIL_FROM: 'a@b.co', SMTP_HOST: 'smtp.exemplo.com' });
    const chamadas = trocarTransporte(notify, () => null);
    const r = await notify.enviarTeste('eu@meudominio.com.br');
    assert.strictEqual(r.ok, true);
    assert.match(chamadas[0].text, /spam/i);
    assert.match(chamadas[0].text, /SPF|DKIM|DMARC/);
  });
});

describe('conteudo dos templates', () => {
  test('todo template rende assunto e corpo', () => {
    const notify = carregar({});
    for (const [nome, montar] of Object.entries(notify.TEMPLATES)) {
      const r = montar({
        name: 'Clinica Teste', trialDays: 14, trialDaysLeft: 3,
        priceLabel: 'R$ 99,00', signupUrl: 'https://exemplo.com/cadastro.html',
        diasRestantes: 3, diasParaCair: 2, diasDeTolerancia: 3,
        copiaECola: '00020126580014br.gov.bcb.pix', linkCartao: 'https://exemplo.com/assinar.html?venue=x',
      });
      assert.ok(r.subject && r.subject.length > 5, `${nome} sem assunto`);
      assert.ok(r.body && r.body.length > 20, `${nome} sem corpo`);
      // "undefined" no meio do texto e o sintoma classico de campo faltando.
      assert.ok(!/undefined|\[object/.test(r.subject + r.body), `${nome} tem campo nao preenchido`);
    }
  });
});
