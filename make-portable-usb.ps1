# Deploy the compiled application, not the development environment.
param(
    [string]$Flash = '',
    [string]$DestRoot = '',
    [string]$LlamaBinDir = '',
    [string]$ModelFile = ''
)
$ErrorActionPreference = 'Stop'
$AppSource = $PSScriptRoot
$Dist = Join-Path $AppSource 'dist'
# Detect by physical USB bus, not by a fixed letter or folder name.
# USB disks can report themselves as fixed disks rather than removable ones.
if ([string]::IsNullOrWhiteSpace($Flash)) {
    $usbTargets = @(
        foreach ($disk in (Get-Disk -ErrorAction Stop | Where-Object {
            $_.BusType -eq 'USB' -and -not $_.IsOffline -and
            -not $_.IsReadOnly -and -not $_.IsBoot -and -not $_.IsSystem
        })) {
            foreach ($partition in (Get-Partition -DiskNumber $disk.Number -ErrorAction Stop)) {
                if (-not $partition.DriveLetter) { continue }
                $volume = $partition | Get-Volume -ErrorAction Stop
                if (-not $volume.FileSystem -or $volume.Size -le 0) { continue }
                [pscustomobject]@{
                    Drive = ([string]$partition.DriveLetter + ':')
                    Device = $disk.FriendlyName
                    Label = $volume.FileSystemLabel
                    FreeGB = [math]::Round($volume.SizeRemaining / 1GB, 2)
                }
            }
        }
    )
    $usbTargets = @($usbTargets | Sort-Object Drive -Unique)
    if ($usbTargets.Count -eq 0) {
        throw 'No writable USB volume with a drive letter found. Connect a USB drive, or specify -Flash explicitly.'
    }
    if ($usbTargets.Count -eq 1) {
        $Flash = $usbTargets[0].Drive
    } else {
        Write-Host 'Multiple USB volumes found. Select the copy destination:'
        for ($i = 0; $i -lt $usbTargets.Count; $i++) {
            $target = $usbTargets[$i]
            Write-Host ('[{0}] {1}  {2}  {3}  Free: {4} GB' -f ($i + 1), $target.Drive, $target.Device, $target.Label, $target.FreeGB)
        }
        $choice = Read-Host 'Enter the destination number (or cancel with Ctrl+C)'
        $number = 0
        if (-not [int]::TryParse($choice, [ref]$number) -or $number -lt 1 -or $number -gt $usbTargets.Count) {
            throw 'Invalid USB selection. Nothing was copied.'
        }
        $Flash = $usbTargets[$number - 1].Drive
    }
    Write-Host "Detected USB destination: $Flash"
}
$Flash = $Flash.Trim().TrimEnd('\')
if ($Flash -notmatch '^[A-Za-z]:$') { throw 'Flash must be a drive letter, for example G:' }
if ($DestRoot) {
    $destinationDrive = [IO.Path]::GetPathRoot([IO.Path]::GetFullPath($DestRoot)).TrimEnd('\')
    if ($destinationDrive -ine $Flash) { throw "DestRoot must be on the selected drive $Flash" }
}
if (-not (Test-Path -LiteralPath ($Flash.TrimEnd('\') + '\'))) { throw "Drive unavailable: $Flash" }
if (-not $DestRoot) { $DestRoot = Join-Path ($Flash.TrimEnd('\') + '\') 'mada-rag' }
$cfg = Get-Content -LiteralPath (Join-Path $AppSource 'model_config.json') -Raw | ConvertFrom-Json
if (-not $LlamaBinDir) { $LlamaBinDir = Split-Path -Parent $cfg.exe }
if (-not $ModelFile) { $ModelFile = $cfg.model }
$assets = @('mada-rag-server.exe', 'index.html', 'chat.html', 'static')
# This backend loads ggml backends dynamically: keep its matching DLL set.
$runtime = @('llama-server.exe','llama-server-impl.dll','llama-common.dll',
    'llama.dll','mtmd.dll','ggml.dll','ggml-base.dll','ggml-cpu.dll',
    'ggml-cuda.dll','cublas64_12.dll','cublasLt64_12.dll','cudart64_12.dll')
foreach ($name in $assets) {
    if (-not (Test-Path -LiteralPath (Join-Path $Dist $name))) { throw "Missing built asset: $name" }
}
foreach ($name in $runtime) {
    if (-not (Test-Path -LiteralPath (Join-Path $LlamaBinDir $name))) { throw "Missing runtime: $name" }
}
if (-not (Test-Path -LiteralPath $ModelFile)) { throw "Missing model: $ModelFile" }
if ([IO.Path]::GetFullPath($DestRoot).TrimEnd('\') -eq [IO.Path]::GetFullPath($AppSource).TrimEnd('\')) { throw 'Destination cannot be source.' }

function Copy-Checked($Source, $Target) {
    $parent = Split-Path -Parent $Target
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    $sourceHash = (Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash
    if ((Test-Path -LiteralPath $Target) -and (Get-FileHash -LiteralPath $Target -Algorithm SHA256).Hash -eq $sourceHash) { return }
    Copy-Item -LiteralPath $Source -Destination $Target -Force
    if ((Get-FileHash -LiteralPath $Target -Algorithm SHA256).Hash -ne $sourceHash) { throw "Copy verification failed: $Target" }
}

# Retire old Python launchers/source and development files to a LOCAL backup.
# Conversations, uploads, indexes and background settings remain on the USB.
$Backup = Join-Path $AppSource ('backups\usb-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$legacy = @('server.py','background_agent.py','translate_bridge.py','start-admin.bat',
    'make-portable-usb.ps1','model_config.json','chat.html.bak','.gitignore',
    '.venv-build','.venv','venv','build','build-temp','dist','__pycache__')
if (Test-Path -LiteralPath $DestRoot) {
    $legacy += @(Get-ChildItem -LiteralPath $DestRoot -Filter '*.bat' -File | ForEach-Object { $_.Name })
    foreach ($name in ($legacy | Select-Object -Unique)) {
        $old = Join-Path $DestRoot $name
        if (Test-Path -LiteralPath $old) {
            New-Item -ItemType Directory -Force -Path $Backup | Out-Null
            Move-Item -LiteralPath $old -Destination (Join-Path $Backup $name)
        }
    }
}
New-Item -ItemType Directory -Force -Path $DestRoot | Out-Null
foreach ($name in @('mada-rag-server.exe','index.html','chat.html')) {
    Copy-Checked (Join-Path $Dist $name) (Join-Path $DestRoot $name)
}
$staticSource = Join-Path $Dist 'static'
foreach ($file in (Get-ChildItem -LiteralPath $staticSource -File -Recurse)) {
    $relative = $file.FullName.Substring($staticSource.Length).TrimStart('\')
    Copy-Checked $file.FullName (Join-Path (Join-Path $DestRoot 'static') $relative)
}
foreach ($name in $runtime) {
    Copy-Checked (Join-Path $LlamaBinDir $name) (Join-Path $DestRoot ('portable\llama\' + $name))
}
Copy-Checked $ModelFile (Join-Path $DestRoot 'portable\models\model.gguf')
# Relative paths are anchored by run-mada-rag.bat, independent of drive letter.
@{spec='low'; exe='portable\llama\llama-server.exe'; model='portable\models\model.gguf'; ngl=0; ctx=1024} |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $DestRoot 'model_config.json') -Encoding ASCII
@'
@echo off
setlocal
cd /d "%~dp0"
if not exist "runtime-temp" mkdir "runtime-temp"
set "TEMP=%~dp0runtime-temp"
set "TMP=%TEMP%"
"%~dp0mada-rag-server.exe" %*
if errorlevel 1 (
  echo Application failed. Review the error above.
  pause
)
'@ | Set-Content -LiteralPath (Join-Path $DestRoot 'run-mada-rag.bat') -Encoding ASCII
@'
Run run-mada-rag.bat. No Python installation is needed.
Keep the EXE, HTML files, static and portable folders together.
The launcher works with any USB drive letter and keeps TEMP on the USB.
Default: CPU generation (ngl=0); CUDA DLLs are retained for optional GPU use.
Windows x64 and a CPU compatible with this AVX backend are required.
Optional external Argos translation is not included.
'@ | Set-Content -LiteralPath (Join-Path $DestRoot 'PORTABLE-README.txt') -Encoding ASCII
$size = (Get-ChildItem -LiteralPath $DestRoot -Recurse -File | Measure-Object Length -Sum).Sum
"DEPLOY-PASS target=$DestRoot sizeGiB=$([math]::Round($size/1GB,3)) backup=$Backup"
