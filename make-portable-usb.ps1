# ======================================================================
# Mada-RAG Portable - Direct Fast Sync & USB Deployment Tool
# ======================================================================
param(
    [string]$Flash = '',
    [string]$DestRoot = '',
    [string]$LlamaBinDir = '',
    [string]$ModelFile = ''
)

$ErrorActionPreference = 'Stop'
$AppSource = $PSScriptRoot
$Dist = Join-Path $AppSource 'dist'

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "          Mada-RAG Assistant - USB Fast Deployment Tool               " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Verify build executable
$serverExe = Join-Path $Dist 'mada-rag-server.exe'
if (-not (Test-Path -LiteralPath $serverExe)) {
    throw "Executable not found at: $serverExe. Please build mada-rag-server.exe first."
}

# 2. Read model configuration
$cfgFile = Join-Path $AppSource 'model_config.json'
if (-not (Test-Path -LiteralPath $cfgFile)) {
    throw "Configuration file not found: $cfgFile"
}
$cfg = Get-Content -LiteralPath $cfgFile -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $LlamaBinDir) { $LlamaBinDir = Split-Path -Parent $cfg.exe }
if (-not $ModelFile) { $ModelFile = $cfg.model }

if (-not (Test-Path -LiteralPath $LlamaBinDir)) {
    throw "Llama runtime directory not found: $LlamaBinDir"
}
if (-not (Test-Path -LiteralPath $ModelFile)) {
    throw "Model file not found: $ModelFile"
}

# 3. Detect USB and Removable drives
function Get-UsbDrives {
    $list = @()
    try {
        $disks = Get-Disk -ErrorAction SilentlyContinue | Where-Object {
            $_.BusType -eq 'USB' -and -not $_.IsOffline -and -not $_.IsReadOnly -and -not $_.IsBoot -and -not $_.IsSystem
        }
        foreach ($d in $disks) {
            foreach ($p in (Get-Partition -DiskNumber $d.Number -ErrorAction SilentlyContinue)) {
                if ($p.DriveLetter) {
                    $v = $p | Get-Volume -ErrorAction SilentlyContinue
                    if ($v -and $v.SizeRemaining -gt 0) {
                        $list += [pscustomobject]@{
                            Drive = "$($p.DriveLetter):"
                            Device = $d.FriendlyName
                            Label = $v.FileSystemLabel
                            FreeGB = [math]::Round($v.SizeRemaining / 1GB, 2)
                        }
                    }
                }
            }
        }
    } catch {}

    try {
        $removables = Get-Volume -ErrorAction SilentlyContinue | Where-Object {
            $_.DriveType -eq 'Removable' -and $_.DriveLetter -and $_.SizeRemaining -gt 0
        }
        foreach ($v in $removables) {
            $let = "$($v.DriveLetter):"
            if (-not ($list | Where-Object { $_.Drive -eq $let })) {
                $list += [pscustomobject]@{
                    Drive = $let
                    Device = 'Removable USB'
                    Label = $v.FileSystemLabel
                    FreeGB = [math]::Round($v.SizeRemaining / 1GB, 2)
                }
            }
        }
    } catch {}

    return @($list | Sort-Object Drive -Unique)
}

# 4. Prompt or auto-detect USB destination
while ([string]::IsNullOrWhiteSpace($Flash)) {
    Write-Host "`nScanning for connected USB flash drives..." -ForegroundColor Gray
    $usbTargets = Get-UsbDrives

    if ($usbTargets.Count -eq 0) {
        Write-Host "Waiting for USB flash drive to be plugged in (checking every 2s)..." -ForegroundColor Yellow -NoNewline
        $retries = 0
        while ($usbTargets.Count -eq 0 -and $retries -lt 30) {
            Start-Sleep -Seconds 2
            $retries++
            $usbTargets = Get-UsbDrives
            if ($usbTargets.Count -gt 0) { break }
            Write-Host "." -NoNewline -ForegroundColor Gray
        }
        Write-Host ""

        if ($usbTargets.Count -eq 0) {
            Write-Host "No USB drive detected automatically. Type drive letter (e.g. H or F) or press Enter to retry: " -ForegroundColor Yellow -NoNewline
            $manual = Read-Host
            if ($manual -match '^[A-Za-z]') {
                $Flash = ($manual.Trim().Substring(0, 1).ToUpper() + ':')
                break
            }
            continue
        }
    }

    if ($usbTargets.Count -eq 1) {
        $Flash = $usbTargets[0].Drive
        $info = $usbTargets[0]
        Write-Host ("[FOUND] USB Destination: {0} ({1} | Free: {2} GB)" -f $info.Drive, $info.Device, $info.FreeGB) -ForegroundColor Green
        break
    } elseif ($usbTargets.Count -gt 1) {
        Write-Host "`nMultiple USB drives detected. Please select destination:" -ForegroundColor Yellow
        for ($i = 0; $i -lt $usbTargets.Count; $i++) {
            $t = $usbTargets[$i]
            Write-Host ("  [{0}] {1}  ({2})  Free space: {3} GB" -f ($i + 1), $t.Drive, $t.Label, $t.FreeGB) -ForegroundColor White
        }
        $choice = Read-Host "Enter destination number (1-$($usbTargets.Count))"
        $num = 0
        if ([int]::TryParse($choice, [ref]$num) -and $num -ge 1 -and $num -le $usbTargets.Count) {
            $Flash = $usbTargets[$num - 1].Drive
            break
        } else {
            Write-Host "Invalid selection. Retrying..." -ForegroundColor Red
        }
    }
}

$Flash = $Flash.Trim().TrimEnd('\')
if ($Flash -notmatch '^[A-Za-z]:$') { throw "Target must be a valid drive letter like H: or F:" }
if (-not (Test-Path -LiteralPath ($Flash + '\'))) { throw "Drive unavailable: $Flash" }

if (-not $DestRoot) { $DestRoot = Join-Path ($Flash + '\') 'mada-rag' }
Write-Host "`nDestination Folder: $DestRoot" -ForegroundColor Cyan

# 5. High-speed copy function with real-time progress bar
function Copy-WithProgress($SourcePath, $TargetPath, $DisplayName) {
    $parent = Split-Path -Parent $TargetPath
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }

    $src = Get-Item -LiteralPath $SourcePath
    if (Test-Path -LiteralPath $TargetPath) {
        $tgt = Get-Item -LiteralPath $TargetPath
        # Skip if identical size and target is not older than source
        if ($src.Length -eq $tgt.Length) {
            if ($src.Length -gt 50MB -or $src.LastWriteTime -le $tgt.LastWriteTime) {
                $szStr = if ($src.Length -gt 1GB) { "$([math]::Round($src.Length / 1GB, 2)) GB" } else { "$([math]::Round($src.Length / 1MB, 1)) MB" }
                Write-Host ("  [UP-TO-DATE] {0,-35} ({1})" -f $DisplayName, $szStr) -ForegroundColor DarkGray
                return
            }
        }
    }

    $totalBytes = $src.Length
    $totalMB = [math]::Round($totalBytes / 1MB, 1)

    # For small files (< 15MB), copy directly
    if ($totalBytes -lt 15MB) {
        Write-Host ("  [COPYING]    {0,-35} ({1} MB)... " -f $DisplayName, $totalMB) -NoNewline -ForegroundColor White
        Copy-Item -LiteralPath $SourcePath -Destination $TargetPath -Force
        Write-Host "[OK]" -ForegroundColor Green
        return
    }

    # For large files (> 15MB), use optimized 8MB buffer stream with live progress bar
    $totalGB = [math]::Round($totalBytes / 1GB, 2)
    $isGB = $totalBytes -gt 1GB
    $sizeLabel = if ($isGB) { "$totalGB GB" } else { "$totalMB MB" }

    Write-Host ("  [COPYING]    {0,-35} ({1})" -f $DisplayName, $sizeLabel) -ForegroundColor Cyan

    $bufSize = 8 * 1024 * 1024 # 8 MB buffer
    $buf = New-Object byte[] $bufSize
    $inStream = [IO.File]::OpenRead($SourcePath)
    $outStream = [IO.File]::Create($TargetPath)
    $copied = 0
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $lastUpdate = [DateTime]::MinValue

    try {
        while (($bytesRead = $inStream.Read($buf, 0, $bufSize)) -gt 0) {
            $outStream.Write($buf, 0, $bytesRead)
            $copied += $bytesRead

            # Update progress max 5 times per second to avoid console flicker
            $now = [DateTime]::UtcNow
            if (($now - $lastUpdate).TotalMilliseconds -ge 200 -or $copied -eq $totalBytes) {
                $lastUpdate = $now
                $pct = [math]::Min(100, [math]::Round(($copied / $totalBytes) * 100))
                $elapsedSec = [math]::Max($sw.Elapsed.TotalSeconds, 0.05)
                $speedMB = [math]::Round(($copied / 1MB) / $elapsedSec, 1)
                
                # Visual ASCII progress bar
                $barLength = 22
                $filled = [int](($pct / 100) * $barLength)
                $empty = [math]::Max(0, $barLength - $filled)
                $bar = ("=" * $filled) + (">" * [int]($filled -lt $barLength)) + (" " * [math]::Max(0, $empty - 1))
                if ($filled -eq $barLength) { $bar = "=" * $barLength }

                if ($isGB) {
                    $curGB = [math]::Round($copied / 1GB, 2)
                    $remainingSec = if ($speedMB -gt 0) { [math]::Round(($totalBytes - $copied) / (1MB * $speedMB)) } else { 0 }
                    $etaStr = if ($remainingSec -gt 0) { "ETA: ${remainingSec}s" } else { "Finalizing..." }
                    $line = ("`r    [{0}] {1,3}% | {2,4} / {3} GB | {4,5} MB/s | {5,-14}" -f $bar, $pct, $curGB, $totalGB, $speedMB, $etaStr)
                } else {
                    $curMB = [math]::Round($copied / 1MB, 1)
                    $line = ("`r    [{0}] {1,3}% | {2,5} / {3} MB | {4,5} MB/s" -f $bar, $pct, $curMB, $totalMB, $speedMB)
                }
                Write-Host $line -NoNewline -ForegroundColor White
            }
        }
        $totalElapsed = [math]::Max($sw.Elapsed.TotalSeconds, 0.1)
        $avgSpeed = [math]::Round(($totalBytes / 1MB) / $totalElapsed, 1)
        Write-Host ("`r    [======================] 100% | {0} | Avg: {1} MB/s [DONE]     " -f $sizeLabel, $avgSpeed) -ForegroundColor Green
    } finally {
        $inStream.Close()
        $outStream.Close()
    }
}

# 6. Start copying files
Write-Host "`nDeploying files to USB drive..." -ForegroundColor Yellow

# A) Standalone Server Executable (embedded HTML, CSS, JS)
Copy-WithProgress $serverExe (Join-Path $DestRoot 'mada-rag-server.exe') "Server Executable (Self-Contained)"

# B) Llama runtime binaries and CUDA / AVX libraries
$runtimeDlls = @(
    'llama-server.exe',
    'llama-server-impl.dll',
    'llama-common.dll',
    'llama.dll',
    'mtmd.dll',
    'ggml.dll',
    'ggml-base.dll',
    'ggml-cpu.dll',
    'ggml-cuda.dll',
    'cublas64_12.dll',
    'cublasLt64_12.dll',
    'cudart64_12.dll'
)

foreach ($dll in $runtimeDlls) {
    $srcDll = Join-Path $LlamaBinDir $dll
    if (Test-Path -LiteralPath $srcDll) {
        Copy-WithProgress $srcDll (Join-Path $DestRoot "portable\llama\$dll") "Runtime: $dll"
    }
}

# C) Active AI Model (.gguf)
Copy-WithProgress $ModelFile (Join-Path $DestRoot 'portable\models\model.gguf') "AI Model: $(Split-Path -Leaf $ModelFile)"

# D) Portable relative configuration
$portableConfig = @{
    spec = "auto"
    exe = "portable\llama\llama-server.exe"
    model = "portable\models\model.gguf"
} | ConvertTo-Json

$portableConfig | Set-Content -LiteralPath (Join-Path $DestRoot 'model_config.json') -Encoding ASCII
Write-Host "  [CONFIG]     model_config.json created successfully." -ForegroundColor Green

# E) Windows launcher script (run-mada-rag.bat)
$launcherContent = @'
@echo off
setlocal
title Mada-RAG Portable Assistant
cd /d "%~dp0"
if not exist "runtime-temp" mkdir "runtime-temp"
set "TEMP=%~dp0runtime-temp"
set "TMP=%TEMP%"
echo ======================================================================
echo             Starting Mada-RAG Portable Assistant...
echo ======================================================================
echo Server is launching and your web browser will open automatically:
echo http://127.0.0.1:8787/chat
echo.
"%~dp0mada-rag-server.exe" %*
if errorlevel 1 (
  echo.
  echo [ERROR] Application encountered an issue. See message above.
  pause
)
'@
$launcherContent | Set-Content -LiteralPath (Join-Path $DestRoot 'run-mada-rag.bat') -Encoding ASCII
Write-Host "  [LAUNCHER]   run-mada-rag.bat created successfully." -ForegroundColor Green

# F) README documentation file
$readmeContent = @'
======================================================================
              Mada-RAG Assistant (Offline Portable USB)
======================================================================

1. HOW TO RUN:
   - Double-click: run-mada-rag.bat
   - The server starts and opens your browser at:
     http://127.0.0.1:8787/chat

2. WINDOWS SMARTSCREEN (FIRST RUN NOTICE):
   - Because this is an open-source binary without an expensive Microsoft
     signing certificate, Windows may show: "Windows protected your PC".
   - Solution: Click "More info" then click "Run anyway".

3. FIRST-RUN MODEL WARM-UP:
   - When sending your first message or triggering Quick Popup, the engine
     loads the model weights into RAM/VRAM (takes 2-5 seconds).
   - After this initial load, all subsequent responses are instantaneous!

4. QUICK POPUP SHORTCUTS:
   - Ctrl + Alt + Space : Select text in ANY app to get an instant AI response.
   - Ctrl + Alt + R     : Reopen the popup with the last generated response.

5. FEATURES:
   - 100% Offline & Private (no internet required).
   - No installation and no Python required.
   - Automatically utilizes NVIDIA GPUs (CUDA) or Intel/AMD CPUs (AVX).
======================================================================
'@
$readmeContent | Set-Content -LiteralPath (Join-Path $DestRoot 'PORTABLE-README.txt') -Encoding ASCII
Write-Host "  [DOCS]       PORTABLE-README.txt created successfully." -ForegroundColor Green

# 7. Summary
$totalSize = (Get-ChildItem -LiteralPath $DestRoot -Recurse -File | Measure-Object Length -Sum).Sum
$totalSizeGB = [math]::Round($totalSize / 1GB, 2)
$fileCount = (Get-ChildItem -LiteralPath $DestRoot -Recurse -File | Measure-Object).Count

Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host "  SUCCESS: Mada-RAG Portable is 100% ready on your USB drive!         " -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ("  Target Folder: {0}" -f $DestRoot) -ForegroundColor Cyan
Write-Host ("  Total Files:   {0} files" -f $fileCount) -ForegroundColor White
Write-Host ("  Total Size:    {0} GB" -f $totalSizeGB) -ForegroundColor White
Write-Host ("  To Run:        Open your USB drive and launch [run-mada-rag.bat]") -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Green
