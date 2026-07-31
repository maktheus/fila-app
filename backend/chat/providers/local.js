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

  return {
    texto: (mensagem.content || '').trim(),
    chamadas,
    mensagemBruta: mensagem,
    uso: dados.usage || null,
    modelo: dados.model || MODELO,
  };
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
};
