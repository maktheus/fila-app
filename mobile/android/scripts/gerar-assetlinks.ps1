# Gera frontend/.well-known/assetlinks.json com o fingerprint real da chave.
#
# Use -PlayFingerprint com o SHA-256 que o Play Console mostra em
# "Configuração > Integridade do app > Assinatura de apps" — é ele que vale
# quando o Google reassina o app, e não o da sua keystore local.
param(
    [string]$KeystorePath,
    [string]$KeystorePassword,
    [string]$KeyAlias = 'fila-release',
    [string]$PlayFingerprint,
    [string]$PackageName = 'br.com.filaapp.cliente'
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$outputDir = Join-Path $projectRoot 'frontend\.well-known'
$outputFile = Join-Path $outputDir 'assetlinks.json'

function Get-FingerprintFromKeystore {
    if (-not (Test-Path $KeystorePath)) { throw "Keystore nao encontrada em $KeystorePath" }
    $keytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe'
    if (-not (Test-Path $keytool)) { $keytool = 'keytool' }

    $output = & $keytool -list -v -keystore $KeystorePath -alias $KeyAlias -storepass $KeystorePassword
    $line = $output | Select-String -Pattern 'SHA256:' | Select-Object -First 1
    if (-not $line) { throw 'Nao foi possivel ler o SHA-256 da keystore.' }
    return ($line -split 'SHA256:')[1].Trim()
}

if ($PlayFingerprint) {
    $fingerprint = $PlayFingerprint.Trim()
} elseif ($KeystorePath) {
    $fingerprint = Get-FingerprintFromKeystore
    Write-Warning 'Usando o fingerprint da keystore local. Se o app usa a assinatura gerenciada pelo Play, use -PlayFingerprint com o valor do Play Console.'
} else {
    throw 'Informe -PlayFingerprint (recomendado) ou -KeystorePath.'
}

if ($fingerprint -notmatch '^([0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$') {
    throw "Fingerprint em formato inesperado: $fingerprint"
}

$payload = @(
    @{
        relation = @('delegate_permission/common.handle_all_urls')
        target   = @{
            namespace                = 'android_app'
            package_name             = $PackageName
            sha256_cert_fingerprints = @($fingerprint.ToUpper())
        }
    }
)

New-Item -ItemType Directory -Force $outputDir | Out-Null
$payload | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $outputFile -Encoding utf8

Write-Host "assetlinks.json gerado em $outputFile"
Write-Host "Publique e confira em: https://SEU-DOMINIO/.well-known/assetlinks.json"
