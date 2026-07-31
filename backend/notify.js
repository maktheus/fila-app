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
const MAX_HISTORICO = 200;

// --------------- Transporte ---------------
//
// Um transporte so, criado uma vez. Criar um por e-mail joga fora o pool de
// conexoes e faz cada envio abrir um handshake TLS novo — com volume, o
// provedor comeca a recusar por rate limit.
let transporte = null;
let estado = { habilitado: MAIL_ENABLED, configurado: false, verificado: null, motivo: '', ultimoErro: null };

function faltando() {
  const faltas = [];
  if (!process.env.SMTP_HOST) faltas.push('SMTP_HOST');
  if (!process.env.MAIL_FROM) faltas.push('MAIL_FROM');
  return faltas;
}

function obterTransporte() {
  if (transporte) return transporte;
  // require aqui dentro para o modulo carregar mesmo sem a dependencia
  // instalada — util em teste, e o erro aparece explicado em vez de derrubar.
  const nodemailer = require('nodemailer');
  transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    // 465 e TLS implicito; 587 e STARTTLS. Errar isso e o motivo mais comum
    // de "conecta mas nao envia".
    secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    pool: true,
    maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS || 3),
    connectionTimeout: Number(process.env.SMTP_TIMEOUT_MS || 15000),
  });
  return transporte;
}

/**
 * Confere a configuracao de SMTP falando com o servidor de verdade.
 *
 * Isto existe porque a falha silenciosa e o pior desfecho aqui: quem liga
 * MAIL_ENABLED e ve o sistema respondendo normalmente assume que os e-mails
 * estao saindo. Se eles nao estiverem, o cliente cria a fila e nunca mais
 * ouve falar da gente — e ninguem descobre por semanas.
 */
async function verificarEmail() {
  if (!MAIL_ENABLED) {
    estado = { habilitado: false, configurado: false, verificado: false, motivo: 'MAIL_ENABLED nao esta true', ultimoErro: null };
    return estado;
  }
  const faltas = faltando();
  if (faltas.length) {
    estado = { habilitado: true, configurado: false, verificado: false, motivo: `faltam: ${faltas.join(', ')}`, ultimoErro: null };
    return estado;
  }
  try {
    await obterTransporte().verify();
    estado = { habilitado: true, configurado: true, verificado: true, motivo: '', ultimoErro: null };
  } catch (erro) {
    const dica = /Cannot find module 'nodemailer'/.test(erro.message)
      ? 'dependencia nodemailer nao instalada — rode npm install'
      : erro.message;
    estado = { habilitado: true, configurado: true, verificado: false, motivo: dica, ultimoErro: dica };
  }
  return estado;
}

function statusEmail() {
  return {
    ...estado,
    remetente: MAIL_FROM,
    host: process.env.SMTP_HOST || '',
    porta: Number(process.env.SMTP_PORT || 587),
    // Historico sem o corpo: assunto e destinatario bastam para diagnosticar,
    // e o corpo pode carregar dado do cliente.
    ultimos: sent.slice(-20).reverse(),
  };
}

// Falha de SMTP costuma ser transitoria (limite momentaneo, conexao caida).
// Uma tentativa so perde o e-mail; tres com espera crescente resolvem a
// maioria sem inventar uma fila persistente.
const TENTATIVAS = Number(process.env.MAIL_RETRIES || 3);

async function entregar(mensagem) {
  let ultimoErro = null;
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      await obterTransporte().sendMail(mensagem);
      return { ok: true, tentativas: tentativa };
    } catch (erro) {
      ultimoErro = erro;
      // 5xx do SMTP e recusa definitiva: insistir so queima reputacao.
      if (erro.responseCode && erro.responseCode >= 500 && erro.responseCode < 600) break;
      if (tentativa < TENTATIVAS) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, tentativa - 1)));
      }
    }
  }
  return { ok: false, erro: ultimoErro };
}

async function sendEmail(template, venue, extra = {}) {
  const build = TEMPLATES[template];
  if (!build) return null;

  const data = { name: venue.name, ...extra };
  const { subject, body } = build(data);
  const to = venue.contactEmail || '';
  const record = { template, to, subject, at: Date.now(), venue: venue.slug, entregue: null };
  sent.push(record);
  if (sent.length > MAX_HISTORICO) sent.shift();

  if (!MAIL_ENABLED || !to) {
    record.entregue = false;
    record.motivo = !to ? 'unidade sem e-mail de contato' : 'MAIL_ENABLED desligado';
    console.log(`[email:${template}] para=${to || 'sem-destinatario'} assunto="${subject}" (${record.motivo})`);
    return record;
  }

  // Fora do caminho critico de proposito: falha de e-mail nunca pode derrubar
  // o webhook de pagamento nem a criacao de uma unidade.
  const r = await entregar({ from: MAIL_FROM, to, subject, text: body });
  record.entregue = r.ok;
  if (r.ok) {
    record.tentativas = r.tentativas;
  } else {
    record.motivo = (r.erro && r.erro.message) || 'falha desconhecida';
    estado.ultimoErro = record.motivo;
    console.warn(`[email:${template}] nao entregue para ${to}: ${record.motivo}`);
  }
  return record;
}

// Envio de teste, para conferir a configuracao sem esperar um evento real.
async function enviarTeste(destino) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(destino || ''))) {
    return { ok: false, erro: 'E-mail de destino invalido.' };
  }
  if (!MAIL_ENABLED) return { ok: false, erro: 'MAIL_ENABLED nao esta true.' };
  const faltas = faltando();
  if (faltas.length) return { ok: false, erro: `Faltam variaveis: ${faltas.join(', ')}` };

  const r = await entregar({
    from: MAIL_FROM,
    to: destino,
    subject: 'Fila Virtual: teste de envio',
    text: [
      'Se você está lendo isto, o envio de e-mail está funcionando.',
      '',
      'Confira também se caiu na caixa de entrada e não no spam — se caiu no spam,',
      'faltam SPF, DKIM ou DMARC no domínio, e o efeito prático é o mesmo de não enviar.',
    ].join('\n'),
  });
  if (!r.ok) return { ok: false, erro: (r.erro && r.erro.message) || 'falha desconhecida' };
  return { ok: true, tentativas: r.tentativas, destino };
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

module.exports = {
  sendEmail,
  sentEmails: sent,
  verificarEmail,
  statusEmail,
  enviarTeste,
  TEMPLATES,
  track,
  funnelSummary,
  events,
};
