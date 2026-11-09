# Modelo de negócio: outcome as a service

**Status:** proposta com a precificação implementada e testada em
`backend/outcome.js`. A cobrança real **ainda não usa** esse modelo: a
assinatura fixa de R$ 99/mês continua no ar até você aprovar a troca (ver
"Decisões que são suas").

## A mudança em uma frase

O cliente deixa de pagar por **ter a fila** e passa a pagar pelo **atendimento
concluído** — um resultado que o sistema mede sozinho.

## Por que mudar

- **O valor é o atendimento, não a ferramenta.** Assinatura fixa cobra o mesmo
  de uma clínica que atende 30 pessoas por mês e de uma que atende 1.500. Quem
  atende pouco acha caro e cancela; quem atende muito paga pouco pelo valor que
  recebe. O preço por resultado alinha os dois lados.
- **Entrada sem risco para o cliente.** Quem testa paga o mínimo, que é baixo.
  O crescimento da conta acompanha o crescimento do movimento dele, então a
  objeção "não sei se vai valer" some.
- **Resultado é mensurável sem pesquisa.** O sistema já registra cada ticket
  com `status` e `closedAt`. Não depende de o cliente declarar nada.

## O resultado que se cobra

**Atendimento concluído** = ticket que foi chamado e marcado como atendido
(`status: 'served'`).

Não entram na cobrança:

- **Quem faltou** (`absent`). Cobrar por quem não foi atendido é o jeito mais
  rápido de perder confiança.
- **Quem ainda está na fila** (`waiting`, `calling`). Ainda não aconteceu.

## A fórmula

```
fatura = min( max( mínimo ; atendimentos × preço_por_atendimento ) ; teto )
```

Valores iniciais, todos configuráveis por variável de ambiente:

| Parâmetro | Padrão | Env |
|---|---|---|
| Mínimo mensal | R$ 29,00 | `OUTCOME_MINIMO_CENTAVOS=2900` |
| Por atendimento concluído | R$ 0,12 | `OUTCOME_POR_ATENDIMENTO_CENTAVOS=12` |
| Teto mensal | R$ 249,00 | `OUTCOME_TETO_CENTAVOS=24900` |

### Por que cada parte existe

- **Mínimo (R$ 29):** cobre o custo fixo de manter a unidade no ar (VPS, suporte,
  conta). Sem ele, uma unidade parada custa dinheiro e não paga nada.
- **Preço por atendimento (R$ 0,12):** é o que cresce com o valor entregue.
- **Teto (R$ 249):** impede que uma unidade de grande movimento vire uma conta
  impagável e leve o cliente a sair. Também dá previsibilidade ao dono.

### Como o número se comporta

Calculado pela própria função (`calcularFatura`), não estimado:

| Atendimentos no mês | Fatura |
|---|---|
| 0 a 241 | R$ 29,00 (mínimo) |
| 300 | R$ 36,00 |
| 500 | R$ 60,00 |
| 1.000 | R$ 120,00 |
| 2.000 | R$ 240,00 |
| 2.075 ou mais | R$ 249,00 (teto) |

Dois pontos de corte a notar: abaixo de **242 atendimentos** o cliente paga só o
mínimo; a partir de **2.075** paga sempre o teto.

## Efeito na meta de receita

O GARIMPO calcula a meta de R$ 5.000/mês com preço fixo de R$ 99 — 51 unidades.
Com preço por resultado, a conta depende do **volume médio** de cada unidade:

- Unidade pequena (≈200 atendimentos/mês): R$ 29.
- Unidade média (≈1.000): R$ 120.
- Unidade grande (≈2.000): R$ 240.

A meta de R$ 5.000 passa a exigir **mais unidades pequenas** ou **menos grandes**,
conforme o mix. Esse mix é uma hipótese: só dá para validar com os dados reais
de movimento das primeiras unidades pagantes, que já ficam no `analitico.html`.
**Não tome a meta como garantida antes disso.**

## Como a cobrança muda

Hoje a cobrança é um valor fixo por ciclo, conhecido antes. Com outcome, o valor
só é conhecido **no fim do período**. Isso muda três coisas:

1. **Fechamento do período.** Um job conta os atendimentos do ciclo com
   `contarAtendimentos` e calcula a fatura com `calcularFatura`.
2. **Aviso prévio.** O e-mail de aviso precisa mostrar o valor da fatura do
   período que se encerra, não o valor fixo do próximo. A tela do cliente mostra
   a `previsao` do mês corrente, que usa a mesma regra da fatura final.
3. **Cobrança.** Como não existe cobrança recorrente automática no sistema
   (preapproval ainda não está implementado — ver `docs/PENDENCIAS.md`), a fatura
   variável sai como um Pix novo, emitido no fechamento. O cliente paga a cada
   mês. Isso é o mesmo fluxo de hoje, só com valor diferente.

## Riscos

- **Previsibilidade para o cliente.** Fatura que varia pode assustar. Mitigação:
  a previsão aparece no painel durante o mês, sem surpresa no fechamento.
- **Ajuste de fim de mês.** Se a previsão mostrada e a fatura final divergirem,
  o cliente perde confiança. Mitigação: as duas usam a mesma função; há teste
  garantindo a igualdade.
- **Incentivo perverso.** Cobrar por atendimento pode incentivar o operador a
  "fechar" atendimentos sem atender. Isso é uma questão real de produto. A
  mitigação é o painel mostrar o número de atendimentos junto com o tempo de
  espera; uma fila que anda e atende de verdade não distorce o número. Vale
  monitorar `absent` e tempo médio por atendimento.
- **Preço pode ser mal calibrado.** Os valores são palpite até termos dados. Por
  isso são variáveis de ambiente, e não constantes no código.

## O que já está pronto

- `backend/outcome.js`: regra de precificação, contagem de atendimentos,
  previsão. Funções puras, sem I/O.
- `backend/test/outcome.test.js`: 16 testes, cobrindo mínimo, variável, teto,
  monotonia (mais atendimento nunca custa menos), exclusão de quem faltou e
  validação de entrada.

## O que ainda não está pronto (e por que não foi feito agora)

- **Trocar a cobrança ao vivo.** Mexe em dinheiro real de clientes. Precisa da
  sua aprovação dos valores e de uma decisão sobre o plano atual.
- **Job de fechamento e aviso com valor variável.** Depende da decisão acima.
- **Tela de previsão no painel.** Depende da decisão acima.
- **Página pública de preços** (`frontend/planos.html`) e o checkout. Ainda
  mostram R$ 99. Não trocar antes de decidir.

## Decisões que são suas

1. **Aprovar os valores iniciais** (R$ 29 de mínimo, R$ 0,12 por atendimento,
   teto de R$ 249) ou ajustar. Eles são configuráveis, então a troca não exige
   código.
2. **Manter ou não o plano gratuito** com 50 entradas por dia. Ele funciona como
   aquisição; a proposta é mantê-lo.
3. **Migração de quem já paga R$ 99.** Opções: manter o preço fixo até o fim do
   ciclo e migrar no próximo, ou oferecer a troca antecipada com o mínimo como
   piso garantido.
4. **Quando trocar o preço público.** Só depois de ter ao menos algumas unidades
   com dado real de movimento.
