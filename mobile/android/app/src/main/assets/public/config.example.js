// Copie para config.js no deploy manual, ou configure vars no GitHub Actions.
window.FILA_API_BASE = 'https://api.seu-dominio.com';
window.FILA_WS_BASE = 'wss://api.seu-dominio.com/ws';
window.FILA_ADMIN_TOKEN = '';
window.FILA_ADS_ENABLED = true;
window.FILA_PLATFORM = 'web';

// Web: Google Ad Manager.
window.FILA_WEB_ADS_PROVIDER = 'gam';
window.FILA_GAM_NETWORK_CODE = '1234567';
window.FILA_GAM_AD_UNIT_PREFIX = 'fila_virtual';
window.FILA_GAM_SLOTS = {
  'landing-midpage': { path: '/1234567/fila_virtual/landing_midpage', sizes: [[320, 100], [300, 250], [728, 90]] },
  'queue-side': { path: '/1234567/fila_virtual/queue_side', sizes: [[300, 250], [320, 100]] },
  'queue-join-bottom': { path: '/1234567/fila_virtual/queue_join_bottom', sizes: [[320, 100], [300, 250]] },
  'queue-status-bottom': { path: '/1234567/fila_virtual/queue_status_bottom', sizes: [[320, 100], [300, 250]] },
};

// Mobile app: AdMob. These ids are consumed by the Android native shell.
window.FILA_MOBILE_ADS_PROVIDER = 'admob';
window.FILA_ADMOB_ANDROID_APP_ID = 'ca-app-pub-0000000000000000~0000000000';
window.FILA_ADMOB_UNITS = {
  banner: 'ca-app-pub-0000000000000000/0000000000',
  interstitial: 'ca-app-pub-0000000000000000/1111111111',
  appOpen: 'ca-app-pub-0000000000000000/2222222222',
};
