# ======================================================================
# Mada-RAG Assistant - Ultra-Fast Protected Deployment (USB to Drive C:)
# Copies the virus-immune ZIP file to C:, auto-extracts, and syncs model
# ======================================================================
param(
    [string]$DestDrive = 'C:',
    [string]$TargetFolder = 'C:\mada-rag',
    [switch]$LaunchImmediately = $false
)

$ErrorActionPreference = 'Stop'
$totalStopwatch = [Diagnostics.Stopwatch]::StartNew()

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   Mada-RAG Assistant - Protected ZIP Deployment to Drive C:          " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Locate Source Protected ZIP archive on USB
$zipCandidates = @(
    (Join-Path $PSScriptRoot 'mada-rag-portable.zip'),
    (Join-Path (Split-Path -Qualifier $PSScriptRoot) 'mada-rag-portable.zip'),
    'H:\mada-rag-portable.zip',
    (Join-Path $PSScriptRoot 'dist\mada-rag-v1.0-windows-x64-full.zip')
)

$sourceZip = ''
foreach ($cand in $zipCandidates) {
    if (Test-Path -LiteralPath $cand) {
        $sourceZip = $cand
        break
    }
}

if (-not $sourceZip) {
    # Search all removable drives
    foreach ($let in (Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root)) {
        $cand = Join-Path $let 'mada-rag-portable.zip'
        if (Test-Path -LiteralPath $cand) {
            $sourceZip = $cand
            break
        }
    }
}

if (-not $sourceZip) {
    throw "Source archive 'mada-rag-portable.zip' not found. Please ensure the USB drive is connected."
}

$zipItem = Get-Item -LiteralPath $sourceZip
$zipMB = [math]::Round($zipItem.Length / 1MB, 1)
Write-Host ("  [SOURCE ARCHIVE] {0} ({1} MB)" -f $sourceZip, $zipMB) -ForegroundColor Green

# 2. Check Drive C: Free Space
$cDrive = Get-PSDrive -Name 'C' -ErrorAction SilentlyContinue
if ($cDrive) {
    $freeCGB = [math]::Round($cDrive.Free / 1GB, 2)
    Write-Host ("  [DISK SPACE]     Drive C: Free Space: {0} GB" -f $freeCGB) -ForegroundColor Gray
    if ($freeCGB -lt 4.0) {
        Write-Host "  [WARNING] Drive C: has less than 4.0 GB free. Installation might be tight." -ForegroundColor Yellow
    }
}

# 3. High-speed copy function with real-time ASCII progress bar
function Copy-StreamWithProgress($SourcePath, $TargetPath, $DisplayName) {
    $parent = Split-Path -Parent $TargetPath
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }

    $src = Get-Item -LiteralPath $SourcePath
    if (Test-Path -LiteralPath $TargetPath) {
        $tgt = Get-Item -LiteralPath $TargetPath
        if ($src.Length -eq $tgt.Length -and $src.Length -gt 50MB) {
            $szStr = if ($src.Length -gt 1GB) { "$([math]::Round($src.Length / 1GB, 2)) GB" } else { "$([math]::Round($src.Length / 1MB, 1)) MB" }
            Write-Host ("  [UP-TO-DATE] {0,-35} ({1})" -f $DisplayName, $szStr) -ForegroundColor DarkGray
            return
        }
    }

    $totalBytes = $src.Length
    $totalMB = [math]::Round($totalBytes / 1MB, 1)
    $totalGB = [math]::Round($totalBytes / 1GB, 2)
    $isGB = $totalBytes -gt 1GB
    $sizeLabel = if ($isGB) { "$totalGB GB" } else { "$totalMB MB" }

    Write-Host ("  [COPYING]    {0,-35} ({1})" -f $DisplayName, $sizeLabel) -ForegroundColor Cyan

    $bufSize = 8 * 1024 * 1024 # 8 MB buffer for max USB read speed
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

            $now = [DateTime]::UtcNow
            if (($now - $lastUpdate).TotalMilliseconds -ge 200 -or $copied -eq $totalBytes) {
                $lastUpdate = $now
                $pct = [math]::Min(100, [math]::Round(($copied / $totalBytes) * 100))
                $elapsedSec = [math]::Max($sw.Elapsed.TotalSeconds, 0.05)
                $speedMB = [math]::Round(($copied / 1MB) / $elapsedSec, 1)

                $barLength = 22
                $filled = [int](($pct / 100) * $barLength)
                $empty = [math]::Max(0, $barLength - $filled)
                $bar = ("=" * $filled) + (">" * [int]($filled -lt $barLength)) + (" " * [math]::Max(0, $empty - 1))
                if ($filled -eq $barLength) { $bar = "=" * $barLength }

                if ($isGB) {
                    $curGB = [math]::Round($copied / 1GB, 2)
                    $line = ("`r    [{0}] {1,3}% | {2,4} / {3} GB | {4,5} MB/s" -f $bar, $pct, $curGB, $totalGB, $speedMB)
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

# 4. Copy Protected ZIP archive to Drive C:
if (-not (Test-Path -LiteralPath $TargetFolder)) {
    New-Item -ItemType Directory -Force -Path $TargetFolder | Out-Null
}
$tempZipPath = Join-Path $TargetFolder '_setup_temp.zip'
Write-Host "`n[Step 1/4] Copying protected archive from USB to Drive C:..." -ForegroundColor Yellow
Copy-StreamWithProgress $sourceZip $tempZipPath "Protected Package (ZIP)"

# 5. Extract ZIP archive to C:\mada-rag
Write-Host "`n[Step 2/4] Extracting application files on Drive C:..." -ForegroundColor Yellow
$extractSw = [Diagnostics.Stopwatch]::StartNew()
[System.Reflection.Assembly]::LoadWithPartialName("System.IO.Compression.FileSystem") | Out-Null

$zipArchive = [System.IO.Compression.ZipFile]::OpenRead($tempZipPath)
try {
    $totalEntries = $zipArchive.Entries.Count
    $extractedCount = 0
    foreach ($entry in $zipArchive.Entries) {
        $rel = $entry.FullName
        if ($rel.StartsWith('mada-rag/', [System.StringComparison]::OrdinalIgnoreCase) -or $rel.StartsWith('mada-rag\', [System.StringComparison]::OrdinalIgnoreCase)) {
            $rel = $rel.Substring(9)
        }
        if ([string]::IsNullOrWhiteSpace($rel)) { continue }
        $destPath = Join-Path $TargetFolder $rel

        if ([string]::IsNullOrEmpty($entry.Name)) {
            # Directory entry
            if (-not (Test-Path -LiteralPath $destPath)) {
                New-Item -ItemType Directory -Force -Path $destPath | Out-Null
            }
        } else {
            $destDir = Split-Path -Parent $destPath
            if (-not (Test-Path -LiteralPath $destDir)) {
                New-Item -ItemType Directory -Force -Path $destDir | Out-Null
            }
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destPath, $true)
            $extractedCount++
        }
    }
    Write-Host ("  [EXTRACTED]  {0} files extracted in {1:N1}s successfully." -f $extractedCount, $extractSw.Elapsed.TotalSeconds) -ForegroundColor Green
} finally {
    $zipArchive.Dispose()
}

# Clean up temp zip to free disk space immediately
if (Test-Path -LiteralPath $tempZipPath) {
    Remove-Item -LiteralPath $tempZipPath -Force -ErrorAction SilentlyContinue
    Write-Host "  [CLEANUP]    Temporary ZIP package removed from C: to preserve disk space." -ForegroundColor DarkGray
}

# 6. Synchronize AI Model (.gguf)
Write-Host "`n[Step 3/4] Synchronizing AI Model (model.gguf)..." -ForegroundColor Yellow
$usbModelCandidates = @(
    (Join-Path (Split-Path -Qualifier $sourceZip) 'mada-rag\portable\models\model.gguf'),
    (Join-Path (Split-Path -Qualifier $sourceZip) 'portable\models\model.gguf'),
    'H:\mada-rag\portable\models\model.gguf',
    'D:\jan\llamacpp\models\Jan-v3.5-4B-Q4_K_XL\model.gguf'
)

$srcModel = ''
foreach ($mCand in $usbModelCandidates) {
    if (Test-Path -LiteralPath $mCand) {
        $srcModel = $mCand
        break
    }
}

$destModel = Join-Path $TargetFolder 'portable\models\model.gguf'
if ($srcModel) {
    Copy-StreamWithProgress $srcModel $destModel "AI Model: $(Split-Path -Leaf $srcModel)"
} else {
    Write-Host "  [NOTICE] Model file not found on USB. If you have a .gguf model, place it in: $TargetFolder\portable\models\" -ForegroundColor Yellow
}

# 7. Configure model_config.json on C:
$configPath = Join-Path $TargetFolder 'model_config.json'
@{
    spec = "auto"
    exe = "portable\llama\llama-server.exe"
    model = "portable\models\model.gguf"
} | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding ASCII
Write-Host "  [CONFIG]     model_config.json verified on C:." -ForegroundColor Green

# 8. Create Desktop Shortcut for one-click access
Write-Host "`n[Step 4/4] Creating Desktop Shortcut..." -ForegroundColor Yellow
try {
    $wsh = New-Object -ComObject WScript.Shell
    $desktopPath = [Environment]::GetFolderPath('Desktop')
    $shortcutPath = Join-Path $desktopPath 'مذكّرتي الذكية Mada-RAG.lnk'
    $shortcut = $wsh.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = (Join-Path $TargetFolder 'run-mada-rag.bat')
    $shortcut.WorkingDirectory = $TargetFolder
    $shortcut.Description = 'Mada-RAG Assistant (Offline Portable AI)'
    
    $exePath = Join-Path $TargetFolder 'mada-rag-server.exe'
    if (Test-Path -LiteralPath $exePath) {
        $shortcut.IconLocation = "$exePath,0"
    }
    $shortcut.Save()
    Write-Host "  [SHORTCUT]   Shortcut created on Desktop: 'مساعد مدى الذكي Mada-RAG'" -ForegroundColor Green
} catch {
    Write-Host "  [NOTICE] Could not create desktop shortcut automatically." -ForegroundColor DarkGray
}

# 9. Completion Summary
$totalElapsed = $totalStopwatch.Elapsed
$totMin = [int]$totalElapsed.TotalMinutes
$totSec = $totalElapsed.Seconds
$timeStr = if ($totMin -ge 1) {
    "$totMin min $totSec sec"
} else {
    "$([math]::Round($totalElapsed.TotalSeconds, 1)) seconds"
}

Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host "  SUCCESS: Mada-RAG is fully installed on Drive C: and ready!         " -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ("  Target Directory: {0}" -f $TargetFolder) -ForegroundColor Cyan
Write-Host ("  Total Time:       {0}" -f $timeStr) -ForegroundColor Green
Write-Host ("  To Launch:        Double-click the shortcut on your Desktop or run:") -ForegroundColor Yellow
Write-Host ("                    {0}\run-mada-rag.bat" -f $TargetFolder) -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Green

if ($LaunchImmediately) {
    Write-Host "`nLaunching Mada-RAG now..." -ForegroundColor Cyan
    Start-Process -FilePath (Join-Path $TargetFolder 'run-mada-rag.bat') -WorkingDirectory $TargetFolder
}
