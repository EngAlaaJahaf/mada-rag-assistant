# ============================================================
#  mada-usb-run.ps1   (PURE ASCII - runs on ANY PC / codepage)
#  ------------------------------------------------------------
#  ONE script for the flash root that does EVERYTHING:
#
#    1) AUTO-DISCOVERS the flash letter (no -Flash, no manual
#       drive letter): it scans A:..Z: for the standalone layout
#       -> found wherever it ends up (H:, G:, or any letter).
#
#    2) SILENTLY copies the ENTIRE standalone app from the flash
#       to the local C: drive:
#           C:\mada-rag\                       (the whole app)
#           C:\mada-rag\portable\llama\        (llama-server.exe + all CUDA DLLs)
#           C:\mada-rag\portable\models\model.gguf
#
#    3) COPIES A RUN LAUNCHER TO THE DESKTOP (what you asked):
#           %USERPROFILE%\Desktop\run-mada-rag.bat
#       Double-clicking it on the target PC starts the app from
#       C:\ with exactly ONE click (opens the browser tab too).
#
#  No installs, no config editing, no python packages to fetch:
#  server.py auto-detects the portable\ folder next to it.
#
#  Usage on the target PC (run it FROM the flash root):
#      <flash>:\>  powershell -NoProfile -ExecutionPolicy Bypass -File mada-usb-run.ps1
#  Then on the desktop just DOUBLE-CLICK:  run-mada-rag.bat
# ============================================================

param(
    [string]$DestRoot = "C:\mada-rag"
)
$ErrorActionPreference = "Stop"

# ---- 1) auto-discover the flash letter holding the app ----
$srcApp = $null
foreach ($ch in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.ToCharArray()) {
    $root = "$ch`:"
    if (-not (Test-Path $root)) { continue }
    $cand = Join-Path $root "mada-rag"
    if (-not (Test-Path (Join-Path $cand "server.py")))                       { continue }
    if (-not (Test-Path (Join-Path $cand "portable\llama\llama-server.exe"))) { continue }
    if (-not (Test-Path (Join-Path $cand "portable\models\model.gguf")))      { continue }
    $srcApp = $cand
    break
}
if (-not $srcApp) { Write-Output "NO-FLASH-APP-FOUND"; exit 1 }

$srcLlama   = Join-Path $srcApp "portable\llama"
$srcModels  = Join-Path $srcApp "portable\models"
$srcModel   = Join-Path $srcModels "model.gguf"
$destLlama  = Join-Path $DestRoot "portable\llama"
$destModels = Join-Path $DestRoot "portable\models"

# ---- 2) silent copy (APP, then llama bin, then model) ----
robocopy $srcApp $DestRoot /E /MT:16 `
    /XD ".git" "uploads" "index_data" "venv" ".venv" "venv2" "__pycache__" `
    /XF "*.db" "*.log" "*.bak" /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
if ($LASTEXITCODE -ge 8) { Write-Output "FAIL-ROBO-APP $LASTEXITCODE"; exit 1 }

New-Item -ItemType Directory -Force -Path $destLlama,$destModels | Out-Null
robocopy $srcLlama  $destLlama /E /MT:16 /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
if ($LASTEXITCODE -ge 8) { Write-Output "FAIL-ROBO-LLAMA $LASTEXITCODE"; exit 1 }
Copy-Item -LiteralPath $srcModel -Destination (Join-Path $destModels "model.gguf") -Force

# ---- 3) run launcher -> Desktop (SOLID ASCII bat) ----
$bat = @"
@echo off
title mada-rag (local C:)  RAG chat
cd /d C:\mada-rag
start "" http://127.0.0.1:8787/chat
python -X utf8 server.py
pause
"@
$desktop = [Environment]::GetFolderPath("Desktop")
if (-not $desktop) { $desktop = Join-Path $env:USERPROFILE "Desktop" }
$batDest = Join-Path $desktop "run-mada-rag.bat"
[System.IO.File]::WriteAllText($batDest, $bat, (New-Object System.Text.ASCIIEncoding))

# ---- 4) verify (silent, single final line) ----
$req = @(
    (Join-Path $DestRoot "server.py"),
    (Join-Path $destLlama "llama-server.exe"),
    (Join-Path $destLlama "ggml-cuda.dll"),
    (Join-Path $destLlama "cublas64_12.dll"),
    (Join-Path $destLlama "cublasLt64_12.dll"),
    (Join-Path $destLlama "cudart64_12.dll"),
    (Join-Path $destModels "model.gguf")
)
foreach ($f in $req) { if (-not (Test-Path $f)) { Write-Output "MISSING $f"; exit 1 } }
if (-not (Test-Path $batDest)) { Write-Output "MISSING-DESKTOP-BAT"; exit 1 }
$size = (Get-ChildItem $DestRoot -Recurse -File | Measure-Object Length -Sum).Sum
Write-Output ("BACKUP+DESKTOP-OK {0:N2}GB -> {1} | launcher: {2}" -f ($size/1GB), $DestRoot, $batDest)