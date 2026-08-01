# fila-app — instruções do projeto

App de **fila virtual via QR code** para clínicas/serviços: o cliente escaneia um QR no local, entra na fila pelo navegador (sem instalar nada), acompanha a posição em tempo real e pode **passar a vez** — com checagem de proximidade do ponto de entrada. Operador gerencia pelo painel admin.

Método de produto: blueprint [bateia](https://github.com/stpedr/bateia) (skills em `.claude/skills/`). O plano vivo do produto está em `docs/GARIMPO.md` — **leia-o antes de implementar qualquer feature** e mantenha-o atualizado quando um bloco for concluído.

## Estado atual (2026-07-31)

O MVP está construído e em `main`. Postgres via Docker, multi-unidade, auth de
operador, cobrança por Pix e cartão, chatbot de vendas com modelo local,
observabilidade de comportamento. 154 testes, CI verde.

- `frontend/` — `index.html` (app do cliente), `operador.html` (painel),
  `telao.html`, `cadastro.html`, `planos.html`, `assinar.html` (Pix + Google
  Pay), `cartaz.html`, `analitico.html` (funil, é seu), `laboratorio.html`
  (bancada do chatbot, autenticada)
- `backend/` — `server.js` (Express + WS), `db.js` (Postgres), `billing.js`,
  `payments/` (Mercado Pago + sandbox), `chat/` (RAG, guardrails, ferramentas,
  provedor local), `analytics.js`, `notify.js`, `mcp-server.js`
- `project/*.dc.html` — protótipos de design (design system Mutum)

### ⚠️ Antes de planejar qualquer coisa, leia `docs/PENDENCIAS.md`

Ele cataloga os pontos que ainda quebram o objetivo de "funcionar sem o dono
participar", ordenados por quanto custa deixar como estão. Resumo do que mais
importa:

- ~~Os e-mails não saem~~ — construído em 31/07 (`docs/EMAIL.md`). Falta
  contratar um SMTP e configurar SPF/DKIM/DMARC no domínio.
- ~~Ninguém paga o segundo mês~~ — ciclo de cobrança construído em 01/08, com
  plano anual. Falta o estorno proporcional do anual no cancelamento.
- **Não dá para cancelar sozinho** — obrigação do CDC. É o próximo bloco.
- **Senha perdida = cliente perdido** — não há recuperação.
- **Google Pay** depende de dois identificadores que só o suporte do Mercado
  Pago pode dar.

Outros documentos: `docs/EMAIL.md`, `docs/PAGAMENTOS.md` (Pix, cartão, webhook do MP),
`docs/CHATBOT.md` (RAG, guardrails, modelo local), `docs/OBSERVABILIDADE.md`,
`docs/kanban.html` (roadmap).

## Convenções

- Protótipos em `project/` são a fonte de verdade visual — recriar fiel, não copiar a estrutura interna. Ler `chats/chat1.md` para a intenção.
- Stack: manter simples — HTML/CSS/JS vanilla no front (como o painel), Express no back. Sem framework até o MVP validar.
- Tempo real: sempre via o WebSocket existente (`/ws`, mensagens `{type:'state'}`), nunca polling.
- Proximidade ("passar a vez"): Geolocation API no navegador comparada à coordenada do venue; degradar com opções alternativas quando o usuário negar permissão (o design já prevê variações).
- Planejar com Opus, executar com Sonnet. 80% planejamento / 20% execução — use `/blueprint` para features multi-etapa.

## Segurança (obrigatório antes de deploy real)

- **Endpoints de admin hoje estão abertos** — nenhuma feature nova de admin sem resolver auth (token/sessão) primeiro.
- Rode `/security-review` antes de qualquer deploy que não seja demo.
- Nada de segredo hardcoded; `.env` fora do git; CORS restrito ao domínio em produção.
- LGPD: nome do cliente na fila é dado pessoal — minimizar (só primeiro nome), e limpar tickets encerrados.
