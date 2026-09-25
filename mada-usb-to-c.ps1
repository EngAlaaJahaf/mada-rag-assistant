# ======================================================================
# Mada-RAG Assistant - Deploy from USB to Drive C: (Full Copy with Progress)
# ======================================================================
param(
    [string]$DestRoot = 'C:\mada-rag'
)

$ErrorActionPreference = 'Stop'
$totalStopwatch = [Diagnostics.Stopwatch]::StartNew()

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "         Mada-RAG Assistant - Deploy from USB to Drive C:             " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Locate Source Directory (detects whether script is in mada-rag or drive root)
$SrcApp = ''
if (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'mada-rag-server.exe')) {
    $SrcApp = $PSScriptRoot
} elseif (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'mada-rag\mada-rag-server.exe')) {
    $SrcApp = Join-Path $PSScriptRoot 'mada-rag'
} else {
    # Search all removable / USB drive roots for mada-rag\mada-rag-server.exe
    foreach ($let in (Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root)) {
        $cand = Join-Path $let 'mada-rag'
        if (Test-Path -LiteralPath (Join-Path $cand 'mada-rag-server.exe')) {
            $SrcApp = $cand
            break
        }
    }
}

if (-not $SrcApp -or -not (Test-Path -LiteralPath (Join-Path $SrcApp 'mada-rag-server.exe'))) {
    throw "Source mada-rag folder not found. Please ensure this script is run from your USB drive."
}

Write-Host "Source Folder:      $SrcApp" -ForegroundColor Green
Write-Host "Destination Folder: $DestRoot" -ForegroundColor Cyan

# 2. Check Destination Drive C: Free Space
$cDrive = Get-PSDrive -Name 'C' -ErrorAction SilentlyContinue
if ($cDrive) {
    $freeCGB = [math]::Round($cDrive.Free / 1GB, 2)
    Write-Host ("Drive C: Free Space: {0} GB" -f $freeCGB) -ForegroundColor Gray
    if ($freeCGB -lt 4.5) {
        Write-Host "WARNING: Drive C: has less than 4.5 GB free. Space might be tight." -ForegroundColor Yellow
    }
}

if (-not (Test-Path -LiteralPath $DestRoot)) {
    New-Item -ItemType Directory -Force -Path $DestRoot | Out-Null
}

# 3. High-speed copy function with real-time visual progress bar
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

            # Update progress max 5 times per second
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

# 4. Copy ALL files recursively without exception
Write-Host "`nCopying all files from USB to $DestRoot..." -ForegroundColor Yellow

# Get all files in source app directory
$files = Get-ChildItem -LiteralPath $SrcApp -Recurse -File
foreach ($file in $files) {
    # Skip deployment scripts themselves so we don't overwrite running script
    if ($file.Name -in @('mada-usb-to-c.ps1', 'copy-to-c.bat', 'نسخ-إلى-قرص-C.bat')) {
        continue
    }
    $relPath = $file.FullName.Substring($SrcApp.Length).TrimStart('\')
    $targetPath = Join-Path $DestRoot $relPath
    Copy-WithProgress $file.FullName $targetPath $relPath
}

# Ensure model_config.json on C: has correct relative paths
$cConfigPath = Join-Path $DestRoot 'model_config.json'
if (-not (Test-Path -LiteralPath $cConfigPath)) {
    @{
        spec = 'auto'
        exe = 'portable\llama\llama-server.exe'
        model = 'portable\models\model.gguf'
    } | ConvertTo-Json | Set-Content -LiteralPath $cConfigPath -Encoding ASCII
    Write-Host "  [CONFIG]     model_config.json configured on C:." -ForegroundColor Green
}

# 5. Summary and Elapsed Time Calculation
$totalSize = (Get-ChildItem -LiteralPath $DestRoot -Recurse -File | Measure-Object Length -Sum).Sum
$totalSizeGB = [math]::Round($totalSize / 1GB, 2)
$fileCount = (Get-ChildItem -LiteralPath $DestRoot -Recurse -File | Measure-Object).Count
$elapsed = $totalStopwatch.Elapsed
$timeStr = if ($elapsed.TotalMinutes -ge 1) {
    "{0}m {1}s ({2:N1}s total)" -f [int]$elapsed.TotalMinutes, $elapsed.Seconds, $elapsed.TotalSeconds
} else {
    "{0:N1} seconds" -f $elapsed.TotalSeconds
}

Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host "  SUCCESS: Mada-RAG successfully deployed to $DestRoot!               " -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ("  Source Folder: {0}" -f $SrcApp) -ForegroundColor White
Write-Host ("  Target Folder: {0}" -f $DestRoot) -ForegroundColor Cyan
Write-Host ("  Total Files:   {0} files" -f $fileCount) -ForegroundColor White
Write-Host ("  Total Size:    {0} GB" -f $totalSizeGB) -ForegroundColor White
Write-Host ("  Time Elapsed:  {0}" -f $timeStr) -ForegroundColor Green
Write-Host ("  To Run:        Open {0} and launch [run-mada-rag.bat]" -f $DestRoot) -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Green
