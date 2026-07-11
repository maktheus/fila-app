(function() {
  const enabled = window.FILA_ADS_ENABLED !== false && window.FILA_ADS_ENABLED !== 'false';
  const webProvider = window.FILA_WEB_ADS_PROVIDER || 'gam';
  const mobileProvider = window.FILA_MOBILE_ADS_PROVIDER || 'admob';
  const platform = window.FILA_PLATFORM || 'web';
  const gamNetwork = window.FILA_GAM_NETWORK_CODE || '';
  const gamPrefix = window.FILA_GAM_AD_UNIT_PREFIX || 'fila_virtual';
  const gamSlots = window.FILA_GAM_SLOTS || {};
  const admobUnits = window.FILA_ADMOB_UNITS || {};
  let counter = 0;
  let gptLoading = false;

  window.FilaAds = window.FilaAds || { refresh };

  function refresh() {
    document.querySelectorAll('[data-ad-slot]').forEach(renderSlot);
  }

  function renderSlot(el) {
    if (!enabled) return mark(el, 'disabled');
    if (!isVisible(el)) return;
    if (el.dataset.adRendered === 'true') return;

    const slotName = el.dataset.adSlot;
    if ((platform === 'android' || window.FilaNativeAds || window.FilaAdMob) && mobileProvider === 'admob') {
      return renderAdMobBridge(el, slotName);
    }
    if (webProvider === 'gam') return renderGam(el, slotName);
    mark(el, 'unsupported-provider');
  }

  function renderAdMobBridge(el, slotName) {
    const bridge = window.FilaAdMob || window.FilaNativeAds;
    if (bridge && typeof bridge.requestBanner === 'function') {
      bridge.requestBanner(slotName);
      el.dataset.adRendered = 'true';
      mark(el, 'admob-native');
      return;
    }
    mark(el, 'admob-native-required');
  }

  function renderGam(el, slotName) {
    const slot = gamSlots[slotName] || {};
    const path = slot.path || buildGamPath(slotName);
    const sizes = slot.sizes || [[320, 100]];
    if (!gamNetwork && !slot.path) return mark(el, 'configure-google-ad-manager');

    loadGpt();
    const id = el.id || 'fila-ad-' + slotName + '-' + (++counter);
    el.id = id;
    window.googletag.cmd.push(function() {
      const gptSlot = window.googletag.defineSlot(path, sizes, id);
      if (!gptSlot) return mark(el, 'gam-slot-error');
      gptSlot.addService(window.googletag.pubads());
      window.googletag.pubads().collapseEmptyDivs();
      window.googletag.enableServices();
      window.googletag.display(id);
      el.dataset.adRendered = 'true';
      mark(el, 'gam-requested');
    });
  }

  function buildGamPath(slotName) {
    return '/' + gamNetwork + '/' + gamPrefix + '/' + slotName.replace(/-/g, '_');
  }

  function loadGpt() {
    window.googletag = window.googletag || { cmd: [] };
    if (gptLoading || document.querySelector('script[data-fila-gpt]')) return;
    gptLoading = true;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
    script.crossOrigin = 'anonymous';
    script.dataset.filaGpt = 'true';
    document.head.appendChild(script);
  }

  function isVisible(el) {
    return el.classList.contains('show') || el.offsetParent !== null;
  }

  function mark(el, state) {
    el.dataset.adState = state;
    if (!el.textContent.trim()) el.textContent = state;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh);
  } else {
    refresh();
  }
})();
