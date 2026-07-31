#!/usr/bin/env node
// Servidor MCP do Fila Virtual.
//
// Expõe as mesmas ferramentas que o chatbot do site usa (backend/chat/tools.js)
// para qualquer cliente MCP — Claude Desktop, Claude Code, um agente próprio.
// A definição é compartilhada de propósito: o que o vendedor do site pode
// fazer é exatamente o que um agente conectado pode fazer, sem divergir.
//
// Transporte stdio. Configuração no cliente:
//
//   {
//     "mcpServers": {
//       "fila-virtual": {
//         "command": "node",
//         "args": ["/caminho/para/backend/mcp-server.js"],
//         "env": { "CHAT_API_BASE": "https://sua-api", "PUBLIC_APP_URL": "https://seu-app" }
//       }
//     }
//   }

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const { DEFINICOES, executar, API_BASE } = require('./chat/tools');

const servidor = new Server(
  { name: 'fila-virtual', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

servidor.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: DEFINICOES.map(d => ({
    name: d.name,
    description: d.description,
    inputSchema: d.input_schema,
  })),
}));

servidor.setRequestHandler(CallToolRequestSchema, async (pedido) => {
  const { name, arguments: argumentos } = pedido.params;
  const resultado = await executar(name, argumentos || {});
  return {
    content: [{ type: 'text', text: JSON.stringify(resultado, null, 2) }],
    isError: !!resultado.erro,
  };
});

async function principal() {
  const transporte = new StdioServerTransport();
  await servidor.connect(transporte);
  // stdout é o canal do protocolo — qualquer log vai para stderr.
  console.error(`MCP do Fila Virtual conectado. API: ${API_BASE}`);
}

principal().catch(erro => {
  console.error('Falha ao iniciar o MCP:', erro);
  process.exit(1);
});
