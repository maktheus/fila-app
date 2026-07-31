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

Estado atual (2026-07-30): ✅ Bloco 1 (app do cliente `frontend/cliente.html`), ✅ Bloco 2 (passar a vez + proximidade), ✅ Bloco 3 parcial (token de operador, CORS por env, rate limit — falta inverter rotas e expurgo LGPD), ✅ persistência em **Postgres via Docker** (`backend/db.js`, decisão de 2026-07-30: Postgres no lugar de SQLite/Supabase), ✅ deploy VPS + GitHub Pages, ✅ app Android WebView. Roadmap completo até o go-live: `docs/kanban.html`.

As 3 telas do MVP (protótipo `project/Fila Virtual.dc.html` é a fonte visual):

1. **Entrada via QR** — `/f/{token-da-unidade}` → primeiro nome → recebe senha M-xxx
2. **Status ao vivo** — posição na fila, estimativa, estado "é a sua vez" (via WS existente)
3. **Passar a vez** — botão com checagem de proximidade (Geolocation API vs. coordenada da unidade; com fallback quando a permissão for negada — o design já prevê variações)

### Blocos de construção

| Bloco | Entrega | Toca em |
|---|---|---|
| 1 | App do cliente: entrar via QR + status ao vivo | `frontend/cliente.html` novo; `POST /api/tickets` (ligar a token de unidade); WS |
| 2 | Passar a vez + proximidade | endpoint `POST /api/tickets/:id/pass`; Geolocation no front; coords da unidade no store |
| 3 | ✅ **Auth do admin + hardening** (Sprint 1, 30/07) | login com sessão expirável, CORS por env, rate limit por IP real, expurgo LGPD, nomes só para o operador, cliente na raiz, 24 testes + CI |
| 4 | ✅ **Persistência + multi-unidade** (Sprint 2, 30/07) | Postgres via Docker, schema multi-tenant, cadastro self-service (`cadastro.html` → `POST /api/venues`), QR PNG gerado por unidade, limites do plano free aplicados, expurgo LGPD |
| 5 | ✅ **Monetização B2B** (Sprint 3, 31/07) | trial de 14 dias, checkout com adapter de provedor, webhook HMAC idempotente que ativa/suspende o premium, e-mails transacionais, eventos de funil, `planos.html`. **Pendente de você**: abrir conta no provedor e comprar a própria assinatura |
| 6 | ✅ **Publicação e marketing** (Sprints 4 e 5, 31/07) | política de privacidade e termos, ficha da Play Store, assetlinks, workflow de release `.aab`, monitores Uptime Kuma, SEO da landing, captura de leads, cartaz do balcão |
| 7 | ✅ **Observabilidade de comportamento** (31/07) | `frontend/analytics.js` + tabela `analytics_events`, funil por sessão, detecção de rage-click e abandono de formulário, painel `analitico.html` mostrando onde o usuário desiste |
| 8 | ✅ **Vendedor automático** (31/07) | chatbot com RAG lexical, guardrails em três camadas, 4 ferramentas ligadas à API real, servidor MCP, **modelo local (Ollama/qwen2.5:7b) como padrão — custo zero**, e `laboratorio.html` para ver o que acontece por dentro. Detalhes em `docs/CHATBOT.md` |

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

- [x] ~~**CRÍTICO — endpoints de admin abertos**~~: resolvido em 30/07 — sessão de operador com expiração (`POST /api/operator/login`); `ADMIN_TOKEN` segue válido só para automação.
- [x] ~~CORS irrestrito~~: restrito por `CORS_ORIGIN`; em produção sem a env, nenhuma origem passa.
- [x] ~~Sem rate limit~~: 20 entradas/min e 8 logins/15min por IP — com `trust proxy` para valer o IP real atrás do nginx.
- [x] ~~LGPD~~: só primeiro nome, expurgo automático dos encerrados (`TICKET_RETENTION_HOURS`, padrão 12h) e nomes transmitidos apenas para conexões autenticadas de operador.
- [ ] Nada hardcoded até aqui (✔ verificado em `server.js` — config via env), manter assim; `.env` já está no `.gitignore`.
- [ ] Rodar `/security-review` (skill em `.claude/skills/`) ao fechar o Bloco 3 e antes de cada deploy.
- [x] ~~Painel admin em rota óbvia~~: `index.html` agora é o app do cliente; o painel vive em `operador.html`, atrás de login, com `noindex` e `robots.txt`.

## Próxima ação única

**Destravar o que depende de conta externa.** O código do Sprint 4 está pronto (`docs/PLAY_STORE.md`, `docs/MONITORAMENTO.md`, workflow de release); o que falta são passos seus, nesta ordem:

1. **Domínio + HTTPS** — sem ele não há assetlinks nem Play Store.
2. **Keystore de release** — `keytool -genkeypair`, guardar em local seguro, cadastrar `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD` nos secrets do repo.
3. **Conta no provedor de pagamento** (Cakto ou Mercado Pago) e compra da própria assinatura.
4. **Play Console** — ficha (já escrita), declaração de dados (já preenchida no doc) e teste fechado com 12+ testadores por 14 dias.

Enquanto isso corre, o **Sprint 5 (marketing)** pode andar em paralelo.
