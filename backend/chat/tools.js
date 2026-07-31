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
        forma_de_pagamento: 'Pix recorrente, sem fidelidade',
      },
      pagina_de_planos: `${APP_BASE}/planos.html`,
    };
  },

  async criar_demonstracao({ nome_do_estabelecimento }) {
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
    if (!slugValido(unidade)) return { erro: 'Identificador de unidade inválido.' };
    try {
      const estado = await chamarApi(`/api/venues/${encodeURIComponent(unidade)}/state`);
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

async function executar(nome, entrada) {
  const handler = HANDLERS[nome];
  if (!handler) return { erro: `Ferramenta desconhecida: ${nome}` };
  try {
    return await handler(entrada || {});
  } catch (erro) {
    // O modelo recebe o erro como resultado e contorna, em vez de travar.
    return { erro: `Não consegui completar: ${erro.message}` };
  }
}

module.exports = { DEFINICOES, HANDLERS, executar, API_BASE, APP_BASE, slugValido };
