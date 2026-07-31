# Monitoramento de produção

O `docker-compose.yml` já traz o Uptime Kuma no perfil `observability`:

```bash
docker compose --profile observability up -d
```

Painel em `http://SEU-HOST:3001` (crie o usuário no primeiro acesso e **não
exponha essa porta na internet** — use túnel SSH ou restrinja por firewall).

## Monitores a criar

| Nome | Tipo | Alvo | Intervalo | Alerta quando |
|---|---|---|---|---|
| API — health | HTTP(s) | `https://API/api/health` | 60s | status ≠ 200 |
| API — banco | HTTP(s) - Keyword | `https://API/api/health`, palavra `"status":"ok"` | 60s | palavra ausente |
| WebSocket | TCP Port | host da API, porta 443 | 120s | porta fechada |
| App do cliente | HTTP(s) - Keyword | `https://APP/`, palavra `Fila` | 300s | palavra ausente |
| Landing | HTTP(s) | `https://APP/landing.html` | 300s | status ≠ 200 |
| Painel do operador | HTTP(s) | `https://APP/operador.html` | 300s | status ≠ 200 |
| Webhook de pagamento | HTTP(s) | `https://API/api/webhooks/payments` | 300s | status ≠ 401 |
| Certificado TLS | incluso nos monitores HTTPS | — | — | expira em < 14 dias |

Dois pontos que costumam passar batido:

- **API — banco** é o monitor que importa mais. O `/api/health` responde **503**
  quando o Postgres não responde, então esse monitor pega o caso em que o
  processo está de pé mas a fila não funciona.
- **Webhook** é monitorado esperando **401**, não 200: uma requisição sem
  assinatura válida *deve* ser recusada. Se um dia responder 200, a verificação
  de assinatura quebrou — é alerta de segurança, não de disponibilidade.

## Notificações

Configure pelo menos um canal em Settings > Notifications. Telegram e WhatsApp
via webhook são os mais práticos aqui. Vincule a todos os monitores acima.

## O que olhar quando disparar

| Sintoma | Primeira verificação |
|---|---|
| API — health caiu | `docker compose ps` e `docker compose logs backend --tail 50` |
| API — banco caiu | `docker compose logs postgres --tail 50`; disco cheio é a causa comum |
| WebSocket fora, HTTP ok | proxy reverso perdeu o `Upgrade`; confira o Caddy/nginx |
| App do cliente fora, API ok | problema no GitHub Pages ou no DNS, não no backend |
| Webhook respondendo 200 | **incidente de segurança**: `PAYMENT_WEBHOOK_SECRET` sumiu do ambiente |

## Retenção de dados do próprio Kuma

O volume `uptime-kuma-data` guarda o histórico. Ele cresce devagar, mas entra no
backup da VPS junto com o volume do Postgres.
