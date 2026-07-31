// Provedor de mentira, para o fluxo de cobranca ser testavel de ponta a ponta
// sem conta em banco nenhum. Mesma interface do adaptador do Mercado Pago.
//
// O copia-e-cola sai propositalmente marcado como SANDBOX e nao segue o
// formato BR Code do Banco Central: se alguem colar isso num app de banco,
// tem que falhar na hora. Um codigo de teste que quase funciona e pior que um
// que obviamente nao funciona.

const crypto = require('crypto');
const QRCode = require('qrcode');

const EXPIRA_MINUTOS = Number(process.env.SANDBOX_PIX_EXPIRA_MINUTOS || 60);

// Cobrancas em memoria, para o /confirmar do sandbox achar de volta.
const cobrancas = new Map();

function configurado() {
  return true;
}

async function criarCobrancaPix({ referencia, valorCentavos, email, competencia }) {
  const externalId = 'SBX-' + crypto.randomBytes(8).toString('hex').toUpperCase();
  // Sem "R$" de proposito: o BR Code real do Banco Central carrega o valor
  // como campo cru (5405 99.00), sem simbolo de moeda. O guardrail de saida
  // procura "R$" para achar preco em prosa — se o codigo de teste trouxesse o
  // simbolo, ele acusaria preco errado numa resposta certa. Foi o que
  // aconteceu na primeira versao.
  const copiaECola =
    `SANDBOX-NAO-PAGAVEL|${externalId}|${referencia}|5405${(valorCentavos / 100).toFixed(2)}|` +
    `${competencia || new Date().toISOString().slice(0, 7)}`;

  const qrBase64 = (await QRCode.toDataURL(copiaECola, { margin: 1, width: 320 }))
    .replace(/^data:image\/png;base64,/, '');

  const cobranca = {
    externalId,
    pagamentoId: externalId,
    copiaECola,
    qrBase64,
    ticketUrl: null,
    valorCentavos,
    expiraEm: Date.now() + EXPIRA_MINUTOS * 60000,
    status: 'action_required',
    referencia,
    // Guardado so para o /confirmar do sandbox; nunca sai em resposta.
    email,
  };
  cobrancas.set(externalId, cobranca);
  return { ...cobranca, email: undefined };
}

function buscar(externalId) {
  return cobrancas.get(String(externalId)) || null;
}

function esquecer(externalId) {
  cobrancas.delete(String(externalId));
}

module.exports = {
  nome: 'sandbox',
  configurado,
  criarCobrancaPix,
  buscar,
  esquecer,
  EXPIRA_MINUTOS,
};
