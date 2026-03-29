param(
  [string]$AppId = "org.capacitor.bandstr",
  [string]$AppName = "bandstr",
  [switch]$SkipAndroid,
  [switch]$SkipIos
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $repoRoot

function Fail {
  param([string]$Message)
  Write-Host "ERROR: $Message"
  exit 1
}

function Invoke-Step {
  param(
    [string]$Title,
    [scriptblock]$Action
  )

  Write-Host $Title
  & $Action
  if ($LASTEXITCODE -ne 0) {
    Fail "Step failed: $Title"
  }
}

function Get-JavaMajorVersion {
  $javaVersionOutput = (cmd /c "java -version 2>&1")
  if ($LASTEXITCODE -ne 0) {
    return $null
  }

  $joined = $javaVersionOutput -join "`n"
  if ($joined -match 'version "(\d+)\.') {
    return [int]$matches[1]
  }

  return $null
}

$capacitorConfig = Join-Path $repoRoot "packages\web\src-capacitor\capacitor.config.json"
if (Test-Path $capacitorConfig) {
  Write-Host "Capacitor mode already initialized. Skipping 'quasar mode add capacitor'."
}
else {
  Invoke-Step "Initializing Quasar Capacitor mode..." {
    "$AppId`n$AppName`n" | pnpm --filter @bandstr/web exec quasar mode add capacitor
  }
}

if (-not $SkipAndroid) {
  $javaMajor = Get-JavaMajorVersion
  if ($null -eq $javaMajor) {
    Fail "Java not found. Install JDK 21 and ensure 'java' is on PATH."
  }
  if ($javaMajor -lt 21) {
    Fail "JDK $javaMajor detected. Capacitor Android build requires JDK 21+. Install JDK 21 and retry."
  }

  Invoke-Step "Building Capacitor Android project (creates android platform on demand)..." {
    pnpm --filter @bandstr/web run build:android
  }
}
else {
  Write-Host "Skipping Android build."
}

if ($IsMacOS -and -not $SkipIos) {
  Invoke-Step "Building Capacitor iOS project (creates ios platform on demand)..." {
    pnpm --filter @bandstr/web run build:ios
  }
}
else {
  Write-Host "Skipping iOS build (requires macOS)."
}

Write-Host "Capacitor setup done."
Write-Host "Next: open native projects from packages/web/src-capacitor/android or packages/web/src-capacitor/ios."
