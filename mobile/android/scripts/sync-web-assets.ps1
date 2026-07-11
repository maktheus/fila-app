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

@"
window.FILA_API_BASE = 'http://10.0.2.2:3000';
window.FILA_WS_BASE = 'ws://10.0.2.2:3000/ws';
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
  interstitial: '',
  appOpen: '',
};
"@ | Set-Content -LiteralPath (Join-Path $target 'config.js') -Encoding UTF8

Write-Host "Synced web assets to $target"
