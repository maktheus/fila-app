window.FILA_API_BASE = window.FILA_API_BASE || '';
window.FILA_WS_BASE = window.FILA_WS_BASE || '';
window.FILA_ADMIN_TOKEN = window.FILA_ADMIN_TOKEN || '';
window.FILA_ADS_ENABLED = window.FILA_ADS_ENABLED ?? true;
window.FILA_PLATFORM = window.FILA_PLATFORM || 'web';

// Web: Google Ad Manager via Google Publisher Tag.
window.FILA_WEB_ADS_PROVIDER = window.FILA_WEB_ADS_PROVIDER || 'gam';
window.FILA_GAM_NETWORK_CODE = window.FILA_GAM_NETWORK_CODE || '';
window.FILA_GAM_AD_UNIT_PREFIX = window.FILA_GAM_AD_UNIT_PREFIX || 'fila_virtual';
window.FILA_GAM_SLOTS = window.FILA_GAM_SLOTS || {
  'landing-midpage': { sizes: [[320, 100], [300, 250], [728, 90]] },
  'queue-side': { sizes: [[300, 250], [320, 100]] },
  'queue-join-bottom': { sizes: [[320, 100], [300, 250]] },
  'queue-status-bottom': { sizes: [[320, 100], [300, 250]] },
};

// Mobile app: AdMob. Native Android wrapper must consume these ids.
window.FILA_MOBILE_ADS_PROVIDER = window.FILA_MOBILE_ADS_PROVIDER || 'admob';
window.FILA_ADMOB_ANDROID_APP_ID = window.FILA_ADMOB_ANDROID_APP_ID || '';
window.FILA_ADMOB_UNITS = window.FILA_ADMOB_UNITS || {
  banner: '',
  interstitial: '',
  appOpen: '',
};
