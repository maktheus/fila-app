// Precificacao por resultado (outcome as a service).
//
// O cliente nao paga por "ter a fila": paga por atendimento concluido, com um
// minimo mensal que cobre o custo fixo de manter a unidade no ar e um teto que
// impede a conta de crescer sem limite quando o movimento explode.
//
// Funcoes puras, sem I/O e sem relogio escondido: o job de fechamento e os
// testes chamam do mesmo jeito. Valores em centavos inteiros para nao
// arredondar errado em soma de centavos.

// Atendimento concluido = ticket que foi chamado e atendido ('served').
// 'absent' (nao compareceu) e 'waiting' (ainda na fila) NAO sao cobrados:
// cobrar por quem nao foi atendido e o jeito mais rapido de perder confianca.
const STATUS_COBRAVEL = 'served';

function inteiroNaoNegativo(valor, nome) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${nome} precisa ser um inteiro nao negativo`);
  }
  return n;
}

// Politica padrao. Sobrescrita por env para ajustar preco sem republicar codigo.
function politicaDoEnv(env = process.env) {
  return {
    minimoCentavos: inteiroNaoNegativo(env.OUTCOME_MINIMO_CENTAVOS ?? 2900, 'OUTCOME_MINIMO_CENTAVOS'),
    porAtendimentoCentavos: inteiroNaoNegativo(env.OUTCOME_POR_ATENDIMENTO_CENTAVOS ?? 12, 'OUTCOME_POR_ATENDIMENTO_CENTAVOS'),
    tetoCentavos: inteiroNaoNegativo(env.OUTCOME_TETO_CENTAVOS ?? 24900, 'OUTCOME_TETO_CENTAVOS'),
  };
}

// Conta atendimentos concluidos cujo fechamento cai em [inicio, fim).
// Recebe a lista de tickets da unidade no formato do servidor
// ({ status, closedAt }), com closedAt em epoch ms.
function contarAtendimentos(tickets, { inicio, fim }) {
  if (!Array.isArray(tickets)) return 0;
  let n = 0;
  for (const t of tickets) {
    if (t.status !== STATUS_COBRAVEL) continue;
    const quando = Number(t.closedAt);
    if (!Number.isFinite(quando)) continue;
    if (quando >= inicio && quando < fim) n++;
  }
  return n;
}

// Conta atendimentos a partir de uma lista de timestamps (ms) guardada na
// assinatura. E a fonte da fatura: os tickets expiram em 12 horas (LGPD), mas
// a cobranca do mes precisa de todos. Intervalo semiaberto [inicio, fim), para
// que um atendimento caia em exatamente uma janela de cobranca.
function contarMomentos(momentos, { inicio, fim }) {
  if (!Array.isArray(momentos)) return 0;
  let n = 0;
  for (const m of momentos) {
    if (typeof m === 'number' && m >= inicio && m < fim) n++;
  }
  return n;
}

// Fatura do periodo. O total e o maior entre o minimo e a parte variavel,
// limitado pelo teto. Nunca negativo, nunca acima do teto.
function calcularFatura(atendimentos, politica) {
  const n = inteiroNaoNegativo(atendimentos, 'atendimentos');
  const minimo = inteiroNaoNegativo(politica.minimoCentavos, 'minimoCentavos');
  const por = inteiroNaoNegativo(politica.porAtendimentoCentavos, 'porAtendimentoCentavos');
  const teto = inteiroNaoNegativo(politica.tetoCentavos, 'tetoCentavos');
  if (teto < minimo) throw new Error('teto nao pode ser menor que o minimo');

  const variavel = n * por;
  const semTeto = Math.max(minimo, variavel);
  const total = Math.min(semTeto, teto);
  return {
    atendimentos: n,
    minimoCentavos: minimo,
    variavelCentavos: variavel,
    tetoAplicado: semTeto > teto,
    totalCentavos: total,
  };
}

// Previsao para a tela do cliente: quanto o mes custa hoje, ainda que o
// periodo nao tenha fechado. Mesma regra da fatura, para nunca mostrar um
// numero que a cobranca final desmente.
function previsao(atendimentosAteAgora, politica) {
  return calcularFatura(atendimentosAteAgora, politica).totalCentavos;
}

module.exports = {
  STATUS_COBRAVEL,
  politicaDoEnv,
  contarAtendimentos,
  contarMomentos,
  calcularFatura,
  previsao,
};
