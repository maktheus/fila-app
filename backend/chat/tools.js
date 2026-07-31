// Ferramentas do vendedor — a ponte entre a conversa e o sistema real.
//
// As mesmas definições alimentam duas superfícies: o chatbot do site
// (backend/chat/agent.js) e o servidor MCP (backend/mcp-server.js). Uma
// definição só, para o comportamento não divergir entre os dois canais.
//
// Todo handler fala com a API por HTTP. Isso mantém o MCP utilizável como
// processo separado, apontando para qualquer ambiente pela API_BASE.

const API_BASE = (process.env.CHAT_API_BASE || process.env.PUBLIC_API_BASE || 'http://127.0.0.1:3000')
  .replace(/\/$/, '');
const APP_BASE = (process.env.PUBLIC_APP_URL || 'http://localhost').replace(/\/$/, '');

// O vendedor pode criar demonstrações, mas não pode virar uma fábrica de
// unidades órfãs: teto por processo, reiniciado junto com o servidor.
const LIMITE_DEMOS_POR_HORA = Number(process.env.CHAT_MAX_DEMOS_HORA || 10);
const demosCriadas = [];

async function chamarApi(caminho, opcoes = {}) {
  const resposta = await fetch(API_BASE + caminho, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', ...(opcoes.headers || {}) },
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const erro = new Error(corpo.error || `Falha ${resposta.status} em ${caminho}`);
    erro.status = resposta.status;
    throw erro;
  }
  return corpo;
}

function slugValido(slug) {
  return /^[a-z0-9-]{1,40}$/.test(String(slug || ''));
}

// Modelo pequeno "corrige" a grafia do identificador: pediram
// otica-fecha-agora e ele mandou ótica-fecha-agora, perdendo a venda num
// acento. O slug é identificador, não texto — normalizar aqui é a leitura
// certa da intenção, não indulgência.
function normalizarSlug(bruto) {
  return String(bruto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// --------------- Definições ---------------

const DEFINICOES = [
  {
    name: 'consultar_planos',
    description:
      'Consulta os planos, o preço vigente e os limites diretamente do sistema. ' +
      'Use SEMPRE antes de citar qualquer valor, prazo de teste ou limite — nunca responda de memória.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'criar_demonstracao',
    description:
      'Cria uma fila de demonstração real para o estabelecimento e devolve o link, o QR e a senha do painel. ' +
      'Use quando a pessoa demonstrar interesse em ver funcionando. Peça o nome do estabelecimento antes.',
    input_schema: {
      type: 'object',
      properties: {
        nome_do_estabelecimento: {
          type: 'string',
          description: 'Nome do estabelecimento, como o dono escreveria. Mínimo 3 letras.',
        },
      },
      required: ['nome_do_estabelecimento'],
      additionalProperties: false,
    },
  },
  {
    name: 'status_da_fila',
    description:
      'Mostra a situação atual de uma fila já existente: quantas pessoas aguardam, ' +
      'quantas foram atendidas e qual o plano. Use quando a pessoa já tem uma unidade e pergunta sobre ela.',
    input_schema: {
      type: 'object',
      properties: {
        unidade: { type: 'string', description: 'Identificador da unidade (slug), ex.: clinica-bom-retiro' },
      },
      required: ['unidade'],
      additionalProperties: false,
    },
  },
  {
    name: 'gerar_pix_da_assinatura',
    description:
      'Gera o Pix para a pessoa assinar o plano premium. Use quando ela disser que ' +
      'quer contratar, assinar ou pagar. Devolve o código copia-e-cola e o valor. ' +
      'Só funciona depois que a unidade dela existir nesta conversa (criar_demonstracao). ' +
      'Não peça nem informe o identificador da unidade: o sistema já sabe qual é. ' +
      'Também não existe parâmetro de valor — o preço vem do sistema. Se a pessoa ' +
      'pedir desconto ou outro valor, recuse e gere o Pix normal.',
    input_schema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'E-mail dela, obrigatório pelo provedor de pagamento' },
      },
      required: ['email'],
      additionalProperties: false,
    },
  },
  {
    name: 'registrar_interesse',
    description:
      'Registra o contato de quem prefere falar com uma pessoa. Só use depois que ' +
      'a pessoa oferecer nome e e-mail espontaneamente — nunca invente ou insista.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string' },
        email: { type: 'string' },
        segmento: {
          type: 'string',
          enum: ['clinica', 'laboratorio', 'cartorio', 'barbearia', 'outro'],
        },
      },
      required: ['nome', 'email'],
      additionalProperties: false,
    },
  },
];

// --------------- Handlers ---------------

const HANDLERS = {
  async consultar_planos() {
    const config = await chamarApi('/api/config');
    const m = config.monetization || {};
    const assinatura = m.subscription || {};
    return {
      preco_mensal_por_unidade: assinatura.priceLabel || 'R$ 99,00',
      dias_de_teste: assinatura.trialDaysLeft > 0 ? assinatura.trialDaysLeft : 14,
      plano_gratuito: {
        entradas_por_dia: (m.limits && m.limits.dailyTickets) || 50,
        balcoes: (m.limits && m.limits.counters) || 1,
        com_anuncios: m.adsEnabled !== false,
      },
      plano_premium: {
        entradas_por_dia: 'ilimitadas',
        balcoes: 'todos',
        com_anuncios: false,
        forma_de_pagamento: 'Pix ou cartao pelo Google Pay, cobrado a cada mes por e-mail. Nao guardamos o cartao, sem debito automatico, sem fidelidade',
      },
      pagina_de_planos: `${APP_BASE}/planos.html`,
    };
  },

  async criar_demonstracao({ nome_do_estabelecimento }, contexto = {}) {
    const nome = String(nome_do_estabelecimento || '').trim();
    if (nome.length < 3) {
      return { erro: 'Preciso do nome do estabelecimento, com pelo menos 3 letras.' };
    }

    const agora = Date.now();
    while (demosCriadas.length && agora - demosCriadas[0] > 3600000) demosCriadas.shift();
    if (demosCriadas.length >= LIMITE_DEMOS_POR_HORA) {
      return {
        erro: 'Atingi o limite de demonstrações desta hora. Peça para a pessoa criar a fila dela em ' +
          `${APP_BASE}/cadastro.html — leva um minuto e é o mesmo resultado.`,
      };
    }
    demosCriadas.push(agora);

    const criada = await chamarApi('/api/venues', {
      method: 'POST',
      body: JSON.stringify({ name: nome }),
    });

    // A conversa passa a ter dono: o Pix vai sair para esta unidade.
    contexto.unidade = criada.venue.slug;

    return {
      nome: criada.venue.name,
      unidade: criada.venue.slug,
      link_da_fila: criada.joinUrl,
      qr_para_imprimir: `${APP_BASE}${criada.qrUrl}`,
      cartaz_para_imprimir: `${APP_BASE}/cartaz.html?venue=${criada.venue.slug}`,
      painel_do_operador: `${APP_BASE}${criada.operatorUrl}`,
      senha_do_operador: criada.operatorPassword,
      aviso: 'A senha aparece uma única vez. Passe os links para a pessoa e avise que é uma fila real, com 14 dias de teste.',
    };
  },

  async status_da_fila({ unidade }) {
    const slug = normalizarSlug(unidade);
    if (!slugValido(slug)) return { erro: 'Identificador de unidade inválido.' };
    try {
      const estado = await chamarApi(`/api/venues/${encodeURIComponent(slug)}/state`);
      return {
        unidade: estado.venueMeta.slug,
        nome: estado.venue,
        pessoas_aguardando: estado.kpis.waiting,
        em_atendimento: estado.kpis.calling,
        atendidos_hoje: estado.kpis.servedToday,
        espera_media_minutos: estado.kpis.avgWait,
        plano: estado.monetization.plan,
      };
    } catch (erro) {
      if (erro.status === 404) return { erro: 'Não encontrei essa unidade.' };
      throw erro;
    }
  },

  // A unidade NAO vem do modelo. Um 7B nao transcreve identificador de forma
  // confiavel: pedindo otica-fecha-agora ele mandou "ótica-fecha-agora" numa
  // tentativa e "oticafecha-agora" na seguinte. Aqui a unidade vem do estado
  // da conversa — a que foi criada nela. Alem de nao errar, isso impede o
  // modelo de gerar cobranca para a unidade de outra pessoa.
  async gerar_pix_da_assinatura({ email }, contexto = {}) {
    const slug = normalizarSlug(contexto.unidade);
    if (!slugValido(slug)) {
      return { erro: 'Ainda não existe unidade nesta conversa. Crie a demonstração primeiro, com criar_demonstracao.' };
    }
    const destino = String(email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino)) {
      return { erro: 'Preciso de um e-mail válido — o provedor de pagamento exige.' };
    }

    try {
      // Nenhum valor sai daqui. O servidor decide quanto cobrar.
      const cobranca = await chamarApi(`/api/venues/${slug}/cobranca`, {
        method: 'POST',
        body: JSON.stringify({ email: destino }),
      });
      // O codigo NAO volta para o modelo, de proposito.
      //
      // Pedimos ao qwen2.5:7b para repetir o copia-e-cola exatamente como veio
      // e ele emendou o campo de validade dentro do codigo. Num Pix real isso
      // quebra o CRC16 do BR Code: o app do banco recusa, o cliente nao
      // consegue pagar e acha que o problema e nosso.
      //
      // Um modelo de linguagem nao transcreve string opaca longa de forma
      // confiavel, e nao ha prompt que conserte isso. O codigo vai por fora,
      // em campo estruturado, e a interface desenha o bloco de pagamento com
      // botao de copiar e QR. O modelo so anuncia.
      contexto.pagamento = {
        copiaECola: cobranca.copiaECola,
        qrBase64: cobranca.qrBase64,
        ticketUrl: cobranca.ticketUrl,
        valorLabel: cobranca.valorLabel,
        expiraEm: cobranca.expiraEm,
        sandbox: !!cobranca.sandbox,
      };

      return {
        pix_gerado: true,
        valor: cobranca.valorLabel,
        link_para_cartao: `${APP_BASE}/assinar.html?venue=${slug}`,
        instrucao: 'O bloco de pagamento com o código Pix JÁ apareceu na tela para a pessoa. ' +
          'NÃO escreva o código na sua resposta — você não o recebeu. Diga em uma frase que o Pix ' +
          'está aí na tela, com o valor, e que o premium libera assim que o pagamento cair. ' +
          'Não prometa prazo de compensação. Se ela preferir cartão, mande o link_para_cartao: ' +
          'lá tem Google Pay e o premium libera na hora.',
      };
    } catch (erro) {
      if (erro.status === 404) return { erro: 'Não encontrei essa unidade.' };
      return { erro: 'Não consegui gerar o Pix agora. Ofereça o WhatsApp ou a página de planos.' };
    }
  },

  async registrar_interesse({ nome, email, segmento }) {
    try {
      await chamarApi('/api/leads', {
        method: 'POST',
        body: JSON.stringify({ name: nome, email, segment: segmento || '', source: 'chatbot' }),
      });
      return { registrado: true, mensagem: 'Contato registrado. Alguém responde em até um dia útil.' };
    } catch (erro) {
      return { registrado: false, erro: erro.message };
    }
  },
};

// O contexto e o estado da conversa (hoje: qual unidade ela criou). Handlers
// que precisam de identidade leem dali, nao do que o modelo escreveu.
async function executar(nome, entrada, contexto = {}) {
  const handler = HANDLERS[nome];
  if (!handler) return { erro: `Ferramenta desconhecida: ${nome}` };
  try {
    return await handler(entrada || {}, contexto);
  } catch (erro) {
    // O modelo recebe o erro como resultado e contorna, em vez de travar.
    return { erro: `Não consegui completar: ${erro.message}` };
  }
}

module.exports = { DEFINICOES, HANDLERS, executar, API_BASE, APP_BASE, slugValido, normalizarSlug };
