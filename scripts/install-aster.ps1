# Windows branch of scripts/install-aster.sh
# Script address:
#   https://raw.githubusercontent.com/aster-ai-lab/aster/main/scripts/install-aster.ps1
# When this file is not already inside a checkout, it clones
#   https://github.com/aster-ai-lab/aster.git
# into %USERPROFILE%\src\aster (or $env:ASTER_REPO) and runs that copy.
# Builds the locked release of aster and a3s-code-acp, then copies both
# into one directory. Does not download a CLI binary. Does not enable auto-update.
param(
    [string]$Prefix = ""
)

$ErrorActionPreference = "Stop"

function Refuse-Download([string]$Value) {
    if ($Value -match "://") {
        Write-Error "this installer does not download binaries"
        exit 1
    }
}

if ($env:OS -ne "Windows_NT") {
    Write-Error "This branch is for Windows. On macOS and Linux run https://raw.githubusercontent.com/aster-ai-lab/aster/main/scripts/install-aster.sh"
    exit 1
}
if ($env:ASTER_INSTALL_URL -or $env:GROK_INSTALL_URL) {
    Write-Error "this installer does not download binaries"
    exit 1
}
Refuse-Download $Prefix
foreach ($arg in $args) {
    Refuse-Download ([string]$arg)
}

$insideRepo = $false
if ($PSScriptRoot) {
    $candidate = Split-Path -Parent $PSScriptRoot
    if (Test-Path -LiteralPath (Join-Path $candidate "Cargo.toml")) {
        $insideRepo = $true
        $repo = $candidate
    }
}
if (-not $insideRepo) {
    if ($env:ASTER_REPO) {
        $dest = $env:ASTER_REPO
    } elseif ($env:USERPROFILE) {
        $dest = Join-Path $env:USERPROFILE "src\aster"
    } else {
        Write-Error "USERPROFILE is unset; set ASTER_REPO to the checkout path"
        exit 1
    }
    $gitDir = Join-Path $dest ".git"
    if ((Test-Path -LiteralPath $dest) -and -not (Test-Path -LiteralPath $gitDir)) {
        Write-Error "$dest exists and is not an Aster checkout"
        exit 1
    }
    if (-not (Test-Path -LiteralPath $gitDir)) {
        $parent = Split-Path -Parent $dest
        if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
        & git clone --depth 1 --branch main "https://github.com/aster-ai-lab/aster.git" $dest
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    } else {
        & git -C $dest pull --ff-only
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    $local = Join-Path $dest "scripts\install-aster.ps1"
    $invoke = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $local)
    if ($Prefix) { $invoke += @("-Prefix", $Prefix) }
    if (Get-Command powershell.exe -ErrorAction SilentlyContinue) {
        & powershell.exe @invoke
    } else {
        & pwsh @invoke
    }
    exit $LASTEXITCODE
}

if (-not $Prefix) {
    if ($env:LOCALAPPDATA) {
        $Prefix = Join-Path $env:LOCALAPPDATA "Aster\bin"
    } else {
        $Prefix = Join-Path $env:USERPROFILE ".local\bin"
    }
}

Set-Location $repo
if (Test-Path Env:GROK_VERSION) { Remove-Item Env:GROK_VERSION }
if (-not $env:ASTER_INSTALL_COMMIT) {
    $snap = & git -C $repo rev-parse HEAD 2>$null
    if ($LASTEXITCODE -eq 0 -and $snap) {
        $env:ASTER_INSTALL_COMMIT = $snap.Trim()
    }
}
if ($env:ASTER_INSTALL_COMMIT) {
    $env:GROK_COMMIT = $env:ASTER_INSTALL_COMMIT
} elseif (Test-Path Env:GROK_COMMIT) {
    Remove-Item Env:GROK_COMMIT
}
& cargo build --locked --release
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

if ($env:CARGO_TARGET_DIR) {
    $release = Join-Path $env:CARGO_TARGET_DIR "release"
} else {
    $release = Join-Path $repo "target\release"
}
$srcAster = Join-Path $release "aster.exe"
$srcAcp = Join-Path $release "a3s-code-acp.exe"
if (-not (Test-Path -LiteralPath $srcAster) -or -not (Test-Path -LiteralPath $srcAcp)) {
    Write-Error "locked release did not emit aster.exe and a3s-code-acp.exe in $release"
    exit 1
}

New-Item -ItemType Directory -Force -Path $Prefix | Out-Null
$destAster = Join-Path $Prefix "aster.exe"
$destAcp = Join-Path $Prefix "a3s-code-acp.exe"
Copy-Item -LiteralPath $srcAster -Destination $destAster -Force
Copy-Item -LiteralPath $srcAcp -Destination $destAcp -Force

Write-Output "platform=windows"
Write-Output "installed Aster v0.1.0 into $Prefix"
Write-Output "aster=$destAster"
Write-Output "a3s-code-acp=$destAcp"
