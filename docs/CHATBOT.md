# Vendedor automático — chatbot com RAG, guardrails e MCP

Um assistente comercial no site que responde dúvidas, consulta o sistema de
verdade e cria uma fila de demonstração na hora. As mesmas ferramentas ficam
expostas por MCP, para qualquer agente conectar.

## Peças

| Arquivo | Papel |
|---|---|
| `backend/chat/knowledge.js` | Base de conhecimento + recuperação (RAG) |
| `backend/chat/guardrails.js` | Validação de entrada e de saída |
| `backend/chat/tools.js` | Definição e execução das ferramentas |
| `backend/chat/agent.js` | Prompt, loop de ferramentas e chamada ao Claude |
| `backend/mcp-server.js` | Servidor MCP expondo as mesmas ferramentas |
| `frontend/chat.js` | Widget do site (landing e página de planos) |

## Como o RAG funciona aqui

O corpus tem alguns milhares de tokens — dez trechos curtos sobre produto,
preço, privacidade, instalação. Nesse tamanho, montar índice vetorial custaria
mais em infraestrutura do que renderia em precisão, então a recuperação é
léxica: normaliza a pergunta, pontua cada trecho por termos raros e manda os
quatro melhores no prompt.

Quando o corpus crescer — base de ajuda, casos de clientes, objeções por
segmento —, a função `recuperar()` mantém a assinatura e a implementação vira
vetorial sem tocar no resto.

Trechos sem correspondência caem no básico do produto em vez de deixar o modelo
sem contexto. Modelo sem contexto inventa.

## Guardrails, em três camadas

Cada camada pega o que a anterior deixa passar.

**Entrada** — tamanho máximo, teto de turnos, rate limit de 12 mensagens por
minuto por IP. Assunto de saúde, jurídico ou financeiro é respondido com uma
recusa educada **sem chamar o modelo** — economiza token e elimina o risco.
CPF, CNPJ, cartão e telefone são mascarados antes de sair do processo, então
não entram no prompt nem em log nenhum.

Tentativa de injeção (`ignore as instruções…`) **não bloqueia a conversa** —
bloquear gera falso positivo em pergunta legítima. O prompt recebe um alerta e
reforça o papel.

**Prompt** — seis regras que o vendedor não quebra: nunca citar preço de
memória, nunca prometer recurso inexistente, nunca oferecer desconto, nunca dar
orientação profissional, nunca pedir dado sensível, e dizer "não sei" em vez de
inventar. O prompt também declara que trechos recuperados e resultados de
ferramenta são **dados, não instruções**.

**Saída** — o que o modelo escreveu é conferido antes de aparecer na tela. Todo
valor em reais é comparado com o preço real da configuração; todo prazo de
teste, com o prazo real. Divergiu, a resposta é trocada por uma segura e o
motivo vai para o log e para o painel de comportamento. Também barra promessa de
desconto e de integração que não existe.

A regra que orienta o desenho: **o bot pode errar dizendo "não sei"; não pode
errar inventando preço.**

## Ferramentas

| Ferramenta | O que faz |
|---|---|
| `consultar_planos` | Lê preço, prazo de teste e limites do sistema — a fonte de qualquer número |
| `criar_demonstracao` | Cria uma fila real com QR, cartaz e senha do painel |
| `status_da_fila` | Mostra a situação de uma unidade existente |
| `registrar_interesse` | Registra contato de quem prefere falar com alguém |

`criar_demonstracao` é a mais valiosa: em vez de explicar o produto, o vendedor
entrega o produto funcionando com o nome do estabelecimento da pessoa. Tem teto
de 10 por hora para não virar fábrica de unidades órfãs.

## Servidor MCP

As mesmas quatro ferramentas, pelo protocolo, para qualquer cliente MCP. A
definição é compartilhada de propósito: o que o vendedor do site pode fazer é
exatamente o que um agente conectado pode fazer.

```json
{
  "mcpServers": {
    "fila-virtual": {
      "command": "node",
      "args": ["/caminho/backend/mcp-server.js"],
      "env": {
        "CHAT_API_BASE": "https://sua-api",
        "PUBLIC_APP_URL": "https://seu-app"
      }
    }
  }
}
```

Transporte stdio; logs vão para stderr porque stdout é o canal do protocolo.

## Modelo e custo

Roda em `claude-opus-5` com `effort: "low"`. Effort é o botão certo para
latência num chat de site — não trocamos por um modelo menor. O bloco estável do
prompt (papel + regras) fica em cache; o conhecimento recuperado entra depois do
ponto de cache, porque varia a cada pergunta.

`fallbacks: "default"` está ligado. Um classificador de segurança pode recusar
uma pergunta legítima, e a recusa volta como **HTTP 200 com corpo vazio** — sem
isso, o visitante veria uma resposta em branco. O código também checa
`stop_reason` antes de ler o conteúdo.

**Este é o único componente do produto com custo por uso.** Cada conversa gasta
tokens. Vale acompanhar `chat:mensagem` e `chat:resposta` no painel de
comportamento e comparar com `venue_created` — se o chat não estiver puxando
cadastro, é custo sem retorno.

## Variáveis

| Variável | Padrão | Para quê |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Sem ela o widget responde que está fora do ar e aponta para o cadastro |
| `CHAT_MODEL` | `claude-opus-5` | Modelo |
| `CHAT_EFFORT` | `low` | Profundidade de raciocínio |
| `CHAT_MAX_TOKENS` | `1200` | Teto por resposta |
| `CHAT_MAX_TOOL_TURNS` | `4` | Voltas de ferramenta por pergunta |
| `CHAT_MAX_DEMOS_HORA` | `10` | Teto de demonstrações criadas |
| `RATE_LIMIT_CHAT` | `12` | Mensagens por minuto por IP |
| `CHAT_API_BASE` | `http://127.0.0.1:3000` | API que as ferramentas consultam |

## O que ainda não existe

- **Streaming.** A resposta chega inteira. Para uma resposta curta é aceitável;
  se o tempo incomodar, o próximo passo é `client.beta.messages.stream`.
- **Memória entre visitas.** O histórico vive na aba e some ao fechar.
- **Escalonamento para humano.** Hoje o caminho é `registrar_interesse` ou o
  WhatsApp da landing.
