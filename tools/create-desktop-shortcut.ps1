$ErrorActionPreference = "Stop"

$commandPilotRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$launcherPath = Join-Path $commandPilotRoot "tools\launch-echo.ps1"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "CommandPilot.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$launcherPath`""
$shortcut.WorkingDirectory = $commandPilotRoot
$shortcut.IconLocation = "shell32.dll,44"
$shortcut.Description = "Launch CommandPilot in local Ollama mode."
$shortcut.Save()

Write-Host "Desktop shortcut created at $shortcutPath"
