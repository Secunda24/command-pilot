$ErrorActionPreference = "SilentlyContinue"

$commandPilotRoot = "C:\Users\angel\OneDrive\Documentos\Playground\commandpilot"
$nodeToolRoot = "C:\Users\angel\OneDrive\Documentos\Playground\clientflow-portal\.tools\node"
$npmCmd = Join-Path $nodeToolRoot "npm.cmd"
$desktopCandidates = @(
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174"
)
$bridgeUrl = "http://127.0.0.1:8787/health"
$preferredBrowsers = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
  "C:\Users\angel\AppData\Local\Google\Chrome\Application\chrome.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
)

function Test-Endpoint {
  param([string]$Url)

  try {
    Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Start-DetachedPowerShell {
  param([string]$Command)

  Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile", "-Command", $Command `
    -WorkingDirectory $commandPilotRoot `
    -WindowStyle Hidden | Out-Null
}

function Get-DesktopUrl {
  foreach ($candidate in $desktopCandidates) {
    if (Test-Endpoint $candidate) {
      return $candidate
    }
  }

  return $desktopCandidates[0]
}

function Start-EchoServices {
  $baseCommand = "`$env:Path='$nodeToolRoot;' + `$env:Path; & '$npmCmd'"
  $desktopUrl = Get-DesktopUrl

  if (-not (Test-Endpoint $bridgeUrl)) {
    Start-DetachedPowerShell "$baseCommand run dev:bridge"
    Start-Sleep -Seconds 2
  }

  if (-not (Test-Endpoint $desktopUrl)) {
    Start-DetachedPowerShell "$baseCommand run dev:desktop"
  }

  for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
    $desktopUrl = Get-DesktopUrl
    if (Test-Endpoint $desktopUrl) {
      return $desktopUrl
    }

    Start-Sleep -Seconds 1
  }

  return Get-DesktopUrl
}

function Open-EchoWindow {
  param([string]$Url)

  $browser = $preferredBrowsers | Where-Object { Test-Path $_ } | Select-Object -First 1

  if ($browser) {
    Start-Process -FilePath $browser -ArgumentList "--new-window", $Url | Out-Null
    return
  }

  Start-Process $Url | Out-Null
}

$resolvedDesktopUrl = Start-EchoServices
Open-EchoWindow -Url $resolvedDesktopUrl
