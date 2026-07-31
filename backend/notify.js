// E-mails transacionais e eventos de funil.
// Sem SMTP configurado, o e-mail vai para o log — o fluxo continua testavel e
// nada trava se o provedor de e-mail cair.
const MAIL_FROM = process.env.MAIL_FROM || 'Fila Virtual <nao-responda@fila.app>';
const MAIL_ENABLED = process.env.MAIL_ENABLED === 'true';

const TEMPLATES = {
  venue_created: (v) => ({
    subject: `${v.name}: sua fila está no ar`,
    body: [
      `Olá! A fila de ${v.name} já está funcionando.`,
      `Seu teste grátis vale por ${v.trialDays} dias, com todos os recursos liberados.`,
      `Imprima o QR do balcão e abra o painel do operador para começar.`,
    ].join('\n'),
  }),
  trial_ending: (v) => ({
    subject: `${v.name}: seu teste termina em ${v.trialDaysLeft} dia(s)`,
    body: [
      `Seu teste grátis termina em ${v.trialDaysLeft} dia(s).`,
      `Depois disso a fila continua funcionando no plano gratuito, com limite diário de entradas e um balcão.`,
      `Para manter tudo liberado, assine o plano premium por ${v.priceLabel} por mês.`,
    ].join('\n'),
  }),
  trial_ended: (v) => ({
    subject: `${v.name}: seu teste grátis terminou`,
    body: [
      `O teste grátis terminou e a fila voltou para o plano gratuito.`,
      `Ela continua no ar, agora com limite diário de entradas e um balcão.`,
      `Assine o premium por ${v.priceLabel} por mês para liberar de novo.`,
    ].join('\n'),
  }),
  premium_started: (v) => ({
    subject: `${v.name}: assinatura confirmada`,
    body: [
      `Pagamento confirmado — o plano premium está ativo.`,
      `Fila sem limite diário, todos os balcões liberados e sem anúncios.`,
    ].join('\n'),
  }),
  subscription_renewed: (v) => ({
    subject: `${v.name}: assinatura renovada`,
    body: `Recebemos o pagamento deste mês. Nada muda para você — a fila segue no premium.`,
  }),
  payment_failed: (v) => ({
    subject: `${v.name}: não conseguimos confirmar seu pagamento`,
    body: [
      `O pagamento deste mês não foi confirmado.`,
      `A fila continua funcionando por enquanto. Atualize o pagamento para não voltar ao plano gratuito.`,
    ].join('\n'),
  }),
  lead_received: (v) => ({
    subject: 'Recebemos seu contato — Fila Virtual',
    body: [
      `Olá! Recebemos seu interesse na Fila Virtual.`,
      ``,
      `Você não precisa esperar: dá para criar sua fila agora, em um minuto, e sair`,
      `com o QR do balcão pronto para imprimir. São 14 dias com tudo liberado.`,
      ``,
      `${v.signupUrl}`,
      ``,
      `Se preferir conversar antes, é só responder este e-mail.`,
    ].join('\n'),
  }),

  subscription_canceled: (v) => ({
    subject: `${v.name}: assinatura cancelada`,
    body: [
      `Sua assinatura foi cancelada e a fila voltou para o plano gratuito.`,
      `Nada foi apagado: é só assinar de novo para liberar tudo outra vez.`,
    ].join('\n'),
  }),
};

const sent = [];

async function sendEmail(template, venue, extra = {}) {
  const build = TEMPLATES[template];
  if (!build) return null;

  const data = { name: venue.name, ...extra };
  const { subject, body } = build(data);
  const to = venue.contactEmail || '';
  const record = { template, to, subject, at: Date.now(), venue: venue.slug };
  sent.push(record);
  if (sent.length > 200) sent.shift();

  if (!MAIL_ENABLED || !to) {
    console.log(`[email:${template}] para=${to || 'sem-destinatario'} assunto="${subject}"`);
    return record;
  }

  try {
    // SMTP real entra aqui quando MAIL_ENABLED=true. Mantido fora do caminho
    // critico: falha de e-mail nunca derruba o webhook de pagamento.
    const nodemailer = require('nodemailer');
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transport.sendMail({ from: MAIL_FROM, to, subject, text: body });
  } catch (error) {
    console.warn(`[email:${template}] falhou: ${error.message}`);
  }
  return record;
}

// --------------- Eventos de funil ---------------

const events = [];
const MAX_EVENTS = 2000;

function track(name, payload = {}) {
  const event = { name, at: Date.now(), ...payload };
  events.push(event);
  if (events.length > MAX_EVENTS) events.shift();
  return event;
}

function funnelSummary(sinceMs) {
  const from = sinceMs ? Date.now() - sinceMs : 0;
  const counts = {};
  for (const event of events) {
    if (event.at < from) continue;
    counts[event.name] = (counts[event.name] || 0) + 1;
  }
  return { since: from || null, counts, total: events.length };
}

module.exports = { sendEmail, sentEmails: sent, track, funnelSummary, events };
