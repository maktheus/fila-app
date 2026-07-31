// Base de conhecimento do vendedor + recuperação (RAG).
//
// O corpus é pequeno (alguns milhares de tokens). Para esse tamanho, indexar
// vetores custaria mais em infraestrutura do que rende em precisão — usamos
// recuperação léxica sobre trechos curtos e mandamos os melhores no prompt.
// Quando o corpus crescer (base de ajuda, casos, objeções por segmento), a
// interface `recuperar()` continua a mesma e a implementação vira vetorial.

const TRECHOS = [
  {
    id: 'o-que-e',
    titulo: 'O que é o Fila Virtual',
    texto: `O Fila Virtual substitui a senha de papel e o totem. O cliente escaneia um QR code no balcão, digita o primeiro nome e entra na fila pelo navegador do próprio celular, sem instalar nada. Ele acompanha a posição em tempo real e pode esperar onde quiser. O estabelecimento gerencia as chamadas por um painel e pode exibir um telão na sala de espera.`,
  },
  {
    id: 'planos',
    titulo: 'Planos e preço',
    texto: `Todo estabelecimento novo começa com 14 dias de teste, com tudo liberado e sem pedir cartão. Depois existem dois planos. O gratuito mantém a fila funcionando com limite diário de entradas, um balcão e anúncios. O premium custa R$ 99 por mês por unidade de atendimento: entradas ilimitadas, todos os balcões, sem anúncios, pagamento por Pix e sem fidelidade.`,
  },
  {
    id: 'instalacao',
    titulo: 'O que precisa para começar',
    texto: `Não precisa de totem, impressora térmica, obra ou instalação de aplicativo. Basta um QR code impresso no balcão e um computador ou celular para o painel do operador. O cadastro leva cerca de um minuto e já devolve o QR pronto para imprimir e a senha do painel.`,
  },
  {
    id: 'passar-a-vez',
    titulo: 'Passar a vez',
    texto: `Se o cliente precisa se ausentar, ele toca em "passar a vez" e cede o lugar para as próximas pessoas sem perder o atendimento. Para evitar abuso, o sistema confere se ele continua perto do estabelecimento, por GPS ou relendo o QR do balcão. Quem já é o último da fila recebe um aviso de que não há para quem passar.`,
  },
  {
    id: 'privacidade',
    titulo: 'Privacidade e LGPD',
    texto: `Coletamos apenas o primeiro nome de quem entra na fila, e esse dado é apagado automaticamente poucas horas depois do atendimento. Não pedimos CPF, telefone, e-mail nem qualquer informação de saúde. O telão da sala de espera mostra apenas a senha e o balcão, nunca nomes. A localização usada no "passar a vez" é comparada na hora e não é armazenada.`,
  },
  {
    id: 'segmentos',
    titulo: 'Para quem serve',
    texto: `Clínicas, consultórios, laboratórios, cartórios, barbearias, salões, oficinas e despachantes — qualquer estabelecimento que atenda por ordem de chegada. Funciona igualmente bem para quem tem um balcão só e para quem tem vários.`,
  },
  {
    id: 'multi-unidade',
    titulo: 'Mais de um endereço',
    texto: `Cada unidade de atendimento tem a própria fila, o próprio QR code e o próprio painel, e é cobrada separadamente. Uma rede com três endereços cria três unidades.`,
  },
  {
    id: 'internet',
    titulo: 'Se a internet cair',
    texto: `O Fila Virtual organiza a espera, mas não substitui o atendimento presencial. Se o serviço ficar indisponível, o estabelecimento deve conseguir atender pela ordem de chegada normalmente. Recomendamos sempre ter esse plano B.`,
  },
  {
    id: 'cancelamento',
    titulo: 'Cancelamento',
    texto: `Dá para cancelar quando quiser, sem multa e sem fidelidade. O premium continua valendo até o fim do período já pago e depois a unidade passa ao plano gratuito. Nada é apagado. Compras pela internet também podem ser desfeitas em até 7 dias pelo Código de Defesa do Consumidor.`,
  },
  {
    id: 'sem-celular',
    titulo: 'Cliente sem celular',
    texto: `A recepção continua podendo colocar a pessoa na fila manualmente pelo painel. O QR é o caminho mais rápido, não o único.`,
  },
];

// Palavras curtas e comuns não ajudam a distinguir trecho nenhum.
const VAZIAS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'e', 'ou',
  'que', 'em', 'no', 'na', 'nos', 'nas', 'para', 'por', 'com', 'sem', 'se',
  'meu', 'minha', 'seu', 'sua', 'eu', 'voce', 'você', 'isso', 'como', 'qual',
  'quais', 'quanto', 'quanta', 'tem', 'ter', 'e', 'é', 'ser', 'the', 'of',
]);

function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !VAZIAS.has(t));
}

// Índice invertido com peso por raridade (ideia do IDF), montado uma vez.
const INDICE = (() => {
  const documentos = TRECHOS.map(t => ({
    id: t.id,
    termos: normalizar(t.titulo + ' ' + t.texto),
  }));
  const frequenciaDocumento = new Map();
  for (const doc of documentos) {
    for (const termo of new Set(doc.termos)) {
      frequenciaDocumento.set(termo, (frequenciaDocumento.get(termo) || 0) + 1);
    }
  }
  return { documentos, frequenciaDocumento, total: documentos.length };
})();

function pontuar(termosDaPergunta, doc) {
  let pontos = 0;
  for (const termo of termosDaPergunta) {
    const ocorrencias = doc.termos.filter(t => t === termo).length;
    if (!ocorrencias) continue;
    const df = INDICE.frequenciaDocumento.get(termo) || 1;
    // Termo que aparece em todo trecho quase não distingue nada.
    const raridade = Math.log(1 + INDICE.total / df);
    pontos += Math.min(ocorrencias, 3) * raridade;
  }
  return pontos;
}

/**
 * Devolve os trechos mais relevantes para a pergunta.
 * Quando nada casa, devolve a base do produto — é melhor responder com o
 * essencial do que deixar o modelo sem contexto e inventar.
 */
function recuperar(pergunta, limite = 4) {
  const termos = normalizar(pergunta);
  if (!termos.length) return TRECHOS.filter(t => ['o-que-e', 'planos'].includes(t.id));

  const ranking = INDICE.documentos
    .map(doc => ({ id: doc.id, pontos: pontuar(termos, doc) }))
    .filter(r => r.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, limite);

  if (!ranking.length) return TRECHOS.filter(t => ['o-que-e', 'planos'].includes(t.id));
  return ranking.map(r => TRECHOS.find(t => t.id === r.id));
}

function montarContexto(trechos) {
  return trechos
    .map(t => `<trecho id="${t.id}" titulo="${t.titulo}">\n${t.texto}\n</trecho>`)
    .join('\n\n');
}

module.exports = { TRECHOS, recuperar, montarContexto, normalizar };
