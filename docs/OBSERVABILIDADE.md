# Observabilidade de comportamento

Duas camadas diferentes, que respondem perguntas diferentes:

| Camada | Pergunta | Onde |
|---|---|---|
| Infraestrutura | O serviço está no ar? | `docs/MONITORAMENTO.md` (Uptime Kuma) |
| Comportamento | Onde as pessoas travam? | este documento (`/analitico.html`) |

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
