# Install aster-cli v0.1.0 on Windows from this repository's GitHub Release.
# One command:
#   irm "https://raw.githubusercontent.com/aster-ai-lab/aster/main/scripts/install-aster.ps1" -OutFile "$env:TEMP\install-aster.ps1"
#   powershell -NoProfile -ExecutionPolicy Bypass -File "$env:TEMP\install-aster.ps1" -Prefix "$env:LOCALAPPDATA\Aster\bin"
# Downloads aster-cli-v0.1.0-windows.zip, which contains aster.exe and a3s-code-acp.exe.
# Does not clone this repository and does not compile.
param(
    [string]$Prefix = ""
)

$ErrorActionPreference = "Stop"
$OfficialBase = "https://github.com/aster-ai-lab/aster/releases/download/aster-cli-v0.1.0"
$AssetName = "aster-cli-v0.1.0-windows.zip"
$OfficialAsset = "$OfficialBase/$AssetName"

function Refuse-Download {
    Write-Error "this installer does not download that binary"
    exit 1
}

if ($env:OS -ne "Windows_NT") {
    Write-Error "This branch is for Windows. On macOS and Linux run https://raw.githubusercontent.com/aster-ai-lab/aster/main/scripts/install-aster.sh"
    exit 1
}
if ($env:ASTER_INSTALL_URL -or $env:GROK_INSTALL_URL) {
    Refuse-Download
}
if ($Prefix -match "://") {
    Refuse-Download
}
foreach ($arg in $args) {
    $text = [string]$arg
    if ($text -notmatch "://") { continue }
    if ($text -eq $OfficialAsset) { continue }
    Refuse-Download
}

$base = if ($env:ASTER_RELEASE_BASE) { $env:ASTER_RELEASE_BASE } else { $OfficialBase }
if ($base -match "x\.ai") {
    Refuse-Download
}
$localAsset = $null
if ($base -eq $OfficialBase) {
    $assetUrl = "$base/$AssetName"
} elseif (($base -notmatch "://") -and (Test-Path -LiteralPath $base -PathType Container)) {
    $assetUrl = Join-Path $base $AssetName
    $localAsset = $assetUrl
} else {
    Refuse-Download
}

if (-not $Prefix) {
    if ($env:LOCALAPPDATA) {
        $Prefix = Join-Path $env:LOCALAPPDATA "Aster\bin"
    } else {
        $Prefix = Join-Path $env:USERPROFILE ".local\bin"
    }
}

$work = Join-Path ([System.IO.Path]::GetTempPath()) ("aster-cli-" + [guid]::NewGuid().ToString("n"))
New-Item -ItemType Directory -Force -Path $work | Out-Null
try {
    $archive = Join-Path $work $AssetName
    Write-Output "platform=windows"
    Write-Output "release=aster-cli-v0.1.0"
    Write-Output "asset=$assetUrl"
    if ($localAsset) {
        Copy-Item -LiteralPath $localAsset -Destination $archive -Force
    } else {
        Invoke-WebRequest -Uri $assetUrl -OutFile $archive
    }
    $unpack = Join-Path $work "unpack"
    Expand-Archive -LiteralPath $archive -DestinationPath $unpack -Force
    $srcAster = Join-Path $unpack "aster.exe"
    $srcAcp = Join-Path $unpack "a3s-code-acp.exe"
    if (-not (Test-Path -LiteralPath $srcAster) -or -not (Test-Path -LiteralPath $srcAcp)) {
        Write-Error "archive $AssetName did not contain both aster-cli binaries"
        exit 1
    }
    New-Item -ItemType Directory -Force -Path $Prefix | Out-Null
    $destAster = Join-Path $Prefix "aster.exe"
    $destAcp = Join-Path $Prefix "a3s-code-acp.exe"
    Copy-Item -LiteralPath $srcAster -Destination $destAster -Force
    Copy-Item -LiteralPath $srcAcp -Destination $destAcp -Force
    Write-Output "installed Aster v0.1.0 into $Prefix"
    Write-Output "aster=$destAster"
    Write-Output "a3s-code-acp=$destAcp"
} finally {
    Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}
