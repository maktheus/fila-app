# Prospecção — módulo de oportunidades

**Status:** passo 1 pronto (núcleo puro, persistência em Postgres, rotas do dono).
Passos 2 a 7 em `docs/PROSPECCAO.md#passos` (abaixo).

## O que é

Ferramenta para o dono do sistema encontrar empresas que podem comprar a fila
virtual, avaliar cada uma com regras explicáveis e decidir o contato. **Nada é
enviado automaticamente nesta fase.**

Adapta a estratégia "Universal AI Customer Discovery Platform" à realidade do
projeto: um monólito, um dono, Postgres, modelo local. Multi-tenant, RLS, 15
serviços, LangGraph e autonomia de envio ficam para depois, quando houver
segundo cliente e base legal revisada.

## Escopo deste passo

| Peça | Arquivo | Função |
|---|---|---|
| Validação de CNPJ | `backend/prospeccao/cnpj.js` | Dígitos verificadores. **Recusa CPF.** |
| Elegibilidade | `backend/prospeccao/elegibilidade.js` | Regras determinísticas e precedência |
| Pontuação | `backend/prospeccao/elegibilidade.js` | Nota 0–100 com motivo por critério |
| Persistência | `backend/prospeccao/repo.js` | SQL parametrizado, só Postgres |
| Rotas | `backend/prospeccao/rotas.js` | `/api/prospeccao/*`, atrás de `requireAnalyticsAuth` |

### Endpoints

- `GET /api/prospeccao/oferta` — oferta ativa (segmentos e UFs).
- `PUT /api/prospeccao/oferta` — define segmentos (prefixos de CNAE) e UFs.
- `GET /api/prospeccao/prospects` — lista por nota.
- `POST /api/prospeccao/prospects` — adiciona uma empresa à mão.

Sem `DATABASE_URL`, todas respondem **503**. Não há fallback em arquivo: prospect
guardado em memória some no restart e parece que foi perdido.

## Elegibilidade e nota são coisas separadas

Elegibilidade diz **se pode haver contato**. Nota diz **quão boa é a
oportunidade**. A nota nunca altera a elegibilidade.

Precedência (a primeira que bate decide):

1. `SUPPRESSED` — CNPJ ou e-mail na lista de supressão, ou situação cadastral
   diferente de ATIVA.
2. `REVIEW_REQUIRED` — duplicidade conflitante (previsto para o passo 2).
3. `CONSENT_REQUIRED` — e-mail de provedor pessoal. Sem consentimento, não entra.
4. `UNKNOWN` — nenhum canal de contato conhecido.
5. `ELIGIBLE` — empresa ativa com contato corporativo.

A nota (0–100) soma: segmento 40, situação 15, contato corporativo 20, área 25.
Cada critério devolve o motivo, então a nota é explicável.

## Dados que entram e o que não entra

Entram só: CNPJ, razão social, CNAE principal, município, UF, porte, situação
cadastral e e-mail **da empresa**.

Não entram: sócios, CPF, telefone pessoal, perfis de redes sociais, qualquer
dado extraído de pessoa física. A tabela não tem coluna para sócio. Campos fora
da lista são descartados antes de qualquer gravação, e há teste cobrindo isso.

A lista de supressão guarda **hash SHA-256** do CNPJ ou e-mail, nunca o valor em
claro. A comparação é feita pelo hash, normalizado em minúsculas e sem espaços.

## Base legal (hipótese a revisar)

Para contato B2B com e-mail corporativo, a hipótese é **legítimo interesse**
(LGPD, art. 7º, IX), com o raciocínio abaixo. **Isto não é parecer jurídico.**
Antes de qualquer envio real, um advogado deve revisar.

- **Finalidade:** oferecer um serviço de fila virtual a estabelecimentos que
  atendem público presencial.
- **Necessidade:** apenas os dados listados acima, só para decidir o contato.
- **Balanceamento:** o titular (a empresa) recebe mensagem relacionada à atividade
  dela, pode recusar, e o sistema respeita a recusa de forma permanente.
- **Oposição:** toda mensagem terá link de saída. A recusa entra na lista de
  supressão e bloqueia qualquer contato futuro.

Contato por e-mail pessoal exige consentimento e por isso fica como
`CONSENT_REQUIRED`. B2C entra apenas pela captação voluntária que já existe
(`/api/leads`), nunca por coleta em base pública.

## Não planejado

- Raspagem de perfis pessoais, LinkedIn ou redes sociais.
- Envio automático de qualquer natureza. Este módulo não importa `notify.js`.
- Provedores de dados pagos. Custo e licença precisam de decisão própria.
- Base completa da Receita Federal (dezenas de GB). Quando chegar o passo 7, será
  um extrato filtrado por UF e CNAE.

## Passos

1. **Pronto.** Núcleo puro, persistência, rotas, 27 testes.
2. Importação por CSV com relatório de linhas aceitas e recusadas.
3. Interface do operador: oferta, lista ordenada por nota, motivos.
4. Supressão e página de saída (`/optout/:token`).
5. Rascunhos de mensagem com aprovação humana. Continua sem envio.
6. Reescrita por modelo local com fallback para o modelo fixo.
7. Opcional: extrato filtrado da Receita Federal, em linha de comando.

## Testes

- `backend/test/prospeccao-core.test.js` — CNPJ, elegibilidade, nota e a
  invariante "nota não muda elegibilidade".
- `backend/test/prospeccao-rotas.test.js` — 503 sem banco, CPF recusado, supressão,
  e-mail pessoal, campos descartados, validação de oferta.
