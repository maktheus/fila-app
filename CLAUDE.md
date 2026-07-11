# fila-app — instruções do projeto

App de **fila virtual via QR code** para clínicas/serviços: o cliente escaneia um QR no local, entra na fila pelo navegador (sem instalar nada), acompanha a posição em tempo real e pode **passar a vez** — com checagem de proximidade do ponto de entrada. Operador gerencia pelo painel admin.

Método de produto: blueprint [bateia](https://github.com/stpedr/bateia) (skills em `.claude/skills/`). O plano vivo do produto está em `docs/GARIMPO.md` — **leia-o antes de implementar qualquer feature** e mantenha-o atualizado quando um bloco for concluído.

## Estado atual (2026-07-08)

- `frontend/index.html` — painel do operador (pronto, consome a API + WS)
- `frontend/landing.html` — landing page (pronta)
- `backend/server.js` — Express + WebSocket, store em memória, ações de operador prontas
- `project/*.dc.html` — protótipos de design (Claude Design, design system Mutum): **Fila Virtual** (app do cliente) e **Painel Admin**
- **Falta construir**: o app do cliente (QR → entrar → posição ao vivo → passar a vez com proximidade) e a autenticação do admin

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
