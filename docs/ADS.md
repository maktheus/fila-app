# Ads - Fila Virtual

## Decisao

- Web/PWA: Google Ad Manager via Google Publisher Tag (`frontend/ads.js`).
- App mobile nas lojas: AdMob via camada Android nativa.

## Web - Google Ad Manager

Configure no GitHub Actions/Pages ou no `frontend/config.js`:

- `FILA_ADS_ENABLED=true`
- `FILA_WEB_ADS_PROVIDER=gam`
- `FILA_GAM_NETWORK_CODE`
- `FILA_GAM_AD_UNIT_PREFIX`

Slots atuais:

- `landing-midpage`
- `queue-side`
- `queue-join-bottom`
- `queue-status-bottom`

Enquanto `FILA_GAM_NETWORK_CODE` estiver vazio, os slots aparecem como placeholders e nao fazem request real de anuncio.

## Mobile - AdMob

Configure no wrapper Android:

- `FILA_MOBILE_ADS_PROVIDER=admob`
- `FILA_ADMOB_ANDROID_APP_ID`
- `FILA_ADMOB_BANNER_UNIT_ID`
- `FILA_ADMOB_INTERSTITIAL_UNIT_ID`

O shell Android em `mobile/android` ja inclui Google Mobile Ads SDK, consentimento UMP e a ponte `window.FilaNativeAds`. Banner e intersticial usam IDs de teste por padrao; informe IDs reais por propriedades Gradle apenas no build de publicacao.

## Play Console

- Se ads reais estiverem ligados, declare que o app contem anuncios.
- Atualize Data Safety considerando Google Ad Manager/AdMob e qualquer SDK usado.
- Premium deve remover ads via entitlement do backend.
