<!-- aplicar-bateia-monetization-observability:start -->
# Monetizacao e observabilidade - Fila App

## Monetizacao padrao Bateia

- Plano gratis: uso basico com anuncios.
- Plano premium: remove anuncios e libera limites operacionais.
- Entitlement: o backend deve expor se a conta/unidade esta em `free` ou `premium`.
- Ads web: Google Ad Manager via `frontend/ads.js` e Google Publisher Tag.
- Ads mobile: AdMob no wrapper Android nativo; TWA pura continua usando os slots web.
- Slots nomeados no front, com fallback silencioso quando o provedor falhar.
- Billing: registrar eventos de assinatura, pagamento confirmado, falha, cancelamento e renovacao.

## Eventos minimos

- `ad_slot_viewed`
- `ad_slot_failed`
- `premium_started`
- `premium_cancelled`
- `queue_joined`
- `queue_called`
- `operator_action`
- `gam_slot_requested`
- `admob_banner_requested`

## Observabilidade

O painel Uptime Kuma deve monitorar:

- Landing publica.
- App do cliente.
- API `/api/health`.
- WebSocket `/ws`.
- Painel de operador.
- Checkout/webhook quando existir.

O docker-compose local inclui Uptime Kuma com perfil `observability`.

```bash
docker compose --profile observability up -d
```
<!-- aplicar-bateia-monetization-observability:end -->
