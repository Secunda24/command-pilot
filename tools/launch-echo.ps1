param(
  [switch]$Rebuild
)

$ErrorActionPreference = "Stop"

$commandPilotRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$npmCmd = (Get-Command "npm.cmd" -ErrorAction SilentlyContinue).Source
$ollamaCmd = (Get-Command "ollama.exe" -ErrorAction SilentlyContinue).Source
if (-not $ollamaCmd) {
  $ollamaCmd = (Get-Command "ollama" -ErrorAction SilentlyContinue).Source
}
$pythonCmd = (Get-Command "python.exe" -ErrorAction SilentlyContinue).Source
if (-not $pythonCmd) {
  $pythonCmd = (Get-Command "python" -ErrorAction SilentlyContinue).Source
}
$desktopDistPath = Join-Path $commandPilotRoot "apps\desktop\dist\index.html"
$bridgeUrl = "http://127.0.0.1:8787/health"
$ollamaUrl = "http://127.0.0.1:11434/api/tags"
$bridgeOutLog = Join-Path $commandPilotRoot ".commandpilot-bridge.out.log"
$bridgeErrLog = Join-Path $commandPilotRoot ".commandpilot-bridge.err.log"
$ollamaOutLog = Join-Path $commandPilotRoot ".commandpilot-ollama.out.log"
$ollamaErrLog = Join-Path $commandPilotRoot ".commandpilot-ollama.err.log"
$pcAgentScript = Join-Path $commandPilotRoot "services\remote-agent\pc_agent.py"
$pcAgentOutLog = Join-Path $commandPilotRoot ".commandpilot-pc-agent.out.log"
$pcAgentErrLog = Join-Path $commandPilotRoot ".commandpilot-pc-agent.err.log"
$envFilePath = Join-Path $commandPilotRoot ".env"
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

function Get-EnvFileEntries {
  $entries = @{}

  if (-not (Test-Path $envFilePath)) {
    return $entries
  }

  foreach ($line in Get-Content -Path $envFilePath) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $separatorIndex = $trimmed.IndexOf("=")
    if ($separatorIndex -lt 1) {
      continue
    }

    $key = $trimmed.Substring(0, $separatorIndex).Trim()
    $value = $trimmed.Substring($separatorIndex + 1).Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    if ($key) {
      $entries[$key] = $value
    }
  }

  return $entries
}

function Wait-ForEndpoint {
  param(
    [string]$Url,
    [int]$Attempts = 20,
    [int]$DelaySeconds = 1
  )

  for ($attempt = 0; $attempt -lt $Attempts; $attempt += 1) {
    if (Test-Endpoint $Url) {
      return $true
    }

    Start-Sleep -Seconds $DelaySeconds
  }

  return $false
}

function Start-DetachedProcess {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$StdOutPath,
    [string]$StdErrPath
  )

  Start-Process `
    -FilePath $FilePath `
    -ArgumentList $ArgumentList `
    -WorkingDirectory $commandPilotRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $StdOutPath `
    -RedirectStandardError $StdErrPath | Out-Null
}

function Ensure-Npm {
  if (-not $npmCmd) {
    throw "npm.cmd was not found on this machine. Install Node.js 20+ first."
  }
}

function Get-EnvEntryOrDefault {
  param(
    [hashtable]$Entries,
    [string]$Key,
    [string]$DefaultValue
  )

  if ($Entries.ContainsKey($Key) -and $Entries[$Key]) {
    return [string]$Entries[$Key]
  }

  return $DefaultValue
}

function Test-DesktopBuildIsPortable {
  if (-not (Test-Path $desktopDistPath)) {
    return $false
  }

  $distHtml = Get-Content -Path $desktopDistPath -Raw
  return $distHtml -notmatch 'src="/assets/' -and $distHtml -notmatch 'href="/assets/'
}

function Ensure-DesktopBuild {
  if (-not $Rebuild -and (Test-DesktopBuildIsPortable)) {
    return
  }

  Ensure-Npm
  Push-Location $commandPilotRoot
  try {
    & $npmCmd run build:desktop
    if ($LASTEXITCODE -ne 0) {
      throw "Desktop build failed."
    }
  } finally {
    Pop-Location
  }
}

function Ensure-Ollama {
  if (Test-Endpoint $ollamaUrl) {
    return
  }

  if (-not $ollamaCmd) {
    return
  }

  Start-DetachedProcess `
    -FilePath $ollamaCmd `
    -ArgumentList @("serve") `
    -StdOutPath $ollamaOutLog `
    -StdErrPath $ollamaErrLog

  [void](Wait-ForEndpoint -Url $ollamaUrl -Attempts 10 -DelaySeconds 1)
}

function Ensure-Bridge {
  if (Test-Endpoint $bridgeUrl) {
    return
  }

  Ensure-Npm
  Start-DetachedProcess `
    -FilePath $npmCmd `
    -ArgumentList @("run", "dev:bridge") `
    -StdOutPath $bridgeOutLog `
    -StdErrPath $bridgeErrLog

  if (-not (Wait-ForEndpoint -Url $bridgeUrl -Attempts 20 -DelaySeconds 1)) {
    throw "The local CommandPilot bridge did not come online."
  }
}

function Test-PcAgentRunning {
  if (-not (Test-Path $pcAgentScript)) {
    return $false
  }

  $process = Get-CimInstance Win32_Process -Filter "Name = 'python.exe' OR Name = 'pythonw.exe'" |
    Where-Object { $_.CommandLine -like "*$pcAgentScript*" } |
    Select-Object -First 1

  return $null -ne $process
}

function Ensure-PcAgent {
  $envEntries = Get-EnvFileEntries
  $relayUrl = $envEntries["RELAY_URL"]
  $authToken = $envEntries["AUTH_TOKEN"]

  if (-not $relayUrl -or -not $authToken) {
    return
  }

  if ($relayUrl -like "*your-relay-url*" -or $authToken -eq "change-me-in-env") {
    return
  }

  if (-not $pythonCmd -or -not (Test-Path $pcAgentScript)) {
    return
  }

  if (Test-PcAgentRunning) {
    return
  }

  $bridgeRuntimeUrl = Get-EnvEntryOrDefault -Entries $envEntries -Key "COMMANDPILOT_BRIDGE_URL" -DefaultValue "http://127.0.0.1:8787"
  $ollamaModel = Get-EnvEntryOrDefault -Entries $envEntries -Key "OLLAMA_MODEL" -DefaultValue "qwen2.5-coder:7b"

  $bootstrapScript = @"
`$env:RELAY_URL = '$relayUrl'
`$env:AUTH_TOKEN = '$authToken'
`$env:COMMANDPILOT_BRIDGE_URL = '$bridgeRuntimeUrl'
`$env:OLLAMA_MODEL = '$ollamaModel'
& '$pythonCmd' '$pcAgentScript'
"@

  Start-DetachedProcess `
    -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $bootstrapScript) `
    -StdOutPath $pcAgentOutLog `
    -StdErrPath $pcAgentErrLog
}

function Open-EchoWindow {
  $browser = $preferredBrowsers | Where-Object { Test-Path $_ } | Select-Object -First 1
  $desktopFileUri = ([System.Uri]((Resolve-Path $desktopDistPath).Path)).AbsoluteUri

  if ($browser) {
    Start-Process -FilePath $browser -ArgumentList @("--app=$desktopFileUri") | Out-Null
    return
  }

  Start-Process $desktopDistPath | Out-Null
}

Ensure-Ollama
Ensure-DesktopBuild
Ensure-Bridge
Ensure-PcAgent
Open-EchoWindow
