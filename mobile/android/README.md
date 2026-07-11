# Fila App Cliente Android

Primeira versao Android do app cliente usando WebView.

## Rodar localmente

1. Suba o backend:

   ```powershell
   cd E:\UFAM\tcc\fila-app\backend
   npm install
   npm start
   ```

2. Sincronize os arquivos web no Android:

   ```powershell
   cd E:\UFAM\tcc\fila-app\mobile\android
   powershell -ExecutionPolicy Bypass -File .\scripts\sync-web-assets.ps1
   ```

3. Compile e instale no emulador:

   ```powershell
   .\gradlew.bat installDebug
   ```

O WebView abre `cliente.html` localmente e chama a API do computador pelo endereco especial do emulador: `http://10.0.2.2:3000`.

## Ads

A versao Android usa AdMob nativo com IDs de teste:

- App ID: `ca-app-pub-3940256099942544~3347511713`
- Banner: `ca-app-pub-3940256099942544/6300978111`

Para publicar, troque pelos IDs reais:

```powershell
.\gradlew.bat bundleRelease -PFILA_ADMOB_ANDROID_APP_ID=ca-app-pub-SEU_APP_ID -PFILA_ADMOB_BANNER_UNIT_ID=ca-app-pub-SEU_BANNER
```
