# Play Store - Fila Virtual

Publicacao Android padrao Bateia: PWA publicada em HTTPS + Trusted Web Activity (TWA).

## Caminho

1. Publique o front no GitHub Pages.
2. Configure `frontend/.well-known/assetlinks.json` a partir de `assetlinks.template.json` com o package id e SHA-256 do certificado.
3. Gere o projeto Android com Bubblewrap/TWA usando `twa-manifest.template.json`.
4. Gere um Android App Bundle (`.aab`) assinado.
5. Suba para Internal testing no Play Console.
6. Para contas pessoais novas, rode Closed testing com pelo menos 12 testers por 14 dias antes de pedir producao.
7. Complete store listing, politica de privacidade, data safety e screenshots.
8. Para AdMob, inclua Google Mobile Ads SDK no wrapper Android ou evolua para shell Android customizado. A TWA pura nao injeta banners AdMob nativos por conta propria.

## Comandos esperados

```bash
npx @bubblewrap/cli init --manifest https://<usuario-ou-org>.github.io/<repo>/manifest.webmanifest
npx @bubblewrap/cli build
```

Nao commite keystore, senhas ou service account do Play Console.

## Ads

- Web/PWA publicada: Google Ad Manager.
- Android nativo/loja: AdMob.
- Se o build Android continuar como TWA pura, os anuncios exibidos dentro do conteudo continuam sendo os de web/Ad Manager.
- Declare "contains ads" no Play Console quando qualquer trilha usar anuncios reais.
