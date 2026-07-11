<!-- aplicar-bateia-front-architecture:start -->
# Arquitetura front - Fila App

## Saida obrigatoria

O front deve nascer como web app mobile-first e desktop-aware:

- Cliente: experiencia principal em `/cliente.html`, aberta por QR code, usavel no navegador do celular.
- Operador: painel denso em `operador.html`, com token de operador quando `ADMIN_TOKEN` estiver ativo.
- Landing: pagina comercial separada, focada em conversao.
- PWA: `manifest.webmanifest` + `sw.js`, instalavel no Android/iOS como atalho.
- Lojas: depois da validacao, empacotar a mesma web com Capacitor/Tauri mobile, preservando API e rotas.

## Contrato visual

- Mobile primeiro; desktop amplia densidade, nao muda a regra de negocio.
- O usuario final nao instala nada para entrar na fila.
- O operador precisa de tela escaneavel, com acoes previsiveis e feedback em tempo real.

## Dados e tempo real

- REST para comandos.
- WebSocket para estado vivo.
- Sem polling para fila.
- Estado sensivel usa persistencia local por `DATA_FILE` no MVP; antes de escala/multi-unidade, migrar para SQLite/Supabase/Postgres com limpeza LGPD.

## Pronto para loja

- PWA validada.
- Auth de operador resolvida.
- Politica de privacidade e LGPD.
- Plano free/premium refletido no backend.
- Observabilidade ligada no Uptime Kuma.
<!-- aplicar-bateia-front-architecture:end -->
