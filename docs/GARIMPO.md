# GARIMPO — Fila Virtual (relatório `/ideia-app`)

_Gerado pelo blueprint [bateia](https://github.com/stpedr/bateia) em 2026-07-08, com base no estado real do repo._

## Ideia em 1 frase

**Fila Virtual tira o cliente da sala de espera: ele escaneia o QR no balcão, entra na fila pelo navegador — sem instalar nada — e espera de onde quiser vendo a posição ao vivo.**

Cortado do MVP (explicitamente): seleção de unidade, busca por senha/nome, histórico do dia, notificação push, agendamento, multi-idioma. A dor central é UMA: *esperar preso na sala de espera sem saber quando será chamado*.

> Modelo "portinha de entrada": para o **cliente final é grátis e sem fricção** (QR → navegador). Quem paga é o **estabelecimento** (B2B) — a fricção que a assinatura remove é do dono da fila, não de quem espera.

## Onde validar (referência de mercado)

- **Ocidente**: Waitwhile, Qminder, QLess — SaaS de fila virtual consolidados (US$/mês por unidade, milhares de clientes). Confirma que estabelecimento **paga** por isso.
- **China**: fila virtual é padrão via mini-programs do WeChat (Meituan/大众点评 gerenciam fila de restaurante por QR há anos, em escala de centenas de milhões). A mecânica QR → fila no navegador é exatamente a validada lá.
- **Brasil**: soluções locais existem mas focam em totem/hardware ou enterprise (hospitais grandes). O recorte "sem totem, sem app, só QR" para **clínicas pequenas e serviços de bairro** está mal atendido.

**Veredito: `CLONE LOCALIZADO`** — mecânica massivamente validada lá fora (EUA + China), com espaço no Brasil no segmento pequeno/médio via Pix e onboarding em minutos.

## Nota: 10/10

| Critério | Pontos | Justificativa |
|---|---|---|
| Simples de criar | 2/2 | Poucas telas; painel admin e backend **já prontos** neste repo |
| Fácil de replicar | 2/2 | Express + WS + HTML — zero tecnologia pesada escondida |
| Faz sentido no Brasil | 2/2 | Fila de clínica/laboratório/cartório é dor universal e diária aqui |
| Dor recorrente | 2/2 | O pagante (estabelecimento) sofre a dor **todo dia útil** |
| Público que já paga | 2/2 | Clínicas já pagam por painel de senha/totem — isto substitui por menos |

## MVP — o que falta construir (em blocos)

Estado atual: ✅ painel do operador (`frontend/index.html`), ✅ backend com ações de operador (`backend/server.js`), ✅ landing, ✅ protótipos de design (`project/*.dc.html`). **Falta o app do cliente — o coração da ideia original (`chats/chat1.md`).**

As 3 telas do MVP (protótipo `project/Fila Virtual.dc.html` é a fonte visual):

1. **Entrada via QR** — `/f/{token-da-unidade}` → primeiro nome → recebe senha M-xxx
2. **Status ao vivo** — posição na fila, estimativa, estado "é a sua vez" (via WS existente)
3. **Passar a vez** — botão com checagem de proximidade (Geolocation API vs. coordenada da unidade; com fallback quando a permissão for negada — o design já prevê variações)

### Blocos de construção

| Bloco | Entrega | Toca em |
|---|---|---|
| 1 | App do cliente: entrar via QR + status ao vivo | `frontend/cliente.html` novo; `POST /api/tickets` (ligar a token de unidade); WS |
| 2 | Passar a vez + proximidade | endpoint `POST /api/tickets/:id/pass`; Geolocation no front; coords da unidade no store |
| 3 | **Auth do admin + hardening** (pré-requisito de qualquer deploy real) | token de operador nos endpoints de ação; CORS restrito; rate limit |
| 4 | Persistência + multi-unidade | SQLite ou Supabase; QR token por unidade; limpeza de tickets (LGPD) |
| 5 | Monetização B2B | assinatura Cakto/Pix por unidade; onboarding da clínica (gera QR na hora) |

### Prompt de construção do Bloco 1 (planejar com Opus, executar com Sonnet)

```
Leia CLAUDE.md, chats/chat1.md e project/Fila Virtual.dc.html (fonte visual).
Crie frontend/cliente.html: app do cliente da fila virtual, recriando fiel o
protótipo (design system Mutum), com 2 estados — entrada (primeiro nome →
POST /api/tickets) e status ao vivo (posição na fila via WebSocket /ws,
destacando quando status='calling' com o balcão). Mobile-first, vanilla JS
como o painel. Não implemente ainda o passar-a-vez (Bloco 2). Antes de codar,
me apresente o plano em blocos e espere aprovação.
```

## Caminho de publicação

**Web (MVP)** — o repo já tem a infra: workflow de GitHub Pages para o front estático e `docker-compose.yml` (backend + nginx) para subir numa VPS ou Render/Railway (o backend usa WebSocket — precisa de host com conexão persistente; Vercel serverless não serve para o WS).

Sequência: landing + app cliente como estático → backend no Render/VPS → domínio próprio → PWA (adicionar à tela de início) fica de graça por ser web. Lojas: só depois de validar com 3+ clientes pagantes.

## Plano de receita (meta R$ 5.000/mês, B2B por unidade)

| Preço/unidade/mês | Unidades p/ meta | Leitura |
|---|---|---|
| R$ 49 | 102 | Barato demais — suporte come a margem |
| **R$ 99** | **51** | **Recomendado** — abaixo de qualquer totem, viável com vendas diretas |
| R$ 199 | 26 | Plano "clínica com 3+ balcões" — upsell natural |

Checkout: **assinatura recorrente Pix via Cakto** (alternativas Stripe/Mercado Pago), webhooks de pagamento configurados, trial de 14 dias. **Testar comprando a própria assinatura antes de vender.**

## Checklist de segurança (bloqueia deploy real)

- [ ] **CRÍTICO — endpoints de admin abertos**: hoje qualquer pessoa pode `POST /api/tickets/call-next` e comandar a fila. Bloco 3 antes de qualquer cliente real.
- [ ] CORS irrestrito (`app.use(cors())`) — restringir ao domínio em produção.
- [ ] Sem rate limit — um loop de `POST /api/tickets` enche a fila (DoS trivial).
- [ ] LGPD: nomes na fila são dado pessoal — coletar só primeiro nome, expurgar tickets encerrados; vazamento = notificação obrigatória + multa de até 5% do faturamento.
- [ ] Nada hardcoded até aqui (✔ verificado em `server.js` — config via env), manter assim; `.env` já está no `.gitignore`.
- [ ] Rodar `/security-review` (skill em `.claude/skills/`) ao fechar o Bloco 3 e antes de cada deploy.
- [ ] Painel admin não pode ser rota enumerável óbvia em produção (hoje `index.html` é o admin! — inverter: cliente vira o index, admin vira rota autenticada).

## Próxima ação única

**Construir o Bloco 1** — colar o prompt acima no Claude Code dentro deste repo. É a peça que falta para a demo completa (cliente entra pelo QR e se vê na fila que o painel já gerencia).
