# Mutum — Design System

> Sistema de design para a **Mutum**, startup de tecnologia do Amazonas (Brasil).
> Inspirado no mutum, ave nativa da floresta amazônica — força, presença e raízes locais.

---

## 1. Sobre a marca

**Mutum** é uma startup de tecnologia sediada no Amazonas, com a missão de **resolver problemas de tecnologia para o Norte e Nordeste do Brasil**. O nome vem da ave *Mutum* (Cracidae) — endêmica da Amazônia, símbolo de força silenciosa, presença marcante e território.

A Mutum não é um produto único — é uma **empresa multi-produto**. O sistema visual aqui descrito serve **todos os produtos** que a Mutum construir, mantendo coerência de marca entre apps de consumo, ferramentas técnicas, plataformas B2B e materiais institucionais.

### Referências de marca
- **Nubank** — calor, acessibilidade, generosidade visual, sentence case, sem firula.
- **Airbnb** — humanidade, fotografia real, espaço pra respirar, foco em histórias.

### Produtos atuais (em desenvolvimento ou ideia)
- **Mutum Água** — app de verificação e monitoramento da qualidade da água. Pensado pra comunidades ribeirinhas, saúde pública e indústria.
- Demais produtos do portfólio serão desenhados em cima deste sistema.

O sistema visual mistura:
- **Tecnologia limpa** (tipografia geométrica, grid 4pt, dark mode forte)
- **Calor regional** (paleta vermelho-coral, base creme, sotaques de verde-floresta e azul-rio)
- **Postura local** (português brasileiro como idioma primário, sotaque amazonense moderado — dá pra sentir mas não caricato)

### Fontes recebidas
Os únicos materiais entregues foram:
- `uploads/Frame 7.svg` → wordmark + bird em fundo creme (`#F0EFEB`)
- `uploads/Frame 8.svg` → wordmark + bird em fundo escuro (`#191919`)

Não foram fornecidos: códigos, Figma, deck, screenshots de produto, manifesto verbal, guidelines anteriores. **Toda a expansão (UI kits, tom de voz, componentes, espaçamentos) é uma extrapolação coerente do lockup recebido** — abertas para serem refinadas pelo time conforme produtos reais forem entrando no sistema.

---

## 2. Índice do projeto

```
.
├── README.md                     ← você está aqui
├── SKILL.md                      ← prompt para usar este DS via Claude Skills
├── colors_and_type.css           ← tokens CSS (cores, tipografia, espaço, sombras)
├── assets/                       ← logos + bird mark em SVG
│   ├── logo-mutum-light.svg
│   ├── logo-mutum-dark.svg
│   └── mark-bird.svg
├── preview/                      ← cards do Design System tab
│   ├── colors-*.html
│   ├── type-*.html
│   ├── spacing-*.html
│   ├── components-*.html
│   └── brand-*.html
└── ui_kits/
    ├── web/                      ← landing + dashboard web
    │   ├── index.html
    │   └── *.jsx
    └── mobile/                   ← app mobile (iOS frame)
        ├── index.html
        └── *.jsx
```

---

## 3. Content Fundamentals

> Como a Mutum escreve.

### Idioma
- **Português brasileiro** é o idioma primário. Inglês entra apenas em termos técnicos consagrados (API, login, design system).
- **Sotaque amazonense** entra com moderação — sem caricatura. Palavras como *aqui*, *agora*, *com a gente* (em vez de "conosco"), *bora* (em CTAs casuais) são bem-vindas. Evitar gírias ultra-regionais sem contexto.

### Pessoa & voz
- **Falamos como "nós" e tratamos o usuário por "você"**. Nada de "o usuário" / "o cliente" no copy de produto.
- **Direto, sem floreio**. Frase curta. Verbo no início quando possível.
- **Confiante sem ser arrogante**. A Mutum sabe o que faz, mas não grita.

### Casing
- **Sentence case** em quase tudo: títulos, botões, menus, labels.
  - ✅ "Criar conta" / "Conectar com o time" / "Ver detalhes"
  - ❌ "Criar Conta" / "Ver Detalhes"
- **UPPERCASE apenas no wordmark MUTUM** e em eyebrows / labels muito curtas (≤ 16 chars), com letter-spacing aberto (`0.12em`).
- Acrônimos mantêm caixa (API, JSON, CNPJ).

### Tom por contexto

| Contexto              | Como soa                                        | Exemplo                                         |
|-----------------------|-------------------------------------------------|-------------------------------------------------|
| Marketing / hero      | Curto, com ritmo, um pouco regional             | "Tecnologia feita aqui. Pra rodar em qualquer lugar." |
| Botão primário        | 1–3 palavras, verbo no início                   | "Começar agora" / "Falar com a gente"           |
| Empty state           | Acolhedor, com saída clara                      | "Ainda nada por aqui. Que tal começar pelo primeiro projeto?" |
| Erro                  | Reconhece + propõe ação. Nunca culpa o usuário. | "Algo travou do nosso lado. Tenta de novo em alguns segundos." |
| Sucesso               | Direto, sem comemorar demais                    | "Pronto. Salvo."                                |
| Confirmação destrutiva| Honesto sobre consequências                     | "Apagar o projeto remove todos os arquivos. Sem volta." |
| Onboarding            | Conversacional, 1 passo por vez                 | "Primeiro, como a gente te chama?"              |

### Pontuação & detalhes
- **Sem ponto final** em botões, labels, títulos de card e tags.
- **Ponto final** em parágrafos, descrições, mensagens completas.
- Aspas curvas (`"…"`) em corpo de texto. Aspas retas (`"…"`) só em código.
- Travessão `—` (não hífen) para inserções.
- Números: pt-BR — separador de milhar com ponto (`12.450`), decimal com vírgula (`R$ 49,90`).

### Emoji
- **Não.** O sistema não usa emoji em copy de produto. A linguagem visual carrega a personalidade — emoji dilui.
- Exceção: comunicação informal interna (Slack, changelog interno) pode usar com parcimônia.

---

## 4. Visual Foundations

> Como a Mutum se parece.

### Paleta
Dois polos:
- **Creme `#F0EFEB`** — superfície primária, sensação de papel quente, "luz amazônica filtrada".
- **Ink `#191919`** — superfície escura, contraste forte, postura noturna.

O **vermelho-coral** (`#ED2C27` / `#EE736E`) é a única cor de marca real — usada com **moderação**: CTAs primários, marca, gráficos-chave. Nunca em grandes áreas chapadas. Quando usado em bloco grande, sempre com o pássaro ou wordmark.

Acentos terrosos (verde-floresta, azul-rio, argila) existem para data viz e categorização — não fazem parte da linguagem padrão da UI.

Modo escuro **inverte os papéis**: ink vira fundo, coral (versão clara `#EE736E`) vira primário pra manter contraste WCAG AA em texto branco.

### Tipografia (sistema oficial)
- **Display: Space Grotesk** (500/600/**700**) — wordmark, hero, títulos, números grandes. Geométrica, peso heavy disponível, casa com o lockup MUTUM.
- **Body: Manrope** (400/500/600/700) — leitura longa, formulários, densidade de UI.
- **Mono: JetBrains Mono** (400/500) — código, IDs, dados tabulares precisos.

> Confirmado pelo time como família oficial. Todas vêm via Google Fonts em `colors_and_type.css` — sem licenciamento extra.

### Logo
- **Mark principal**: o pássaro Mutum isolado em vermelho (`assets/mark-bird.svg`). Esse é o **símbolo oficial** — usa sozinho em favicons, app icon, badges, watermark, e em superfícies pequenas.
- **Lockup completo** (`assets/logo-mutum-light.svg` / `assets/logo-mutum-dark.svg`): mark + wordmark "MUTUM" — pra header de site, splash, materiais formais.

Escala em `colors_and_type.css` (12 → 104px). Letter-spacing **negativo** em displays (`-0.03em`), positivo só em UPPERCASE caps (`+0.12em`).

### Backgrounds & superfícies
- **Sem gradientes coloridos** como base de tela. A Mutum trabalha em superfícies sólidas.
- Gradientes existem apenas como **proteção** (sob texto sobre imagem) — sempre cream→transparente ou ink→transparente, nunca com cor de marca.
- **Texturas**: sutilíssima — um grão de papel a 3% de opacidade pode ser aplicado em hero sections cremes. Nunca em cards pequenos.
- **Imagens**: quando usadas, paleta **quente**, levemente granulada. Verdes amazônicos, terra, rio, luz natural. Nunca azuis frios saturados.

### Cantos & bordas
- **Cantos arredondados moderados**:
  - Inputs, botões pequenos → `10px`
  - Cards, modais → `16px`
  - Pills, badges → `999px`
- **Bordas finas** (`1px`) e quentes (`#D9D5CB`) — não cinza-azulado. Bordas escuras só em foco/seleção.

### Sombras
Sombra **quente e baixa** — escala em 4 níveis (`sm/md/lg/xl`). Nunca preto puro 50% — sempre `rgba(25,25,25, .06→.18)`. Há uma sombra especial **vermelho-Mutum** (`--shadow-red`) para destacar CTA primário quando ele precisa flutuar.

### Animação
- **Easing dominante**: `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out suave).
- **Spring** (`0.34, 1.56, 0.64, 1`) só em entrada de elementos celebratórios (toast de sucesso, conclusão de onboarding) — não em UI cotidiana.
- **Sem bounces exagerados**. Duração padrão `220ms`. Hover transitions `140ms`.
- **Fade + 4px de translate** é a entrada padrão de elementos.
- **Sem parallax**, sem scroll-jacking.

### Estados
- **Hover**: escurece a cor 8–12% (ou clareia, em dark mode). Sombra sobe um nível. Sem mudança de cor de fundo em links — só underline.
- **Press**: escurece mais 6–8% + reduz para `scale(0.98)` em botões/cards interativos. Duração `100ms`.
- **Focus**: anel `2px` na cor `color-mix(red, 50% transparent)`, offset `2px`.
- **Disabled**: opacidade `0.4`, cursor `not-allowed`. Não muda cor de fundo.

### Layout & ritmo
- **Grid 4pt** estrito. Toda dimensão é múltiplo de 4 (preferencialmente de 8).
- **Container web** máx `1280px`, padding lateral `48px` desktop / `24px` tablet / `16px` mobile.
- **Stack vertical**: ritmo de 24–48–80px entre seções.
- **Headers fixos** em web e mobile. Footer só no web.

### Transparência & blur
- Usado **somente** em chrome navegacional sobre conteúdo rolável (header backdrop, sheet overlay).
- `backdrop-filter: blur(20px)` + cor base com `0.7` de opacidade. Nunca em cards de conteúdo.

### Cards
- Fundo **sólido** (`--surface` em light, `--bg-2` em dark).
- Borda `1px solid var(--border)` **OU** sombra `--shadow-sm` — nunca os dois ao mesmo tempo.
- Radius `16px`. Padding interno `24px` (cards densos), `32px` (cards de destaque).
- **Sem barrinha colorida lateral**. Sem ícone gigante. A hierarquia vem do título + corpo.

---

## 5. Iconography

### Abordagem
A Mutum usa **iconografia line** (stroke 1.5–2px), cantos arredondados, geometria limpa. Sem ícones preenchidos como padrão — fill é reservado para estado ativo (item de menu selecionado, toggle ligado).

### Sistema usado
- **Lucide** (`https://unpkg.com/lucide-static/...`) como biblioteca padrão.
  - Stroke `1.75px`, corners `2px`.
  - Tamanhos: `16px` inline / `20px` UI padrão / `24px` ênfase / `32px+` hero.
- Cor padrão `currentColor` — herda do texto ao redor.

> **⚠️ Substituição:** não recebemos um icon set proprietário. Lucide foi escolhido por casar com o peso geométrico do wordmark. Se a Mutum tiver um set próprio, envie e a gente troca de uma vez.

### SVGs proprietários
- `assets/mark-bird.svg` — pássaro isolado, usado como mark sem wordmark (favicons, badges, app icon).
- `assets/logo-mutum-light.svg` / `assets/logo-mutum-dark.svg` — lockup completo.

### Emoji
- **Não usado em produto.**

### Unicode glyphs
- Setas (`→ ← ↗`) e travessões (`—`) são permitidos inline em copy. Não como ícones de UI.

---

## 6. UI Kits

O design system serve a **múltiplos produtos**. Os UI kits abaixo são exemplos de aplicação:

| Kit                 | Caso                                                                       |
|---------------------|----------------------------------------------------------------------------|
| `ui_kits/web/`      | Site institucional da empresa Mutum — quem somos, o que construímos, como falar com a gente. |
| `ui_kits/mobile/`   | **Mutum Água** — app iOS de monitoramento de qualidade da água. Caso real do portfólio. |

Abra o `index.html` de cada um para um clickthrough.

### Dois modos visuais
O sistema tem **dois modos** que convivem na mesma identidade:
- **Modo quente** (default) — fundo creme, espaço pra respirar, tipografia grande. Apps de consumo, sites institucionais, marketing. Vibe Nubank/Airbnb.
- **Modo denso** — dark mode, densidade alta, dados como protagonistas, terminais e gráficos. Ferramentas técnicas, dashboards, painel admin, produtos B2B.

Ambos compartilham as mesmas cores, fontes e radius — mudam densidade, contraste e proporção.

---

## 7. Próximos passos

Veja **caveats** no final da entrega do agente. Em resumo, precisamos:
1. Arquivo da fonte original do wordmark (ou confirmação que Space Grotesk serve).
2. Materiais reais: screenshots de produto, deck, Figma, codebase.
3. Confirmação dos verdes/azuis amazônicos (foram extrapolados).
4. Validação do tom de voz com exemplos reais de copy da Mutum.
