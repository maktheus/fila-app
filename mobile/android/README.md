# Fila Virtual Cliente Android

Aplicativo Android do cliente. O shell nativo abre a versao publicada de `cliente.html` em uma WebView segura e usa os arquivos empacotados como fallback offline.

## Recursos nativos

- WebView restrita ao host confiavel do Fila App.
- Leitura de QR code pela camera.
- Geolocalizacao para confirmar a passagem de vez.
- Banner adaptativo e intersticial AdMob.
- Consentimento de anuncios com Google UMP.
- Anuncios removidos quando o backend retorna plano premium.

## Compilar e testar

Sincronize o fallback com o backend de producao:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-web-assets.ps1
.\gradlew.bat :app:assembleDebug
```

Para usar um backend rodando no computador durante testes no emulador:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-web-assets.ps1 -Environment emulator
```

## AdMob

Por padrao, o projeto usa os IDs de teste oficiais do Google. Eles nao geram receita. Para gerar o AAB da Play Store, informe os tres IDs reais:

```powershell
.\gradlew.bat :app:bundleRelease `
  -PFILA_ADMOB_ANDROID_APP_ID=ca-app-pub-SEU_APP_ID `
  -PFILA_ADMOB_BANNER_UNIT_ID=ca-app-pub-SEU_BANNER `
  -PFILA_ADMOB_INTERSTITIAL_UNIT_ID=ca-app-pub-SEU_INTERSTICIAL
```

O release tambem precisa da chave de assinatura configurada fora do repositorio antes do envio para a Play Console.
