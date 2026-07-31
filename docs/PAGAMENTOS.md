# Fechar a venda no chat — Pix pelo Mercado Pago

O visitante conversa, vê a fila dele funcionando e paga sem sair da conversa.
Sem formulário, sem redirecionar, sem cartão.

## A jornada

1. **"quero ver funcionando na Barbearia do Zé"** → `criar_demonstracao` cria a
   fila real e a conversa passa a ter dono: a unidade fica guardada na sessão.
2. **"quero assinar, meu e-mail é…"** → `gerar_pix_da_assinatura` gera a
   cobrança. O bloco de pagamento aparece na tela com QR, código copia-e-cola e
   botão de copiar.
3. **Pagamento cai** → o Mercado Pago chama o webhook, o servidor confirma o
   recurso na API do MP e o premium libera. Ninguém do nosso lado toca em nada.

## Três decisões que valem entender

### O valor não passa por lugar nenhum que alguém possa mexer

`gerar_pix_da_assinatura` **não tem parâmetro de valor**, e a rota
`POST /api/venues/:slug/cobranca` **ignora qualquer campo de preço no corpo**. O
valor sai de `PRICE_CENTS` e de lugar nenhum mais.

Isso não é paranoia: um chatbot que aceita valor por parâmetro é um chatbot que
alguém convence a vender por R$ 1,00 — e prompt injection é barato. Há teste
cobrindo: mandar `{"amount":1,"total_amount":"0.01"}` na requisição continua
cobrando R$ 99,00.

### A unidade vem da conversa, não do modelo

A ferramenta também não recebe o slug da unidade. Pedimos ao `qwen2.5:7b` para
usar `otica-fecha-agora` e ele mandou `ótica-fecha-agora` numa tentativa e
`oticafecha-agora` na seguinte. **Modelo pequeno não transcreve identificador.**

A unidade sai da sessão da conversa — a que o `criar_demonstracao` criou nela.
De quebra, o modelo fica impedido de gerar cobrança para a unidade de outra
pessoa, mesmo que alguém peça.

### O código Pix não passa pelo modelo

Na primeira versão o código voltava para o modelo, que devia repeti-lo tal
qual. Ele emendou o campo de validade dentro do código:

```
tool:   ...|540599.00|2026-07
modelo: ...|540599.00|2026-07-31T23:07:38.598Z
```

Num BR Code de verdade isso quebra o CRC16: o app do banco recusa, o cliente não
consegue pagar e acha que o problema é nosso. **Não há prompt que conserte
isso** — um LLM não copia string opaca longa de forma confiável.

Hoje a ferramenta devolve ao modelo só `{pix_gerado, valor}`. O código vai por
fora, em `pagamento` na resposta da API, e o widget desenha o bloco. O modelo só
anuncia. Também ficou melhor de usar: botão de copiar e QR valem mais que um
código numa bolha de chat.

## API do Mercado Pago

### Criar a cobrança

`POST https://api.mercadopago.com/v1/orders` — a **Orders API**, que é o caminho
que a documentação atual do Checkout Transparente indica. A `/v1/payments`
clássica continua existindo, mas integração nova entra pela Orders.

```
Authorization: Bearer <MP_ACCESS_TOKEN>
X-Idempotency-Key: <estavel por unidade+mes>
```

```json
{
  "type": "online",
  "processing_mode": "automatic",
  "total_amount": "99.00",
  "external_reference": "barbearia-do-ze",
  "payer": { "email": "dono@barbearia.com.br" },
  "transactions": { "payments": [{
    "amount": "99.00",
    "payment_method": { "id": "pix", "type": "bank_transfer" },
    "expiration_time": "PT1440M"
  }]}
}
```

A resposta traz o código em
`transactions.payments[0].payment_method.qr_code` (o copia-e-cola BR Code),
`qr_code_base64` (PNG pronto) e `ticket_url`.

A chave de idempotência é derivada de `unidade + competência`. Clique duplo ou
retry devolvem a **mesma** cobrança em vez de criar duas — o que seria cobrar o
cliente duas vezes.

### O webhook assina diferente do resto

**Este é o ponto que estava errado no código antes.** O `billing.js` fazia HMAC
sobre o corpo cru, que é o esquema de provedores como a Cakto. O Mercado Pago
manda:

```
x-signature: ts=1704908010,v1=618c85345248dd...
x-request-id: <id>
```

e espera que você **remonte um manifesto** e assine ele:

```
id:<data.id>;request-id:<x-request-id>;ts:<ts>;
```

HMAC-SHA256 com a chave secreta que aparece em *Webhooks > Configurar
notificação* — que **não** é o access token nem o `PAYMENT_WEBHOOK_SECRET`.

Do jeito antigo, todo webhook legítimo do MP seria recusado com 401 e nenhuma
assinatura paga jamais ativaria o premium. Silenciosamente.

O handler também **não confia no corpo**: pega o id, consulta o recurso na API
do MP e decide pelo que a API responde. Corpo forjado não vira premium.

### Cadastrar no painel

- URL: `https://SEU-DOMINIO/api/webhooks/mercadopago`
- Tópicos: `orders` e `payment`
- Responder 200 em até 22 segundos, senão o MP reenvia (por isso a idempotência
  por recurso no handler)

## Recorrência: o que existe e o que não

Hoje é **Pix avulso por ciclo**. Não há débito automático nem cartão salvo. A
cada mês sai uma cobrança nova por e-mail, e cancelar é não pagar.

Pix recorrente de verdade só existe via **Pix Automático**, o rail do Banco
Central no ar desde junho de 2025 e em rollout ao longo de 2026. A documentação
de assinaturas do MP lista Pix entre os meios aceitos, mas não fecha a
especificação de API — e não dá para confirmar se uma conta específica tem o
recurso habilitado sem ter a conta.

Escolhi o avulso porque **funciona hoje**, não depende de rollout e não pede
cartão. O adaptador está pronto para receber o Pix Automático depois sem mexer
no resto.

Isso mudou o que o vendedor pode dizer. O bloco de fatos dizia "Pix recorrente",
o que viraria promessa quebrada, e agora diz a verdade. Os guardrails de saída
barram "débito automático", "renovação automática", "cadastre o cartão" e
"boleto" — coisas que não existem e que o cliente só descobriria no mês
seguinte, quando o premium caísse.

**Custo do avulso:** churn passivo. Quem esquece de pagar cai para o free sem
querer. Vale acompanhar `cobranca_gerada` contra `payment.confirmed` no painel
de comportamento — se a distância for grande, o problema é o lembrete, não o
produto.

## Testar sem conta em banco

`PAYMENT_PROVIDER=sandbox` (o padrão) gera cobranças de mentira com QR de
verdade, e a jornada inteira roda local:

```bash
docker compose up -d
```

O código de teste sai marcado como `SANDBOX-NAO-PAGAVEL` e **não** segue o
formato BR Code: colado num app de banco, falha na hora. Um código de teste que
quase funciona é pior que um que obviamente não funciona.

Para confirmar um pagamento de mentira (só fora de produção):

```bash
curl -X POST http://localhost/api/cobrancas/SBX-XXXX/confirmar-sandbox
```

## Variáveis

| Variável | Padrão | Para quê |
|---|---|---|
| `PAYMENT_PROVIDER` | `sandbox` | `sandbox` ou `mercadopago` |
| `MP_ACCESS_TOKEN` | — | Access token de produção do MP |
| `MP_WEBHOOK_SECRET` | — | Chave secreta do webhook (≠ access token) |
| `MP_PIX_EXPIRA_MINUTOS` | `1440` | Validade do Pix (30 a 43200) |
| `MP_TIMEOUT_MS` | `15000` | Teto de espera da API do MP |
| `PLAN_PRICE_CENTS` | `9900` | **A única fonte do valor cobrado** |
| `RATE_LIMIT_COBRANCA` | `10` | Cobranças por hora por IP |

## O que ainda falta

- **Cobrança do ciclo seguinte.** Hoje a primeira cobrança é gerada; a renovação
  mensal automática por e-mail ainda não existe. Sem ela, ninguém paga o
  segundo mês.
- **Cancelamento self-service.** Obrigação do CDC e ainda não construído.
- **Pix Automático**, quando estabilizar.
