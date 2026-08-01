# Observabilidade

O objetivo do produto é funcionar sem você participar. Mas um negócio que você
não observa é um negócio que você não consegue consertar — e a falha mais cara
não é a que quebra alto, é a que roda em silêncio por semanas.

Três camadas, cada uma respondendo uma pergunta diferente:

| Camada | Pergunta | Onde |
|---|---|---|
| Negócio | Está fazendo dinheiro, e está inteiro? | `/painel.html` |
| Comportamento | Onde as pessoas travam? | `/analitico.html` (este documento) |
| Infraestrutura | O serviço está no ar? | `docs/MONITORAMENTO.md` (Uptime Kuma) |

---

## Painel do dono — `/painel.html`

`GET /api/painel`, autenticado. Uma leitura só, porque se você precisa abrir
cinco abas para saber se o negócio está de pé, você não abre nenhuma.

**Receita recorrente por mês** é o número grande. O plano anual entra dividido
por doze: somar R$ 990 num mês só inflaria a receita e daria a impressão de que
entra dez vezes mais do que entra.

Abaixo dele, o que é acionável:

- **Testes vencendo em 3 dias** — a lista mais útil que existe aqui. É a hora
  em que a pessoa decide pagar ou sumir.
- **Assinaturas vencendo em 7 dias** — quem o ciclo vai cobrar.
- **Estornos a confirmar** — sua lista de tarefas: dinheiro que você prometeu
  devolver e ainda não devolveu. O botão marca como pago depois de você
  confirmar no painel do provedor.

### Saúde: cada luz é algo que para o negócio sem barulho

| Luz | Vermelho significa |
|---|---|
| Banco de dados | nada funciona — você vai saber rápido |
| E-mail | cadastro, cobrança e recuperação de senha não chegam a ninguém |
| Vendedor | o chat não atende, e a landing vira folheto |
| Pagamento | em produção, `sandbox` = ninguém está pagando de verdade |
| Links assinados | sem `LINK_SECRET`, cancelar volta a depender da senha |
| Cobrança automática | job parado há mais de 3h = receita parada |

Duas merecem explicação, porque são do tipo que mostra verde estando errada:

**Pagamento em sandbox** só é verde fora de produção. Em produção, sandbox
significa que a receita no painel é imaginária — o falso positivo mais caro que
existe aqui, e por isso fica vermelho.

**Cobrança automática** olha quando o job rodou pela última vez, não se ele
existe. Um `setInterval` que morreu continua "configurado".

## Avisos: só dinheiro

`OWNER_EMAIL` recebe um e-mail quando o dinheiro se mexe: alguém assinou,
renovou, cancelou (com o estorno a confirmar, se houver) ou caiu para o
gratuito por falta de pagamento.

**Só dinheiro entra aqui, de propósito.** Aviso de tudo vira ruído, ruído vira
filtro, e filtro faz você perder o aviso que importava.

Todo aviso também vai para o log com o prefixo `[dinheiro]`, mesmo sem
`OWNER_EMAIL` configurado — assim o histórico existe de qualquer jeito.

**Cuidado:** `OWNER_EMAIL` vazio desliga os avisos em silêncio. O servidor diz
na subida qual caso está valendo. Variável que desliga recurso sem avisar é a
pior espécie — o sistema responde normal e você só descobre o que perdeu quando
vai procurar.

## O que o servidor grita na subida

Antes de qualquer requisição, o log já responde:

```
E-mail pronto: smtp.provedor.com como Fila Virtual <nao-responda@dominio.com.br>
Avisos de dinheiro vao para voce@dominio.com.br.
Modelo local aquecido e residente.
Ciclo de cobranca a cada 60min · tolerancia 3d · aviso 3d antes
```

E quando algo está ligado e quebrado, em maiúsculas:

```
E-mail LIGADO MAS QUEBRADO: getaddrinfo ENOTFOUND smtp.errado.com
OWNER_EMAIL vazio: avisos de dinheiro so no log, ninguem sera notificado.
```

## O que ainda não existe

- **Alerta de coisa quebrada.** O painel mostra, mas não te procura. Um monitor
  externo em `/api/health` cobre o caso mais grave; e-mail parado ou modelo
  caído só aparecem se você olhar.
- **Histórico de receita.** O painel mostra o agora, não a curva.
- **Resumo semanal.** Você preferiu só os avisos de dinheiro; se mudar de
  ideia, `billing.metricas()` já devolve tudo que ele precisaria.

---

# Observabilidade de comportamento

## O que é coletado

O tracker (`frontend/analytics.js`) roda em todas as telas e envia em lote a cada
4 segundos, mais um envio garantido por `sendBeacon` quando a aba fecha.

- **Abertura de tela** com a origem (só o domínio de quem indicou);
- **Cliques marcados** — qualquer elemento com `data-ev="nome"` vira `clique:nome`;
- **Etapas de funil** disparadas pelo código (`FilaAnalytics.track`);
- **Erros de JavaScript** e promessas rejeitadas, com arquivo e linha;
- **Falhas de API**, com a rota agrupada (`/api/venues/:slug/tickets/:id`) e o status;
- **Clique repetido** (3 toques no mesmo alvo em 1 s) — sinal de que algo não respondeu;
- **Formulário abandonado** — mexeu nos campos e saiu sem enviar.

## O que nunca é coletado

Esta parte é obrigação, não escolha:

- **Nada do que foi digitado.** No abandono de formulário vai o *nome do campo*, nunca o conteúdo.
- **Nenhum identificador pessoal.** A sessão é um código aleatório guardado em
  `sessionStorage`, que some quando a aba fecha e não se liga a nome, e-mail ou ticket.
- **IP não é gravado** junto do evento.

O servidor não confia no cliente: `backend/analytics.js` descarta qualquer chave
de `props` fora da lista permitida. Se o front mandar um valor digitado por
engano, ele morre na entrada — há teste cobrindo isso.

## Os dois funis

**Dono do estabelecimento** — abriu a landing → clicou em criar fila → começou o
cadastro → criou a unidade → abriu o cartaz → entrou no painel → chamou alguém →
foi para o pagamento.

**Cliente na fila** — abriu pelo QR → digitou o nome → entrou na fila →
acompanhou a vez → foi chamado.

Cada etapa conta **sessões distintas**, não eventos: quem clica três vezes no
mesmo botão conta uma vez. A queda entre etapas é o número que interessa — o
painel destaca automaticamente o maior tombo.

## Como usar

```bash
docker compose up -d
```

Abra `/analitico.html`, entre com a senha do operador da unidade principal e
escolha o período. A leitura prática:

| O que aparece | O que investigar |
|---|---|
| Queda grande logo após "Criou a unidade" | O dono se cadastrou e não levou o QR para o balcão — o próximo passo não está óbvio |
| Queda entre "Digitou o nome" e "Entrou na fila" | Algo falha no envio; confira `erro:api` na mesma janela |
| `frustracao:clique_repetido` subindo | Botão que não dá retorno visível ao ser tocado |
| `form:abandonado` concentrado num campo | Aquele campo está espantando gente |
| `erro:api` com status 402 | Não é defeito: é o limite do plano gratuito sendo atingido — é oportunidade de venda |

## Retenção e volume

Eventos ficam `ANALYTICS_RETENTION_DAYS` dias (padrão 90) e são expurgados pelo
mesmo temporizador que limpa os tickets. A tabela é append-only e fica fora do
ciclo de reescrita do estado da fila, para não pesar nas operações do balcão.

Se o volume crescer, os primeiros ajustes são reduzir a retenção e parar de
gravar `tela:aberta` de telas que não entram em nenhum funil.

## Variáveis

| Variável | Padrão | Para quê |
|---|---|---|
| `ANALYTICS_RETENTION_DAYS` | `90` | Por quantos dias os eventos ficam |
| `RATE_LIMIT_EVENTS` | `120` | Lotes por minuto por IP |
| `window.FILA_ANALYTICS_ENABLED` | `true` | Desliga a coleta no front (defina `false` no `config.js`) |
