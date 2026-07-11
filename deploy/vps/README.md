# Deploy do backend na VPS

Esta configuracao publica somente o Caddy existente. O container do backend
fica vinculado ao gateway Docker da VPS em 172.18.0.1:40006.

## Endpoints publicos

- API: https://srv1178252.hstgr.cloud/fila-api
- WebSocket: wss://srv1178252.hstgr.cloud/fila-ws
- Healthcheck: https://srv1178252.hstgr.cloud/fila-api/api/health

## Instalacao

1. Copie .env.example para .env, gere um ADMIN_TOKEN aleatorio e restrinja
   o arquivo para o usuario root.
2. Suba o backend com Docker Compose usando deploy/vps/docker-compose.yml.
3. Insira Caddyfile.snippet dentro do bloco srv1178252.hstgr.cloud antes do
   handle generico.
4. Valide e recarregue o Caddy.
5. Configure no GitHub:

   FILA_API_BASE=https://srv1178252.hstgr.cloud/fila-api
   FILA_WS_BASE=wss://srv1178252.hstgr.cloud/fila-ws

O token administrativo nao deve ser colocado no frontend ou nas variaveis
publicas do GitHub Pages.
