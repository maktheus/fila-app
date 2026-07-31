// Ingestão e agregação dos eventos de comportamento.
//
// Regra que não se negocia: nada aqui pode guardar dado pessoal. Validamos o
// formato, cortamos tamanho e descartamos qualquer campo fora da lista — se o
// front mandar um valor digitado por engano, ele morre aqui.

const MAX_EVENTS_POR_LOTE = 50;
const MAX_PROPS_CHARS = 400;
const RETENCAO_DIAS = Number(process.env.ANALYTICS_RETENTION_DAYS || 90);

// Chaves permitidas em props. Qualquer outra é descartada na entrada.
const PROPS_PERMITIDAS = new Set([
  'form', 'campos', 'alvo', 'rota', 'status', 'ms', 'msg', 'arquivo', 'linha',
  'ref', 'origem', 'plano', 'etapa', 'motivo', 'segmento',
]);

const SUPERFICIES = new Set(['landing', 'cadastro', 'cliente', 'operador', 'telao', 'planos', 'cartaz', 'checkout', 'desconhecida']);

function limparProps(props) {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return {};
  const saida = {};
  for (const [chave, valor] of Object.entries(props)) {
    if (!PROPS_PERMITIDAS.has(chave)) continue;
    if (typeof valor === 'number') saida[chave] = valor;
    else if (typeof valor === 'boolean') saida[chave] = valor;
    else if (typeof valor === 'string') saida[chave] = valor.slice(0, 120);
  }
  const serializado = JSON.stringify(saida);
  return serializado.length > MAX_PROPS_CHARS ? {} : saida;
}

function normalizar(corpo) {
  const session = String((corpo && corpo.session) || '').slice(0, 64);
  const ref = String((corpo && corpo.ref) || '').slice(0, 60);
  const lista = Array.isArray(corpo && corpo.events) ? corpo.events.slice(0, MAX_EVENTS_POR_LOTE) : [];
  const agora = Date.now();

  return lista
    .map(evento => {
      const name = String((evento && evento.name) || '').slice(0, 48);
      if (!name || !/^[a-z0-9_:.-]+$/i.test(name)) return null;
      const surface = String((evento && evento.surface) || 'desconhecida');
      const at = Number(evento && evento.at);
      return {
        session: session || 'sem-sessao',
        name,
        surface: SUPERFICIES.has(surface) ? surface : 'desconhecida',
        venue: evento.venue ? String(evento.venue).slice(0, 40) : null,
        path: evento.path ? String(evento.path).slice(0, 80) : null,
        ref,
        props: limparProps(evento.props),
        // Carimbo do cliente pode vir com relógio errado: aceita só janela sã.
        at: Number.isFinite(at) && Math.abs(agora - at) < 6 * 3600 * 1000 ? at : agora,
      };
    })
    .filter(Boolean);
}

// --------------- Funis ---------------

// Dois caminhos importam: o do dono que vira cliente pagante e o da pessoa
// que entra na fila no balcão. A queda entre etapas é o que aponta o problema.
const FUNIS = {
  dono: {
    titulo: 'Dono do estabelecimento',
    etapas: [
      { name: 'tela:aberta@landing', rotulo: 'Abriu a landing' },
      { name: 'clique:criar_fila', rotulo: 'Clicou em criar fila' },
      { name: 'form:iniciado@cadastro', rotulo: 'Começou o cadastro' },
      { name: 'cadastro:concluido', rotulo: 'Criou a unidade' },
      { name: 'clique:abrir_cartaz', rotulo: 'Abriu o cartaz' },
      { name: 'operador:login_ok', rotulo: 'Entrou no painel' },
      { name: 'operador:chamou', rotulo: 'Chamou alguém' },
      { name: 'checkout:iniciado', rotulo: 'Foi para o pagamento' },
    ],
  },
  cliente: {
    titulo: 'Cliente na fila',
    etapas: [
      { name: 'tela:aberta@cliente', rotulo: 'Abriu pelo QR' },
      { name: 'form:iniciado@cliente', rotulo: 'Digitou o nome' },
      { name: 'fila:entrou', rotulo: 'Entrou na fila' },
      { name: 'fila:acompanhou', rotulo: 'Acompanhou a vez' },
      { name: 'fila:chamado', rotulo: 'Foi chamado' },
    ],
  },
};

// Etapas com @superficie viram consulta por nome + superfície.
function chaveDeEtapa(name) {
  const [base, superficie] = name.split('@');
  return { base, superficie: superficie || null };
}

function montarFunil(defs, contagens) {
  let anterior = null;
  return defs.etapas.map(etapa => {
    const sessoes = contagens[etapa.name] || 0;
    const queda = anterior === null || anterior === 0 ? 0 : Math.round((1 - sessoes / anterior) * 100);
    const item = {
      etapa: etapa.rotulo,
      evento: etapa.name,
      sessoes,
      quedaPercentual: anterior === null ? null : queda,
    };
    anterior = sessoes;
    return item;
  });
}

module.exports = {
  MAX_EVENTS_POR_LOTE,
  RETENCAO_DIAS,
  FUNIS,
  normalizar,
  limparProps,
  chaveDeEtapa,
  montarFunil,
};
