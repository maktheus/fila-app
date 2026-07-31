# Pendências — o que ainda quebra o "zero participação"

Este documento existe porque o objetivo declarado do produto é **funcionar de
ponta a ponta sem você participar de nenhum ponto**. Cada item abaixo é um
lugar onde a corrente arrebenta hoje e o processo volta para o seu colo.

Ordenado por quanto custa deixar como está, não por dificuldade.

---

## 1. ✅ Os e-mails — construído em 31/07

**Estado: o envio funciona.** Testado ponta a ponta contra um SMTP real: o
cadastro de uma unidade disparou o e-mail sozinho e ele chegou.

O que existia antes era uma armadilha: o `require('nodemailer')` estava no
código mas a dependência **não estava instalada**. Ligar `MAIL_ENABLED=true`
faria o `require` estourar, o `catch` engolir, e você veria o sistema
respondendo normalmente sem nada sair.

O que foi construído: dependência instalada, um transporte com pool em vez de um
por mensagem, três tentativas com espera crescente para falha transitória (e
nenhuma para 5xx, que é recusa definitiva), verificação na subida que **grita no
log** se estiver ligado e quebrado, `GET /api/email/status` e
`POST /api/email/teste` para conferir sem esperar um cadastro real, e um coletor
de e-mail local no compose (`--profile mail`) para ver as mensagens sem
contratar provedor.

Procedimento completo em **[EMAIL.md](EMAIL.md)**.

**O que ainda é seu:**

1. **Escolher e contratar um SMTP.** Resend, Brevo, SES e Mailgun têm faixa
   gratuita que cobre muito mais que os primeiros meses. Não use Gmail nem o
   SMTP da hospedagem: limite baixo e nenhum relatório de entrega.
2. **Configurar SPF, DKIM e DMARC** no domínio **antes** de ligar em produção.
   Domínio novo disparando sem autenticação cai em spam, e o efeito prático é
   idêntico ao de não enviar. Pior: um domínio queimado leva semanas para
   recuperar reputação.
3. **Mandar o teste para um Gmail** e confirmar que caiu na caixa de entrada.

---

## 2. Ninguém paga o segundo mês

**Estado:** a primeira cobrança é gerada — no chat (Pix) ou em `assinar.html`
(Pix ou cartão). A **renovação não existe**. Não há job de ciclo, não há
cobrança recorrente, não há e-mail de "sua mensalidade venceu".

**Por que dói:** como não guardamos cartão nem usamos débito automático, o
cliente só paga de novo se for lembrado. Sem o lembrete, a receita morre no mês
1 e o `effectivePlan()` derruba a unidade para o gratuito sozinha — o cliente
descobre pelo produto piorando, o que é a pior forma de descobrir.

**Caminhos, do mais simples ao mais completo:**

1. **Job de ciclo + e-mail** (algumas horas de trabalho). Um `setInterval` que
   varre as unidades com `currentPeriodEnd` próximo, gera a cobrança do ciclo e
   dispara o e-mail. Reaproveita tudo que já existe. Depende do item 1.
2. **Preapproval do Mercado Pago** (assinatura de verdade, com cartão). O MP
   cobra sozinho todo mês. **Não implementei porque não consegui confirmar a
   forma exata do endpoint na documentação** — a página da referência devolveu
   404 nas duas tentativas. Escrever integração de pagamento a partir de
   memória é como esse tipo de bug entra em produção. Precisa ser confirmado
   contra a conta real antes de codar.
3. **Pix Automático.** O rail do Banco Central está no ar desde junho de 2025 e
   em rollout ao longo de 2026. É a resposta certa a médio prazo para um
   produto brasileiro de assinatura barata, porque não tem MDR. Vale checar com
   o MP se a sua conta já tem.

O adaptador em `backend/payments/mercadopago.js` está estruturado para receber
qualquer um dos três sem mexer no resto.

---

## 3. Não dá para cancelar sozinho

**Estado:** não existe. Para cancelar, o cliente precisa falar com você.

**Por que isso é mais sério que os outros:** é **obrigação legal**. O Código de
Defesa do Consumidor exige que cancelar seja tão fácil quanto contratar — e
contratar aqui leva um clique num chat. Um cancelamento que exige e-mail e
espera é exatamente o que o Decreto 11.034/2022 endereça.

Além do risco jurídico, é o item que mais te puxa de volta para dentro do
processo: cada cancelamento vira uma conversa sua.

**O que fazer:** botão no painel do operador → `POST /api/venues/:slug/cancelar`
→ `subscription.status = 'canceled'`, mantendo o premium até o fim do ciclo já
pago (`currentPeriodEnd`), com e-mail de confirmação. O `applyEvent` já entende
`subscription.canceled`; falta a rota e o botão.

---

## 4. Senha perdida = cliente perdido

**Estado:** a senha do operador é gerada aleatoriamente no cadastro, mostrada
**uma única vez** e guardada só como hash scrypt. Não existe recuperação.

**O que acontece na prática:** a recepcionista fecha a aba antes de anotar. O
estabelecimento perde o painel. A fila continua funcionando para quem entra,
mas ninguém consegue chamar ninguém. A única saída é falar com você — e você
também não tem como recuperar, só resetar direto no banco.

**O que fazer:** `POST /api/venues/:slug/recuperar-senha` que gera um token de
uso único com validade curta, manda por e-mail para o `contactEmail`, e uma
tela que troca o token por uma senha nova. Depende do item 1.

**Cuidado ao construir:** a resposta tem que ser idêntica para e-mail que existe
e e-mail que não existe, senão a rota vira um enumerador de clientes seus.

---

## 5. Google Pay depende de dois identificadores não confirmados

**Estado:** o cartão está construído e testado. Falta um dado que só o Mercado
Pago pode dar.

O Google Pay cifra os dados do cartão **para um processador específico**. Isso é
declarado no `tokenizationSpecification`:

```json
{ "type": "PAYMENT_GATEWAY",
  "parameters": { "gateway": "???", "gatewayMerchantId": "???" } }
```

Pesquisando a documentação do Google e a do Mercado Pago, **não encontrei o
Mercado Pago declarado como gateway do Google Pay** com um identificador
público. Sem o identificador certo, o token que o Google gera não é decifrável
pelo MP e a cobrança falha na hora do clique.

**O que fazer:** abrir chamado no suporte do Mercado Pago perguntando
literalmente: *"qual o `gateway` e o `gatewayMerchantId` para tokenização do
Google Pay Web na minha conta?"*. Preencher `GPAY_GATEWAY` e
`GPAY_GATEWAY_MERCHANT_ID`.

Enquanto estiverem vazios, **o botão simplesmente não aparece** e o Pix segue
funcionando. Isso é intencional: um botão de pagamento que quebra no clique
custa mais confiança do que um botão ausente.

**Se o MP não suportar**, o plano B é a tokenização do próprio MP (Checkout
Bricks), que é o caminho oficial deles para cartão. Dá o mesmo resultado —
número do cartão nunca toca o nosso servidor — só perde a conveniência de um
toque do Google Pay.

**Também é seu:** registrar o domínio no Google Pay Business Console, com HTTPS,
e passar pela revisão da tela de checkout antes de virar `GPAY_ENVIRONMENT` para
`PRODUCTION`.

---

## 6. O vendedor local fecha ~4 de 5

**Estado:** medido, não estimado. Rodando a jornada completa contra o
`qwen2.5:7b`, quando a demonstração é criada a venda fecha em cerca de 4 de cada
5 conversas. O resto o modelo enrola, e os guardrails barram quando ele tenta
fingir que gerou o Pix.

**Não é bug, é o teto de um modelo de 7B.** As opções:

- **Aceitar.** Perder 1 em 5 conversas com custo zero de inferência pode ser o
  trade certo enquanto o volume é baixo.
- **Trocar o provedor no momento da venda.** `CHAT_PROVIDER=claude` só quando a
  conversa chega em intenção de compra. Custo por token só onde vira receita.
- **Modelo local maior**, se a VPS tiver GPU.

O `laboratorio.html` mede isso caso a caso — dá para comparar antes de decidir.

**Latência: resolvida, e não era o modelo.** Medido numa RTX 4060 com
`qwen2.5:7b`: modelo frio 5,5s, quente 1,0s a ~37 tokens/s. Os "3 a 20 segundos"
que apareciam eram quase todos custo de recarregar 4,7GB do disco para a VRAM —
o Ollama descarrega depois de 5 minutos, e num site de baixo tráfego quase todo
visitante pegava o modelo frio.

Corrigido com `keep_alive` em toda chamada (`LOCAL_LLM_KEEP_ALIVE`, padrão 30m)
e um aquecimento na subida do servidor. Ficou em **1,1 a 2,5s**.

Vale registrar o que **não** serve aqui: **AirLLM é o contrário do que se
quer**. Ele fatia o modelo camada por camada para caber num GPU pequeno, e paga
isso em velocidade — os relatos vão de 0,7 token/s a casos extremos de 100
segundos por token. É solução de memória, não de latência.

Se um dia a latência voltar a incomodar, o caminho de verdade é **speculative
decoding** (um modelo-rascunho pequeno propõe tokens e o grande valida em uma
passada só; pares como Qwen 0.6B → 8B dão ~1.9×) ou um modelo menor. Nada disso
é necessário hoje.

---

## 7. Nada disso está no ar

O sistema roda inteiro em Docker, com testes e CI verdes, mas em `localhost`.

Para virar produto público falta, na ordem:

1. **Domínio + HTTPS** na VPS. Trava tudo abaixo: assetlinks, Play Store, Google
   Pay e os webhooks do Mercado Pago (que precisam de URL pública).
2. **Conta no Mercado Pago**, `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`, e o
   webhook cadastrado apontando para `/api/webhooks/mercadopago` nos tópicos
   `orders` e `payment`.
3. **Keystore de release** e Play Console, para o app Android.
4. **`CORS_ORIGIN`** restrito ao domínio e `NODE_ENV=production` — hoje, fora de
   produção, o CORS aceita qualquer origem.
5. **Backup do Postgres.** Não existe script. Um volume Docker sem backup é
   perda de dados esperando acontecer.
6. **Rodar `/security-review`** antes do primeiro deploy real, como manda o
   `CLAUDE.md`.

---

## 8. Distribuição não começou

A landing tem SEO, Open Graph, JSON-LD e sitemap prontos. O chatbot atende. O
cartaz de balcão imprime. Mas nenhum canal está **ligado**:

- **Google Ads** — plano escrito em `docs/MARKETING.md`, R$ 20/dia. Precisa da
  conta e do cartão.
- **Play Store** — ficha escrita, release automatizado. Precisa de domínio,
  keystore e 12 testadores por 14 dias no teste fechado.
- **Conteúdo** — plano escrito, nada publicado.

O produto funciona antes de qualquer um desses. Mas sem pelo menos um, ninguém
descobre que ele existe.

---

## Ordem que eu seguiria

1. ~~E-mails (item 1)~~ — feito em 31/07. Falta contratar o SMTP e o DNS.
2. **Domínio + HTTPS** (item 7) — destrava tudo que é externo.
3. **Cancelamento** (item 3) — obrigação legal, não escolha.
4. **Renovação** (item 2) — sem isso não existe receita recorrente.
5. **Recuperação de senha** (item 4).
6. O resto, conforme aparecer volume.
