// Provedor local — fala com qualquer runtime que exponha a API compatível com
// OpenAI em /v1/chat/completions. Um adaptador cobre Ollama (que expõe /v1
// além da API nativa), llama.cpp server, LM Studio, vLLM e text-generation-webui.
//
// Custo zero e nada sai da máquina. Em troca, modelos pequenos seguem
// instrução pior e chamam ferramenta de forma menos confiável — por isso o
// agente injeta os números do plano direto no prompt quando o provedor é
// local, e os guardrails de saída continuam sendo a rede de segurança.

const BASE = (process.env.LOCAL_LLM_BASE || 'http://127.0.0.1:11434/v1').replace(/\/$/, '');
const MODELO = process.env.LOCAL_LLM_MODEL || 'qwen2.5:7b';
const TIMEOUT_MS = Number(process.env.LOCAL_LLM_TIMEOUT_MS || 90000);
const TEMPERATURA = Number(process.env.LOCAL_LLM_TEMPERATURE || 0.3);

function paraFormatoOpenAI(definicoes) {
  return definicoes.map(d => ({
    type: 'function',
    function: { name: d.name, description: d.description, parameters: d.input_schema },
  }));
}

// O histórico interno usa o formato de blocos do Anthropic; aqui achatamos
// para o formato de mensagens simples que a API compatível espera.
function achatarConteudo(conteudo) {
  if (typeof conteudo === 'string') return conteudo;
  if (!Array.isArray(conteudo)) return '';
  return conteudo
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');
}

async function chamar({ system, mensagens, ferramentas }) {
  const corpo = {
    model: MODELO,
    temperature: TEMPERATURA,
    messages: [{ role: 'system', content: system }, ...mensagens],
    stream: false,
  };
  if (ferramentas && ferramentas.length) corpo.tools = paraFormatoOpenAI(ferramentas);

  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TIMEOUT_MS);

  let resposta;
  try {
    resposta = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Runtimes locais ignoram, mas LM Studio e vLLM podem exigir algo.
        ...(process.env.LOCAL_LLM_API_KEY ? { Authorization: `Bearer ${process.env.LOCAL_LLM_API_KEY}` } : {}),
      },
      body: JSON.stringify(corpo),
      signal: controle.signal,
    });
  } catch (erro) {
    if (erro.name === 'AbortError') {
      throw new Error(`o modelo local não respondeu em ${TIMEOUT_MS / 1000}s`);
    }
    throw new Error(`não consegui falar com o modelo local em ${BASE}: ${erro.message}`);
  } finally {
    clearTimeout(relogio);
  }

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => '');
    throw new Error(`modelo local respondeu ${resposta.status}: ${detalhe.slice(0, 200)}`);
  }

  const dados = await resposta.json();
  const escolha = (dados.choices || [])[0];
  if (!escolha) throw new Error('modelo local devolveu resposta sem conteúdo');

  const mensagem = escolha.message || {};
  const chamadas = (mensagem.tool_calls || []).map(c => ({
    id: c.id || `call_${Math.random().toString(36).slice(2, 10)}`,
    nome: c.function && c.function.name,
    entrada: analisarArgumentos(c.function && c.function.arguments),
  })).filter(c => c.nome);

  let texto = (mensagem.content || '').trim();
  let resgatadas = false;

  // Só tentamos o resgate quando o canal certo veio vazio.
  if (!chamadas.length && texto && ferramentas && ferramentas.length) {
    const nomes = new Set(ferramentas.map(f => f.name));
    const resgate = resgatarChamadasDoTexto(texto, nomes);
    if (resgate.chamadas.length) {
      chamadas.push(...resgate.chamadas);
      texto = resgate.texto;
      resgatadas = true;
    }
  }

  return {
    texto,
    chamadas,
    resgatadas,
    // Se resgatamos, a mensagem que volta ao histórico precisa carregar as
    // chamadas no formato certo — senão o modelo não reconhece os resultados.
    mensagemBruta: resgatadas
      ? {
        role: 'assistant',
        content: texto,
        tool_calls: chamadas.map(c => ({
          id: c.id,
          type: 'function',
          function: { name: c.nome, arguments: JSON.stringify(c.entrada) },
        })),
      }
      : mensagem,
    uso: dados.usage || null,
    modelo: dados.model || MODELO,
  };
}

// Resgate de chamada emitida como texto.
//
// Modelo pequeno as vezes erra o canal: em vez de emitir tool_calls, ele
// ESCREVE a chamada no conteudo. O qwen2.5:7b devolveu, como resposta ao
// visitante:
//
//   criar_demonstracao {"nome_do_estabelecimento": "Clinica Confirma Limite"}
//
// A intencao estava certa e o argumento tambem — so o envelope estava errado.
// Descartar isso custa a venda e ainda mostra JSON cru para o cliente. Aqui
// reconhecemos os tres formatos que aparecem na pratica e executamos a
// chamada normalmente.
//
// So resgatamos ferramenta que existe: texto solto que por acaso pareca uma
// chamada nao vira execucao.
// Objetos JSON de chaves balanceadas dentro de um texto. Regex não serve
// aqui: o objeto de argumentos tem chaves aninhadas, e uma busca preguiçosa
// para no `}` errado.
function objetosBalanceados(texto) {
  const achados = [];
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] !== '{') continue;
    let profundidade = 0;
    let emString = false;
    let escapado = false;
    for (let j = i; j < texto.length && j - i < 2000; j++) {
      const c = texto[j];
      if (escapado) { escapado = false; continue; }
      if (c === '\\') { escapado = true; continue; }
      if (c === '"') { emString = !emString; continue; }
      if (emString) continue;
      if (c === '{') profundidade++;
      else if (c === '}') {
        profundidade--;
        if (profundidade === 0) {
          achados.push({ texto: texto.slice(i, j + 1), inicio: i, fim: j + 1 });
          i = j;
          break;
        }
      }
    }
  }
  return achados;
}

function resgatarChamadasDoTexto(texto, nomesValidos) {
  const bruto = String(texto || '');
  const chamadas = [];
  let limpo = bruto;

  // Os tres formatos se sobrepoem: <tool_call> tambem casa como JSON solto.
  // Sem dedupe, uma chamada vira duas — e duas demonstracoes criadas.
  const vistas = new Set();

  function registrar(nome, argumentos, trecho) {
    if (!nomesValidos.has(nome)) return;
    const entrada = analisarArgumentos(argumentos);
    const impressao = nome + '|' + JSON.stringify(entrada);
    if (vistas.has(impressao)) return;
    vistas.add(impressao);
    chamadas.push({
      id: `resgate_${Math.random().toString(36).slice(2, 10)}`,
      nome,
      entrada,
    });
    limpo = limpo.replace(trecho, '');
  }

  // 1. Formato nativo do qwen quando o adaptador nao o converte.
  const nativo = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
  for (const achado of bruto.matchAll(nativo)) {
    const corpo = analisarArgumentos(achado[1]);
    if (corpo && corpo.name) registrar(corpo.name, corpo.arguments, achado[0]);
  }

  // 2. JSON solto com {"name": ..., "arguments": {...}}, com ou sem cerca.
  for (const objeto of objetosBalanceados(bruto)) {
    const corpo = analisarArgumentos(objeto.texto);
    if (corpo && corpo.name) registrar(corpo.name, corpo.arguments || corpo.parameters, objeto.texto);
  }

  // 3. `nome_da_ferramenta {json}` — o formato que apareceu na pratica.
  for (const objeto of objetosBalanceados(bruto)) {
    const antes = bruto.slice(0, objeto.inicio);
    const casado = antes.match(/([a-z][a-z0-9_]{3,40})\s*$/);
    if (!casado) continue;
    const nome = casado[1];
    if (chamadas.some(c => c.nome === nome)) continue;
    registrar(nome, objeto.texto, bruto.slice(antes.length - casado[0].length, objeto.fim));
  }

  return { chamadas, texto: limpo.trim() };
}

// Modelo pequeno às vezes devolve os argumentos como string mal formada.
// Um objeto vazio é melhor que derrubar a conversa.
function analisarArgumentos(bruto) {
  if (!bruto) return {};
  if (typeof bruto === 'object') return bruto;
  try {
    return JSON.parse(bruto);
  } catch (e) {
    return {};
  }
}

// Devolve as mensagens a acrescentar depois de executar as ferramentas.
function mensagensDeResultado(mensagemBruta, resultados) {
  return [
    { role: 'assistant', content: mensagemBruta.content || '', tool_calls: mensagemBruta.tool_calls },
    ...resultados.map(r => ({
      role: 'tool',
      tool_call_id: r.id,
      content: JSON.stringify(r.saida),
    })),
  ];
}

async function verificar() {
  try {
    const resposta = await fetch(`${BASE}/models`, { signal: AbortSignal.timeout(4000) });
    if (!resposta.ok) return { disponivel: false, motivo: `HTTP ${resposta.status}` };
    const dados = await resposta.json().catch(() => ({}));
    const modelos = (dados.data || []).map(m => m.id);
    return {
      disponivel: true,
      base: BASE,
      modelo: MODELO,
      modelosDisponiveis: modelos,
      modeloPresente: modelos.length === 0 || modelos.includes(MODELO),
    };
  } catch (erro) {
    return { disponivel: false, base: BASE, motivo: erro.message };
  }
}

module.exports = {
  nome: 'local',
  BASE,
  MODELO,
  chamar,
  verificar,
  achatarConteudo,
  mensagensDeResultado,
  analisarArgumentos,
  paraFormatoOpenAI,
  resgatarChamadasDoTexto,
};
