package br.com.filaapp.cliente;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.Toast;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;

import org.json.JSONObject;

import java.util.concurrent.atomic.AtomicBoolean;

public class MainActivity extends Activity {
    private static final int LOCATION_REQUEST_CODE = 10;
    private static final long INTERSTITIAL_COOLDOWN_MS = 180_000L;

    private final AtomicBoolean adsInitializationStarted = new AtomicBoolean(false);
    private WebView webView;
    private FrameLayout adContainer;
    private AdView adView;
    private InterstitialAd interstitialAd;
    private ConsentInformation consentInformation;
    private boolean adsEnabled;
    private boolean adsInitialized;
    private boolean usingOfflineFallback;
    private String qrScanPurpose = "entry";
    private String pendingQrToken;
    private long lastInterstitialAt;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWindow();
        createLayout();
        configureWebView();
        configureConsent();
        requestLocationPermissionIfNeeded();

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(BuildConfig.CLIENT_ENTRY_URL);
        }
    }

    private void configureWindow() {
        Window window = getWindow();
        window.setStatusBarColor(Color.parseColor("#F0EFEB"));
        window.setNavigationBarColor(Color.parseColor("#F0EFEB"));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }
    }

    private void createLayout() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#F0EFEB"));

        webView = new WebView(this);
        root.addView(webView, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
        ));

        adContainer = new FrameLayout(this);
        adContainer.setBackgroundColor(Color.WHITE);
        adContainer.setVisibility(View.GONE);
        root.addView(adContainer, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        setContentView(root);
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void configureWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString()
                + " FilaAppAndroid/" + BuildConfig.VERSION_NAME);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            settings.setAllowUniversalAccessFromFileURLs(true);
            settings.setAllowFileAccessFromFileURLs(true);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        NativeBridge bridge = new NativeBridge();
        webView.addJavascriptInterface(bridge, "FilaNativeApp");
        webView.addJavascriptInterface(bridge, "FilaNativeAds");
        webView.setWebViewClient(new FilaWebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(
                    String origin,
                    GeolocationPermissions.Callback callback
            ) {
                callback.invoke(origin, hasLocationPermission(), false);
            }
        });
    }

    private void configureConsent() {
        consentInformation = UserMessagingPlatform.getConsentInformation(this);
        ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
        consentInformation.requestConsentInfoUpdate(
                this,
                params,
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(
                        this,
                        formError -> {
                            if (consentInformation.canRequestAds()) initializeAds();
                        }
                ),
                requestError -> {
                    if (consentInformation.canRequestAds()) initializeAds();
                }
        );
        if (consentInformation.canRequestAds()) initializeAds();
    }

    private void initializeAds() {
        if (!adsInitializationStarted.compareAndSet(false, true)) return;
        new Thread(() -> MobileAds.initialize(this, initializationStatus ->
                runOnUiThread(() -> {
                    adsInitialized = true;
                    loadAdsIfNeeded();
                })
        )).start();
    }

    private void setAdsEnabled(boolean enabled) {
        adsEnabled = enabled;
        if (!enabled) {
            interstitialAd = null;
            if (adView != null) {
                adView.destroy();
                adView = null;
            }
            adContainer.removeAllViews();
            adContainer.setVisibility(View.GONE);
            return;
        }
        loadAdsIfNeeded();
    }

    private void loadAdsIfNeeded() {
        if (!adsEnabled || !adsInitialized) return;
        loadBanner();
        loadInterstitial();
    }

    private void loadBanner() {
        if (adView != null) return;
        adContainer.post(() -> {
            if (!adsEnabled || adView != null) return;
            int widthPixels = adContainer.getWidth();
            if (widthPixels <= 0) widthPixels = getResources().getDisplayMetrics().widthPixels;
            int adWidth = Math.max(320, Math.round(
                    widthPixels / getResources().getDisplayMetrics().density
            ));

            AdView nextAdView = new AdView(this);
            nextAdView.setAdUnitId(BuildConfig.ADMOB_BANNER_UNIT_ID);
            nextAdView.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(
                    this,
                    adWidth
            ));
            nextAdView.setAdListener(new AdListener() {
                @Override
                public void onAdLoaded() {
                    adContainer.setVisibility(View.VISIBLE);
                }

                @Override
                public void onAdFailedToLoad(LoadAdError error) {
                    adContainer.setVisibility(View.GONE);
                }
            });
            adView = nextAdView;
            adContainer.removeAllViews();
            adContainer.addView(nextAdView, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
            ));
            nextAdView.loadAd(new AdRequest.Builder().build());
        });
    }

    private void loadInterstitial() {
        if (!adsEnabled || !adsInitialized || interstitialAd != null) return;
        InterstitialAd.load(
                this,
                BuildConfig.ADMOB_INTERSTITIAL_UNIT_ID,
                new AdRequest.Builder().build(),
                new InterstitialAdLoadCallback() {
                    @Override
                    public void onAdLoaded(InterstitialAd ad) {
                        interstitialAd = ad;
                    }

                    @Override
                    public void onAdFailedToLoad(LoadAdError error) {
                        interstitialAd = null;
                    }
                }
        );
    }

    private void showInterstitial() {
        long now = SystemClock.elapsedRealtime();
        if (!adsEnabled || interstitialAd == null
                || now - lastInterstitialAt < INTERSTITIAL_COOLDOWN_MS) {
            loadInterstitial();
            return;
        }

        InterstitialAd ad = interstitialAd;
        interstitialAd = null;
        lastInterstitialAt = now;
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                loadInterstitial();
            }

            @Override
            public void onAdFailedToShowFullScreenContent(AdError adError) {
                loadInterstitial();
            }
        });
        ad.show(this);
    }

    private void launchQrScanner() {
        IntentIntegrator integrator = new IntentIntegrator(this);
        integrator.setDesiredBarcodeFormats(IntentIntegrator.QR_CODE);
        integrator.setPrompt(getString(R.string.qr_scan_prompt));
        integrator.setBeepEnabled(false);
        integrator.setBarcodeImageEnabled(false);
        integrator.setOrientationLocked(false);
        integrator.initiateScan();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (result != null) {
            if (result.getContents() == null) {
                qrScanPurpose = "entry";
                Toast.makeText(this, R.string.qr_scan_cancelled, Toast.LENGTH_SHORT).show();
                return;
            }
            String token = extractQrToken(result.getContents());
            if (token == null) {
                qrScanPurpose = "entry";
                Toast.makeText(this, R.string.qr_scan_invalid, Toast.LENGTH_LONG).show();
                return;
            }
            if ("pass".equals(qrScanPurpose)) {
                String script = "window.FilaNativeQrResult && window.FilaNativeQrResult("
                        + JSONObject.quote(token) + ",\"pass\");";
                webView.evaluateJavascript(script, null);
                qrScanPurpose = "entry";
                return;
            }
            usingOfflineFallback = false;
            pendingQrToken = token;
            String separator = BuildConfig.CLIENT_ENTRY_URL.contains("?") ? "&" : "?";
            webView.loadUrl(BuildConfig.CLIENT_ENTRY_URL + separator + "token=" + Uri.encode(token));
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    private String extractQrToken(String rawValue) {
        String value = rawValue == null ? "" : rawValue.trim();
        if (value.matches("[A-Za-z0-9_-]{3,64}")) return value;

        Uri uri = Uri.parse(value);
        if (!"https".equalsIgnoreCase(uri.getScheme())
                || !BuildConfig.TRUSTED_HOST.equalsIgnoreCase(uri.getHost())) {
            return null;
        }
        String path = uri.getPath();
        if (path == null || !path.endsWith("/fila-app/cliente.html")) return null;
        String token = uri.getQueryParameter("token");
        if (token == null) token = uri.getQueryParameter("qr");
        return token != null && token.matches("[A-Za-z0-9_-]{3,64}") ? token : null;
    }

    private boolean isTrustedUrl(Uri uri) {
        if (uri == null) return false;
        if ("file".equalsIgnoreCase(uri.getScheme())) {
            return uri.toString().startsWith("file:///android_asset/public/");
        }
        return "https".equalsIgnoreCase(uri.getScheme())
                && BuildConfig.TRUSTED_HOST.equalsIgnoreCase(uri.getHost())
                && uri.getPath() != null
                && uri.getPath().startsWith("/fila-app/");
    }

    private void openExternal(Uri uri) {
        if (uri == null || !("https".equalsIgnoreCase(uri.getScheme())
                || "http".equalsIgnoreCase(uri.getScheme()))) {
            return;
        }
        startActivity(new Intent(Intent.ACTION_VIEW, uri));
    }

    private void loadOfflineFallback() {
        if (usingOfflineFallback) return;
        usingOfflineFallback = true;
        String fallbackUrl = BuildConfig.OFFLINE_ENTRY_URL;
        if (pendingQrToken != null) {
            fallbackUrl += "&token=" + Uri.encode(pendingQrToken);
        }
        webView.loadUrl(fallbackUrl);
    }

    private void requestLocationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || hasLocationPermission()) return;
        requestPermissions(new String[]{
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION
        }, LOCATION_REQUEST_CODE);
    }

    private boolean hasLocationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        return checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    private final class FilaWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (isTrustedUrl(uri)) return false;
            openExternal(uri);
            return true;
        }

        @Override
        @SuppressWarnings("deprecation")
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            Uri uri = Uri.parse(url);
            if (isTrustedUrl(uri)) return false;
            openExternal(uri);
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            usingOfflineFallback = url != null && url.startsWith("file:///android_asset/");
            view.evaluateJavascript(
                    "window.dispatchEvent(new Event('fila-native-ready'));",
                    null
            );
        }

        @Override
        public void onReceivedError(
                WebView view,
                WebResourceRequest request,
                WebResourceError error
        ) {
            if (request.isForMainFrame()) loadOfflineFallback();
        }

        @Override
        public void onReceivedHttpError(
                WebView view,
                WebResourceRequest request,
                WebResourceResponse errorResponse
        ) {
            if (request.isForMainFrame() && errorResponse.getStatusCode() >= 500) {
                loadOfflineFallback();
            }
        }

    }

    public final class NativeBridge {
        @JavascriptInterface
        public void setAdsEnabled(boolean enabled) {
            runOnUiThread(() -> MainActivity.this.setAdsEnabled(enabled));
        }

        @JavascriptInterface
        public void requestBanner(String slot) {
            runOnUiThread(() -> {
                adsEnabled = true;
                loadAdsIfNeeded();
            });
        }

        @JavascriptInterface
        public void showInterstitial(String placement) {
            runOnUiThread(MainActivity.this::showInterstitial);
        }

        @JavascriptInterface
        public void scanQrCode(String purpose) {
            runOnUiThread(() -> {
                qrScanPurpose = "pass".equals(purpose) ? "pass" : "entry";
                launchQrScanner();
            });
        }

        @JavascriptInterface
        public void showPrivacyOptions() {
            runOnUiThread(() -> UserMessagingPlatform.showPrivacyOptionsForm(
                    MainActivity.this,
                    formError -> {
                        if (consentInformation.canRequestAds()) initializeAds();
                    }
            ));
        }

        @JavascriptInterface
        public String getVersion() {
            return BuildConfig.VERSION_NAME;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onPause() {
        if (adView != null) adView.pause();
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
        if (adView != null) adView.resume();
    }

    @Override
    protected void onDestroy() {
        if (adView != null) adView.destroy();
        if (webView != null) {
            webView.removeJavascriptInterface("FilaNativeApp");
            webView.removeJavascriptInterface("FilaNativeAds");
            webView.destroy();
        }
        super.onDestroy();
    }
}
