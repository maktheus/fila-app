# E-mail transacional

Sem isto, o cliente cria a fila, fecha o navegador e nunca mais ouve falar de
você. Todo o resto do funil — aviso de teste acabando, confirmação de
pagamento, cobrança do próximo ciclo, recuperação de senha — pressupõe que
estes e-mails chegam.

## O que é enviado, e quando

| Template | Dispara quando | Por que importa |
|---|---|---|
| `venue_created` | a fila é criada | entrega QR, painel e o prazo do teste |
| `trial_ending` | faltam ≤3 dias de teste | é a única chance de converter antes de degradar |
| `trial_ended` | o teste vence | explica por que o produto piorou |
| `premium_started` | pagamento confirmado | recibo — sem ele a pessoa não sabe se pagou |
| `subscription_renewed` | pagamento de um ciclo seguinte | |
| `payment_failed` | pagamento recusado | avisa antes de cair para o gratuito |
| `subscription_canceled` | assinatura cancelada | |
| `lead_received` | alguém deixa contato | leva direto para o cadastro self-service |

## Ligar

```bash
MAIL_ENABLED=true
MAIL_FROM="Fila Virtual <nao-responda@seu-dominio.com.br>"
SMTP_HOST=smtp.seu-provedor.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

**`MAIL_ENABLED` sozinho não basta.** Na subida o servidor conversa com o SMTP
de verdade e diz uma de três coisas no log:

```
E-mail DESLIGADO (MAIL_ENABLED != true): nada sera enviado, so registrado no log.
E-mail pronto: smtp.provedor.com como Fila Virtual <nao-responda@dominio.com.br>
E-mail LIGADO MAS QUEBRADO: getaddrinfo ENOTFOUND smtp.errado.com
```

Essa verificação existe porque **falha silenciosa é o pior desfecho aqui**. Sem
ela, você liga a variável, vê o sistema respondendo normalmente e assume que
está enviando — e só descobre semanas depois, quando os clientes já sumiram.

### Conferir sem esperar um cadastro real

```bash
curl -X POST https://SEU-DOMINIO/api/email/teste \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_DE_OPERADOR" \
  -d '{"para":"voce@gmail.com"}'
```

E para ver o que foi enviado e o que falhou:
`GET /api/email/status` (autenticado). Traz a configuração, o resultado da
verificação e os últimos 20 envios com destinatário, assunto e se entregou.

## Ver os e-mails localmente, sem provedor

O compose tem um coletor de e-mail sob perfil. Ele captura tudo e nada sai para
a internet:

```bash
docker compose --profile mail up -d
```

Depois suba o backend apontando para ele e abra `http://localhost:8025`:

```bash
MAIL_ENABLED=true MAIL_FROM="Fila Virtual <nao-responda@teste.com>" SMTP_HOST=mailpit SMTP_PORT=1025 docker compose up -d backend
```

## DNS: sem isso, enviar é o mesmo que não enviar

Um domínio novo mandando e-mail transacional **cai em spam por padrão**. Três
registros resolvem, e todos os provedores dão os valores prontos:

- **SPF** — declara quais servidores podem enviar pelo seu domínio.
- **DKIM** — assina cada mensagem; é o que prova que não foi forjada.
- **DMARC** — diz o que fazer quando SPF ou DKIM falham. Comece com
  `p=none` para observar, e só depois aperte.

Configure os três **antes** de virar `MAIL_ENABLED=true` em produção. Um
domínio queimado por disparar sem autenticação leva semanas para recuperar
reputação, e nesse meio-tempo nenhum e-mail seu chega.

Depois de ligar, mande o teste para um Gmail e confira se caiu na caixa de
entrada. Se caiu no spam, o efeito prático é idêntico ao de não enviar.

## Provedores

Qualquer SMTP serve — o código não conhece provedor, só fala SMTP. Com faixa
gratuita que cobre bem mais que os primeiros meses: **Resend**, **Brevo**,
**Amazon SES** e **Mailgun**. SES é o mais barato em volume e o mais chato de
configurar; Resend é o inverso.

**Não use Gmail ou o SMTP da hospedagem.** Ambos têm limites baixos e nenhum
relatório de entrega — você não fica sabendo o que não chegou.

## Como está construído

`backend/notify.js`.

- **Um transporte só**, criado uma vez e com pool. Criar um por e-mail joga
  fora as conexões e faz cada envio abrir um handshake TLS novo; com volume, o
  provedor começa a recusar por limite.
- **Três tentativas com espera crescente.** Falha de SMTP costuma ser
  transitória e uma tentativa só perde a mensagem. Mas um **5xx** é recusa
  definitiva e não é repetido — insistir em caixa inexistente só queima
  reputação do domínio.
- **Nunca estoura para quem chamou.** O webhook de pagamento chama
  `sendEmail`; uma exceção ali derrubaria a ativação de uma assinatura já paga.
  Falha de e-mail vira registro e log, nunca erro de resposta.
- **O histórico não guarda o corpo**, só destinatário, assunto e resultado —
  o corpo pode carregar dado do cliente.
- `SMTP_SECURE` liga sozinho na porta 465 (TLS implícito). A porta 587 usa
  STARTTLS. Errar essa dupla é o motivo mais comum de "conecta mas não envia".

## Variáveis

| Variável | Padrão | Para quê |
|---|---|---|
| `MAIL_ENABLED` | `false` | Ligar o envio real |
| `MAIL_FROM` | — | Remetente. Obrigatório |
| `SMTP_HOST` | — | Obrigatório |
| `SMTP_PORT` | `587` | 587 (STARTTLS) ou 465 (TLS) |
| `SMTP_SECURE` | `false` | Automático na 465 |
| `SMTP_USER` / `SMTP_PASS` | — | Vazio = sem autenticação |
| `MAIL_RETRIES` | `3` | Tentativas por mensagem |
| `SMTP_MAX_CONNECTIONS` | `3` | Conexões no pool |
| `SMTP_TIMEOUT_MS` | `15000` | Teto de conexão |
| `RATE_LIMIT_EMAIL_TESTE` | `10` | Testes por hora por IP |

## O que ainda não existe

- **Cobrança do ciclo seguinte** — o template de renovação existe, mas nada
  dispara. É o próximo bloco: sem ele ninguém paga o segundo mês.
- **Recuperação de senha** — depende deste subsistema, agora destravado.
- **HTML nos e-mails.** Hoje é texto puro, que entrega melhor e nunca quebra.
  Só vale mudar quando houver motivo real.
