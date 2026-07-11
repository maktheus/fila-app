param(
    [ValidateSet('production', 'emulator')]
    [string]$Environment = 'production'
)

$ErrorActionPreference = 'Stop'

$androidRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$projectRoot = Resolve-Path (Join-Path $androidRoot '..\..')
$source = Join-Path $projectRoot 'frontend'
$target = Join-Path $androidRoot 'app\src\main\assets\public'

if (-not (Test-Path $source)) {
    throw "Frontend not found at $source"
}

New-Item -ItemType Directory -Force $target | Out-Null
Get-ChildItem -LiteralPath $target -Force | Remove-Item -Recurse -Force
Copy-Item -Path (Join-Path $source '*') -Destination $target -Recurse -Force

if ($Environment -eq 'emulator') {
    $apiBase = 'http://10.0.2.2:3000'
    $wsBase = 'ws://10.0.2.2:3000/ws'
} else {
    $apiBase = 'https://srv1178252.hstgr.cloud/fila-api'
    $wsBase = 'wss://srv1178252.hstgr.cloud/fila-ws'
}

@"
window.FILA_API_BASE = '$apiBase';
window.FILA_WS_BASE = '$wsBase';
window.FILA_ADMIN_TOKEN = '';
window.FILA_ADS_ENABLED = true;
window.FILA_PLATFORM = 'android';
window.FILA_WEB_ADS_PROVIDER = 'gam';
window.FILA_GAM_NETWORK_CODE = '';
window.FILA_GAM_AD_UNIT_PREFIX = 'fila_virtual';
window.FILA_GAM_SLOTS = {};
window.FILA_MOBILE_ADS_PROVIDER = 'admob';
window.FILA_ADMOB_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
window.FILA_ADMOB_UNITS = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  appOpen: '',
};
"@ | Set-Content -LiteralPath (Join-Path $target 'config.js') -Encoding UTF8

Write-Host "Synced web assets to $target"
