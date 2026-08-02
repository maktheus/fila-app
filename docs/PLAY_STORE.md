# Play Store — ficha, declarações e checklist

Tudo que o Play Console vai pedir, já escrito. Copie e cole.

- **Pacote**: `br.com.filaapp.cliente`
- **Categoria**: Negócios (secundária: Produtividade)
- **Classificação etária**: Livre
- **Público-alvo**: 18+ (o app é operado por estabelecimentos)
- **Contém anúncios**: sim, no plano gratuito
- **Compras no app**: não (a assinatura é cobrada fora da loja, do estabelecimento)

## Nome e descrições

**Nome do app** (30 caracteres)

```
Fila Virtual — QR na recepção
```

**Descrição curta** (80 caracteres)

```
Fila por QR code: o cliente espera onde quiser e acompanha a vez pelo celular.
```

**Descrição longa** (até 4000 caracteres)

```
Acabe com a sala de espera lotada.

Com o Fila Virtual, o cliente escaneia um QR code no balcão, digita o primeiro
nome e entra na fila pelo próprio navegador — sem instalar nada, sem cadastro e
sem senha de papel. Ele acompanha a posição em tempo real e pode esperar no
carro, na padaria da esquina ou sentado onde preferir.

COMO FUNCIONA

1. Você imprime o QR code da sua unidade e deixa no balcão.
2. O cliente aponta a câmera e entra na fila em segundos.
3. Você chama pelo painel; o celular dele avisa na hora.
4. Um telão opcional mostra as senhas na sala de espera.

PARA QUEM É

Clínicas, laboratórios, consultórios, cartórios, barbearias, oficinas,
despachantes — qualquer lugar que atenda por ordem de chegada.

O QUE VOCÊ GANHA

• Recepção mais vazia e menos aglomeração
• Menos "quanto falta?" na mesa da recepção
• Registro de quem foi atendido e de quem não compareceu
• Instalação em minutos: sem totem, sem impressora térmica, sem obra
• Funciona em qualquer celular, porque roda no navegador

PASSAR A VEZ

Precisou se ausentar? O cliente toca em "passar a vez" e cede o lugar para as
próximas pessoas, sem perder o atendimento. Para evitar abuso, o app confere se
ele continua perto do estabelecimento — por GPS ou relendo o QR do balcão.

PLANOS

Todo estabelecimento começa com 14 dias de teste, com tudo liberado. Depois:

• Gratuito: fila funcionando, com limite diário de entradas, um balcão e anúncios.
• Premium: entradas ilimitadas, todos os balcões e sem anúncios. Assinatura
  mensal por unidade, via Pix, sem fidelidade.

PRIVACIDADE

Pedimos só o primeiro nome de quem entra na fila e apagamos esse dado
automaticamente poucas horas depois do atendimento. O telão nunca mostra nomes.
Não pedimos CPF, telefone nem qualquer informação de saúde.
```

## Palavras-chave (ASO)

Trabalhe estes termos no título, na descrição curta e nos primeiros parágrafos:

`fila virtual` · `senha eletrônica` · `gerenciador de filas` · `fila por QR code` ·
`painel de senhas` · `fila clínica` · `fila laboratório` · `sala de espera` ·
`chamada de senha` · `totem de senha`

## Declaração de segurança de dados (Data safety)

O formulário do Play Console pergunta item a item. Respostas corretas para este app:

| Pergunta | Resposta |
|---|---|
| Coleta dados? | Sim |
| Nome | Coletado · não compartilhado · **opcional**? Não, obrigatório · finalidade: funcionalidade do app |
| Localização aproximada | Coletada · **não armazenada** · opcional · finalidade: funcionalidade do app (checagem de proximidade) |
| Localização precisa | Não |
| E-mail | Coletado apenas do dono do estabelecimento · finalidade: comunicação sobre a conta |
| Dados financeiros | Não (o pagamento acontece no provedor, fora do app) |
| Dados de saúde | **Não** |
| ID do dispositivo | Sim, pela rede de anúncios no plano gratuito · finalidade: publicidade |
| Dados são criptografados em trânsito? | Sim (HTTPS/WSS) |
| Usuário pode pedir exclusão? | Sim — sair da fila apaga na hora; o resto é apagado automaticamente |

**URL da política de privacidade**: `https://SEU-DOMINIO/privacidade.html`

## Recursos gráficos exigidos

| Item | Especificação | Status |
|---|---|---|
| Ícone | 512×512 PNG, 32 bits | ✅ `docs/store-assets/icone-512.png` |
| Gráfico de destaque | 1024×500 PNG | ✅ `docs/store-assets/destaque-1024x500.png` |
| Screenshots de celular | 2 a 8, mínimo 320px no lado menor | ✅ 4 em 1000×1800: entrar, posição, é a sua vez, painel |
| Screenshots de tablet | opcional | — |

Para capturar as telas com dados realistas, suba a stack (`docker compose up -d`),
crie uma unidade em `/cadastro.html` e use as URLs do resultado.

## Checklist antes de enviar

- [ ] Domínio próprio com HTTPS no ar
- [ ] `assetlinks.json` publicado em `https://SEU-DOMINIO/.well-known/assetlinks.json`
      (gere com `mobile/android/scripts/gerar-assetlinks.ps1 -PlayFingerprint <SHA-256 do Play Console>`)
- [ ] `privacidade.html` e `termos.html` públicos e linkados
- [ ] `FILA_CLIENT_ENTRY_URL` e `FILA_TRUSTED_HOST` apontando para o domínio final
- [ ] `.aab` assinado gerado pelo workflow de release
- [ ] Declaração de segurança de dados preenchida conforme a tabela acima
- [ ] Declaração de anúncios marcada (AdMob/Ad Manager ativos)
- [ ] Teste fechado com 12+ testadores por 14 dias consecutivos —
      exigência do Google para contas pessoais criadas depois de nov/2023
- [ ] Backend em produção com `NODE_ENV=production`, `CORS_ORIGIN` restrito e
      `PAYMENT_WEBHOOK_SECRET` definido

## Depois da publicação

Suba a `versionCode` a cada envio (`mobile/android/app/build.gradle`). O
workflow de release faz isso a partir da tag, então basta criar a tag:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

## Como as peças foram geradas

`docs/store-assets/`. Tudo capturado do app rodando de verdade, não de mockup —
screenshot que não corresponde ao produto é motivo de recusa na revisão.

Renderizado com Chrome headless, porque o `convert` do PATH no Windows é a
ferramenta de sistema de arquivos, não o ImageMagick:

```bash
chrome.exe --headless=new --disable-gpu --hide-scrollbars \
  --force-prefers-reduced-motion --force-device-scale-factor=2 \
  --window-size=500,900 --virtual-time-budget=9000 \
  --screenshot=saida.png "http://localhost/?venue=centro"
```

Três coisas que custaram tempo e vale registrar:

- **`--headless` (antigo) não escreve o arquivo** neste Chrome. Só
  `--headless=new` funciona.
- **`--force-prefers-reduced-motion` é obrigatório.** Sem ele a captura pega o
  meio da animação de entrada e sai translúcida.
- **Chrome headless tem largura mínima de janela de 500px.** Pedir
  `--window-size=412` entrega uma viewport de 500 CSS px e recorta a imagem em
  412 — o que parece exatamente com um bug de responsividade que não existe.
  Confirme a viewport real antes de acusar o layout.

O telão foi capturado em 1280×720 por ser tela de TV, não de celular.

## Splash do app

`res/drawable/splash_icone.xml` e `splash.xml`, com o tema `AppTheme.Splash`.

**Fundo creme (#F0EFEB), não o preto do ícone.** A splash existe para o app
*chegar*, não para piscar: se ela fosse escura como o lançador, a pessoa veria
um flash preto virando creme toda vez que abrisse. Continuidade com a primeira
tela vale mais que continuidade com o ícone, porque a primeira tela é onde ela
fica.

**Dois caminhos, um resultado.** No Android 12+ o sistema desenha a splash
sozinho a partir de `values-v31/styles.xml`. Em versões anteriores é o
`windowBackground` do tema. A activity chama `setTheme(R.style.AppTheme)` antes
de `super.onCreate` — sem isso, o fundo da splash ficaria atrás do WebView
durante todo o uso do app.

**Sem `windowSplashScreenAnimationDuration`.** A splash sai de cena assim que o
app carrega. Prender a pessoa por tempo fixo para exibir a marca é roubar
segundos dela.

O vetor tem viewport 768 com a arte deslocada 128 em cada eixo: o Android 12+
mascara o ícone num círculo e mostra só o terço central, então usar o
`ic_launcher_foreground` direto cortaria as barras laterais da marca.

**Não foi vista rodando.** Não há SDK do Android nesta máquina, então a splash
real só aparece no primeiro build. `docs/store-assets/06-splash.png` é uma
renderização dos mesmos caminhos do vetor, não uma captura do app.
