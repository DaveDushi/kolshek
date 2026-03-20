# KolShek installer for Windows
# Usage: irm https://kolshek.com/install.ps1 | iex
#
# Environment variables:
#   KOLSHEK_INSTALL_DIR  Override install location (default: $env:LOCALAPPDATA\kolshek)
#   KOLSHEK_VERSION      Install a specific version (default: latest)

$ErrorActionPreference = 'Stop'

$Repo = "DaveDushi/kolshek"
$DefaultInstallDir = "$env:LOCALAPPDATA\kolshek"
$InstallDir = if ($env:KOLSHEK_INSTALL_DIR) { $env:KOLSHEK_INSTALL_DIR } else { $DefaultInstallDir }
$BinaryPath = Join-Path $InstallDir "kolshek.exe"

# --- Helpers ---

function Write-Info  { param($Msg) Write-Host "info  " -ForegroundColor Cyan -NoNewline; Write-Host $Msg }
function Write-Done  { param($Msg) Write-Host "done  " -ForegroundColor Green -NoNewline; Write-Host $Msg }
function Write-Warn  { param($Msg) Write-Host "warn  " -ForegroundColor Yellow -NoNewline; Write-Host $Msg }
function Write-Err   { param($Msg) Write-Host "error " -ForegroundColor Red -NoNewline; Write-Host $Msg }

# --- Architecture detection ---

$Arch = $env:PROCESSOR_ARCHITECTURE
switch ($Arch) {
    "AMD64" { $ArchName = "x64" }
    "x86"   {
        Write-Err "32-bit Windows is not supported."
        exit 1
    }
    "ARM64" {
        Write-Warn "ARM64 Windows is not officially supported yet. Trying x64 (emulated)."
        $ArchName = "x64"
    }
    default {
        Write-Err "Unsupported architecture: $Arch"
        exit 1
    }
}

$BinaryName = "kolshek-windows-$ArchName.exe"
Write-Info "Detected platform: windows-$ArchName"

# --- Determine version ---

$Version = $env:KOLSHEK_VERSION

if ($Version) {
    if ($Version -notmatch '^v') { $Version = "v$Version" }
    $Tag = $Version
    Write-Info "Installing version: $Tag"
} else {
    Write-Info "Fetching latest release..."
    try {
        $Release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ Accept = "application/vnd.github+json" }
        $Tag = $Release.tag_name
    } catch {
        Write-Err "Failed to fetch release info from GitHub."
        Write-Info "You may be rate-limited. Try setting `$env:GITHUB_TOKEN or download manually:"
        Write-Info "  https://github.com/$Repo/releases"
        exit 1
    }
    if (-not $Tag) {
        Write-Err "Could not determine latest version."
        exit 1
    }
    Write-Info "Latest version: $Tag"
}

# --- Download binary ---

$DownloadUrl = "https://github.com/$Repo/releases/download/$Tag/$BinaryName"
$TmpDir = Join-Path $env:TEMP "kolshek-install-$(Get-Random)"
New-Item -ItemType Directory -Path $TmpDir -Force | Out-Null
$TmpFile = Join-Path $TmpDir $BinaryName

try {
    Write-Info "Downloading $BinaryName..."
    # Disable progress bar — it slows Invoke-WebRequest from minutes to seconds
    $OldProgress = $ProgressPreference
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $TmpFile -UseBasicParsing
    $ProgressPreference = $OldProgress
} catch {
    Write-Err "Failed to download $BinaryName"
    Write-Info "URL: $DownloadUrl"
    Write-Info "Check that this version and platform exist at:"
    Write-Info "  https://github.com/$Repo/releases/tag/$Tag"
    Remove-Item $TmpDir -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}

# --- Verify checksum ---

$ChecksumUrl = "$DownloadUrl.sha256"
$ChecksumFile = Join-Path $TmpDir "checksum.sha256"

try {
    $OldProgress = $ProgressPreference
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $ChecksumUrl -OutFile $ChecksumFile -UseBasicParsing
    $ProgressPreference = $OldProgress
    $ExpectedLine = (Get-Content $ChecksumFile -Raw).Trim()
    $Expected = $ExpectedLine.Split(' ')[0].ToLower()
    $Actual = (Get-FileHash -Path $TmpFile -Algorithm SHA256).Hash.ToLower()

    if ($Expected -ne $Actual) {
        Write-Err "SECURITY: Checksum verification failed!"
        Write-Err "  Expected: $Expected"
        Write-Err "  Actual:   $Actual"
        Write-Err "The downloaded binary may have been tampered with. Aborting."
        Remove-Item $TmpDir -Recurse -Force -ErrorAction SilentlyContinue
        exit 1
    }
    Write-Done "Checksum verified"
} catch {
    Write-Warn "No checksum file available for this release. Skipping verification."
}

# --- Install binary ---

New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Move-Item -Path $TmpFile -Destination $BinaryPath -Force
Write-Done "Installed to $BinaryPath"

# --- Cleanup temp ---

Remove-Item $TmpDir -Recurse -Force -ErrorAction SilentlyContinue

# --- PATH management ---

$UserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not $UserPath) { $UserPath = "" }

$AlreadyOnPath = $false
foreach ($Entry in $UserPath.Split(';')) {
    if ($Entry.TrimEnd('\') -eq $InstallDir.TrimEnd('\')) {
        $AlreadyOnPath = $true
        break
    }
}

if (-not $AlreadyOnPath) {
    $NewPath = "$InstallDir;$UserPath"
    [Environment]::SetEnvironmentVariable('Path', $NewPath, 'User')
    # Also update current session so kolshek works immediately in this shell
    $env:Path = "$InstallDir;$env:Path"
    Write-Info "Added $InstallDir to user PATH"
}

# --- Success ---

$DisplayVersion = $Tag -replace '^v', ''
Write-Host ""
Write-Host "  KolShek " -NoNewline
Write-Host "v$DisplayVersion" -ForegroundColor Green -NoNewline
Write-Host " installed successfully!"
Write-Host ""
Write-Host "  Get started:"
Write-Host "    kolshek init" -ForegroundColor Cyan -NoNewline
Write-Host "     Set up your first bank or credit card"
Write-Host ""

# Check if available in current session
$TestCmd = Get-Command kolshek -ErrorAction SilentlyContinue
if (-not $TestCmd) {
    Write-Host "  Restart your terminal for PATH changes to take effect." -ForegroundColor Yellow
    Write-Host ""
}
