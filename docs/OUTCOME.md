# Modelo de negócio: outcome as a service

**Status:** **implementado e em produção no código.** Cadastros novos entram
por resultado. Assinaturas antigas (preço fixo de R$ 99) seguem no preço fixo
até o fim do ciclo já pago e migram sozinhas no vencimento. Os valores foram
aprovados em 2026-11-09 (mínimo, preço por atendimento e teto abaixo).

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

## Como a cobrança funciona agora

- **Base da fatura:** cada atendimento concluído grava um timestamp em
  `subscription.atendimentos`. Não depende do ticket, que expira em 12 horas
  (LGPD). A lista é podada depois que a fatura é quitada.
- **Janela:** a fatura do vencimento cobre o uso desde `faturadoAte` até o fim
  do acesso atual. Uma janela é semiaberta, então um atendimento cai em
  exatamente uma fatura.
- **Entrada:** o primeiro pagamento é o mínimo, e ele é descontado da primeira
  fatura. Se o uso ficar abaixo do mínimo, a janela avança sem Pix.
- **Vencimento:** se houver valor devido, sai um Pix com o valor do uso. Ao
  pagar, `faturadoAte` avança para o fim faturado e a janela seguinte abre. Uso
  na tolerância de atraso vai para a fatura seguinte, sem perda nem dobra.
- **Aviso prévio:** não há Pix fixo. O e-mail mostra o valor mínimo e o preço
  por atendimento.
- **Migração de legado:** no aviso prévio do vencimento, a assinatura antiga vira
  `resultado` com `faturadoAte` no fim do ciclo já pago. Esse ciclo fica no preço
  fixo; o seguinte é cobrado pelo uso.
- **Cancelamento:** o acesso segue até o fim do ciclo. No dia do vencimento sai
  uma fatura final, uma única vez, sem abrir janela nova. Se ela não for paga, a
  pendência fica registrada; o sistema não persegue cobrança de quem cancelou.
- **Anual:** deixou de ser vendido. Quem já tinha anual mantém o ciclo até o
  fim, no preço fixo, como antes.

## O que ainda não existe

- **Cobrança recorrente automática.** Cada fatura é um Pix novo. Depende de
  preapproval do Mercado Pago ou de Pix Automático (ver `docs/PENDENCIAS.md`).
- **Previsão no painel durante o mês.** O cálculo existe (`subscriptionView`,
  campo `resultado.previsaoCentavos`), mas a tela do operador ainda não mostra a
  barra de consumo.
- **Cobrança de fatura final não paga.** Fica como pendência; não há
  perseguição automática.

## Decisões tomadas

1. **Valores:** mínimo R$ 29, R$ 0,12 por atendimento concluído, teto R$ 249.
   Configuráveis por env (`OUTCOME_*`).
2. **Migração:** quem paga R$ 99 mantém o ciclo já pago e migra no vencimento
   seguinte.
3. **Momento:** trocado agora, após aprovação.
4. **Plano gratuito:** mantido (50 entradas por dia, um balcão).
