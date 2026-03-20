# KolShek uninstaller for Windows
# Usage: irm https://kolshek.com/uninstall.ps1 | iex

$ErrorActionPreference = 'Stop'

$DefaultInstallDir = "$env:LOCALAPPDATA\kolshek"
$InstallDir = if ($env:KOLSHEK_INSTALL_DIR) { $env:KOLSHEK_INSTALL_DIR } else { $DefaultInstallDir }
$BinaryPath = Join-Path $InstallDir "kolshek.exe"

function Write-Info  { param($Msg) Write-Host "info  " -ForegroundColor Cyan -NoNewline; Write-Host $Msg }
function Write-Done  { param($Msg) Write-Host "done  " -ForegroundColor Green -NoNewline; Write-Host $Msg }
function Write-Warn  { param($Msg) Write-Host "warn  " -ForegroundColor Yellow -NoNewline; Write-Host $Msg }

# --- Remove binary ---

if (Test-Path $BinaryPath) {
    Remove-Item $BinaryPath -Force
    Write-Done "Removed $BinaryPath"
} else {
    Write-Warn "kolshek not found at $BinaryPath"
}

# Remove install directory if empty
if ((Test-Path $InstallDir) -and @(Get-ChildItem $InstallDir).Count -eq 0) {
    Remove-Item $InstallDir -Force
    Write-Done "Removed empty directory $InstallDir"
}

# --- Remove from PATH ---

$UserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($UserPath) {
    $Entries = $UserPath.Split(';') | Where-Object { $_.TrimEnd('\') -ne $InstallDir.TrimEnd('\') -and $_ -ne '' }
    $NewPath = $Entries -join ';'
    if ($NewPath -ne $UserPath) {
        [Environment]::SetEnvironmentVariable('Path', $NewPath, 'User')
        Write-Done "Removed $InstallDir from user PATH"
    }
}

# --- Done ---

Write-Host ""
Write-Host "  KolShek has been uninstalled." -ForegroundColor Green
Write-Host ""
Write-Host "  To also remove your data:"
Write-Host "    Remove-Item `"$env:APPDATA\kolshek-nodejs`" -Recurse -Force" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Restart your terminal for PATH changes to take effect." -ForegroundColor Yellow
Write-Host ""
