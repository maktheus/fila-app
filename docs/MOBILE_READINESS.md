# Prontidao do app mobile

## Implementado

- Cliente Android real com WebView da versao publicada e fallback local.
- Navegacao externa aberta fora do app e ponte JavaScript limitada ao conteudo confiavel.
- QR code nativo para entrar na unidade e confirmar a passagem de vez.
- Confirmacao de presenca persistida no backend.
- Linha do tempo montada com tickets reais da fila.
- AdMob nativo com banner adaptativo, intersticial e consentimento UMP.
- Plano premium do backend desativa anuncios web e nativos.

## Configuracao necessaria antes da Play Store

- Criar o app no AdMob e fornecer App ID, Banner ID e Interstitial ID reais.
- Publicar a mensagem de consentimento no AdMob/Privacy & messaging.
- Criar e proteger a chave de assinatura do Android.
- Preencher ficha da loja, politica de privacidade, classificacao e Data Safety.
- Configurar uma assinatura real para o premium. Hoje o entitlement premium vem do ambiente do backend; ainda nao existe compra pela Play Billing.

## Web

- Google Ad Manager ja possui os slots e o carregador GPT.
- O Network Code e os caminhos reais das unidades ainda precisam ser informados para os anuncios web gerarem receita.

Os elementos demonstrativos da landing page sao material de apresentacao e nao participam da fila do cliente.
