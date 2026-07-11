# Publish - Fila Virtual

## Resultado final esperado

- Web deploy padrao: GitHub Pages via `.github/workflows/deploy-pages.yml`.
- App Android: Play Store via PWA + Trusted Web Activity.
- Futuro deploy: trocar provedor sem mudar o app, usando `frontend/config.js` para apontar API/WS.

## Deploy web padrao

1. Envie o repositorio para GitHub.
2. Em Settings > Pages, selecione GitHub Actions como source.
3. Configure as repository variables:
- `FILA_API_BASE`: URL HTTPS do backend.
- `FILA_WS_BASE`: URL WSS do WebSocket.
   - `FILA_GAM_NETWORK_CODE`: network code do Google Ad Manager para web.
   - `FILA_GAM_AD_UNIT_PREFIX`: prefixo das unidades, padrao `fila_virtual`.
4. Faça push na branch `main` ou rode o workflow manualmente.

## Provedores futuros

O front estatico em `frontend/` pode ir para Vercel, Netlify, Cloudflare Pages, Render static site ou VPS Nginx. Em todos os casos, publique os mesmos arquivos e defina `config.js`.

## Play Store

O caminho padrao e TWA: publicar o PWA em HTTPS, provar posse do dominio com Digital Asset Links e gerar um `.aab` assinado. A pasta `playstore/` guarda os templates.

Para monetizacao mobile com AdMob, a TWA precisa virar um wrapper Android customizado com Google Mobile Ads SDK. Sem essa camada nativa, o app de loja renderiza a PWA e usa os mesmos slots web do Google Ad Manager.

## Gates antes de apertar publicar

- `aplicar-bateia revise` com score 100.
- Backend em HTTPS com CORS apontando para o dominio publico.
- Uptime Kuma monitorando landing, cliente, API, WS e operador.
- Politica de privacidade e termos.
- Declaracao de anuncios no Play Console quando Ad Manager/AdMob estiver ativo.
- Teste fechado do Google Play quando aplicavel.
