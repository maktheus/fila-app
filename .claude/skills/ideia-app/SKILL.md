---
name: ideia-app
description: Aplica o playbook real dos vídeos "app ridículo" + "clone chinês validado" a uma ideia de app. Use quando o usuário trouxer uma ideia de aplicativo/micro-SaaS e quiser transformá-la em um plano de produto simples, construível com Claude Code/Codex e monetizável por assinatura Pix (meta R$ 4-5 mil/mês). Input esperado - a ideia em uma ou mais frases.
argument-hint: <sua ideia de app>
---

# Skill: ideia-app

Você recebeu uma **ideia de app** como input: `$ARGUMENTS`

Se o input estiver vazio, peça ao usuário a ideia em 1-3 frases antes de continuar.

O playbook abaixo foi extraído das **transcrições reais** dos dois vídeos catalogados em `videos.json` (mesma pasta). Leia o JSON se precisar das citações exatas (ferramentas, preços, passos). Produza o plano completo em português.

## Etapa 1 — Reduzir ao ridículo

- Reescreva a ideia em **1 frase** ("<app> ajuda <público> a <resultado> sem <fricção>").
- Corte tudo que não for a funcionalidade central. Liste explicitamente o que foi cortado do MVP.
- Se a ideia tiver mais de uma dor, escolha a mais recorrente (uso diário/semanal) e descarte o resto.
- Lembre a regra dos vídeos: o app é só a **portinha de entrada** (modelo Duolingo — grátis, cria rotina, assinatura vira a saída do incômodo).

## Etapa 2 — Checar validação de mercado (lente do clone)

Os vídeos garimpam ideias validadas antes de construir. Aponte ao usuário **onde procurar** o equivalente da ideia dele:

- **Apps similares no Ocidente**: em uma ferramenta de análise de apps, usar a seção de aquisição orgânica ("Organic User Acquisition") para entrar em apps parecidos muito baixados e bem monetizados que não aparecem nos rankings óbvios (no vídeo: Water Tracker >US$30k/mês, AutoSleep).
- **Rankings da China**: Sensor Tower (só App Store) e **Qimai/Kimi (七麦)** para as lojas Android chinesas (exige número chinês → chip virtual). É de lá que vêm as tendências.

Para uma validação profunda (mercado, concorrentes, tamanho), invoque a skill `market-research` (ECC, nesta pasta de skills).

Dê um veredito: `CLONE LOCALIZADO` (existe lá fora, não aqui), `NICHO DE UM GIGANTE` (diferencie ou desista cedo) ou `IDEIA NOVA (validar antes)`.

## Etapa 3 — Nota da ideia (0 a 10)

Pontue 2 pontos para cada critério atendido (os 3 filtros do vídeo 2 + 2 do vídeo 1):

1. **Simples de criar** — poucas telas, poucas funções, explicável em 1 frase
2. **Fácil de replicar** — sem tecnologia pesada escondida; o difícil deve ser *perceber* a ideia, não construir a tech
3. **Faz sentido no Brasil** — dor humana universal (solidão, organização, dinheiro, saúde, relacionamento)
4. **Dor recorrente** — uso semanal ou diário
5. **Público que já paga** por soluções parecidas (freemium → assinatura barata)

Nota < 6: proponha 2-3 variações da ideia que subam a nota e reavalie a melhor delas.

## Etapa 4 — Plano de construção com Claude Code / Codex

- **Gerar o plano primeiro** (80% planejamento, 20% execução — sem plano vira "AI slop"):
  - Copie o link da App/Play Store do app de referência e peça um plano completo (ChatGPT), **ou** dite o plano por voz com o Whisper e cole o texto.
  - Cole esse plano no Claude Code/Codex e peça para ele **criar um plano por cima** (revisar/aquecer) antes de codar.
- **Modelos**: use **Opus 4.8 (esforço máximo) para planejar** e troque para **Sonnet para executar** (economiza tokens).
- **Design via skill**: pesquisar `brand guidelines <marca de capital aberto>` (Duolingo, Revolut publicam tudo), copiar o domínio e pedir ao Claude para estudar e virar uma skill de design reutilizável. Depois: "crie o app com base nessa skill". **Inspirar, não copiar 100%** (risco judicial).
- **Construção**: em **blocos**, aprovando cada um — ou ligar o **modo automático**. Para builds multi-sessão, estruture o plano com a skill `blueprint` (ECC); para posicionamento de marca, `brand-discovery` (ECC).
- Entregue: stack mínima (padrão web app / PWA; banco só se indispensável → Supabase), até 3 telas do MVP, e o **prompt inicial pronto** (bloco de código em português, específico da ideia).

## Etapa 5 — Publicação

Escolha e recomende UM dos 3 caminhos dos vídeos:

- **Web** (mais rápido): deploy em **Netlify/Vercel** — o Claude Code/Codex tem integração/plugin que faz automático (mencione `@netlify` ou `@vercel`). MVP na Vercel + Supabase; AWS só quando crescer.
- **PWA**: a mesma web "adicionada à tela de início" do celular, como atalho/app.
- **Lojas**: Google Play (taxa única, mas exige **12 testadores por 14 dias**) e Apple (**US$99/ano**). A loja só cobra comissão quando há venda por dentro; enquanto grátis, não cobra.

Depois de publicado, comprar um domínio personalizado (a própria Vercel/Netlify intermedeia).

## Etapa 6 — Monetização de trás para frente

- Meta padrão: **R$ 5.000/mês** (ajuste se o usuário der outra).
- Monte a tabela `preço x assinantes necessários` com 3 cenários (ex.: **R$ 9,90/mês** como no vídeo, R$ 19/mês, R$ 49/mês).
- **Checkout via Cacto/Pix** (padrão dos vídeos; alternativas Stripe/Mercado Pago): copiar a página de introdução da API da Cacto, mandar pro Claude conectar, criar produto de **assinatura recorrente** e configurar **webhooks para eventos Pix**. Backend leve: confirmação de e-mail + senha + recuperação de senha.
- Lembre de **testar comprando o próprio app** antes de lançar.

## Etapa 7 — Segurança antes de soltar (não pule)

**Se o código do app já existir neste workspace, invoque a skill `security-review` (vendorizada do ECC, nesta mesma pasta de skills) para rodar o checklist completo.** Para a config do agente (`.claude/`), use `security-scan`. Se o app ainda não foi construído, inclua no relatório o checklist abaixo como pendência obrigatória pré-deploy:

- Pedir ao Claude: **"verifique se há algo hardcoded"** (senha, chave, segredo) e se há **arquivo `.env` ou API key vazando** no código/front.
- Rodar a extensão **Snyk** no VS Code (vazamentos e vulnerabilidades).
- Checar `robots.txt`/sitemap e garantir que rotas de admin/backoffice (**`/admin`**) **não** fiquem expostas/enumeráveis.
- Avisar do risco LGPD: o dono do app é o responsável pelo vazamento — obrigação de notificar clientes e **multa de 5% do faturamento anual, à vista**.

## Formato da saída

Entregue tudo em um único relatório, nesta ordem:

**Ideia em 1 frase → Onde validar (referência de mercado) → Veredito → Nota (x/10) → MVP + prompt de construção (com modelo Opus→Sonnet) → Caminho de publicação → Plano de receita (tabela) → Checklist de segurança → Próxima ação única** (a única coisa que o usuário deve fazer hoje).
