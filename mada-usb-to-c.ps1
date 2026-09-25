# ============================================================
#  mada-usb-to-c.ps1   (PURE ASCII = safe on ANY PC / codepage)
#  ------------------------------------------------------------
#  SILENT "USB -> C:" recovery copy.
#
#  You copy THIS script to the ROOT of the flash drive (next to
#  the "mada-rag" folder), then you can run it from the flash on
#  any machine, and it copies the ENTIRE standalone app FROM the
#  flash TO the local C: drive, so the app keeps working even on
#  PCs where the flash fails / is too slow.
#
#  Because the source is the flash itself ($PSScriptRoot), it does
#  NOT depend on model_config.json or on drive D: - which do not
#  exist on other PCs. It reads the layout next to this script:
#
#     <flash>:\mada-rag\                       (the whole app)
#     <flash>:\mada-rag\portable\llama\        (llama-server.exe + all DLLs)
#     <flash>:\mada-rag\portable\models\model.gguf
#
#  Target on the local PC (same auto-discovered portable layout):
#     C:\mada-rag\...
#
#  Run on any PC (no installs required, silent):
#      cd /d H:\   &&  powershell -NoProfile -ExecutionPolicy Bypass -File mada-usb-to-c.ps1
#  Then:
#      cd /d C:\mada-rag && python -X utf8 server.py
#      open http://127.0.0.1:8787/chat
# ============================================================

param(
    [string]$DestRoot = "C:\mada-rag"
)

$ErrorActionPreference = "Stop"

# --- canonical placeholders (decided once, used everywhere) ----
$LLM_HOST = "127.0.0.1"
$LLM_PORT = 8787
$SrcRoot = $PSScriptRoot
$SrcApp  = "$SrcRoot"
$SrcLlama   = Join-Path $SrcApp "portable\llama"
$SrcModels  = Join-Path $SrcApp "portable\models"
$DestLlama  = Join-Path $DestRoot "portable\llama"
$DestModels = Join-Path $DestRoot "portable\models"

# --- sanity ---
if (-not (Test-Path (Join-Path $SrcApp "server.py")))      { Write-Output "MISS-SERVER.PY";  exit 1 }
if (-not (Test-Path (Join-Path $SrcLlama "llama-server.exe"))) { Write-Output "MISS-LLAMA-EXE"; exit 1 }
if (-not (Test-Path (Join-Path $SrcModels "model.gguf")))       { Write-Output "MISS-MODEL";     exit 1 }

# ---- 1) copy the whole app (silent, threaded) ----
robocopy $SrcApp $DestRoot /E /MT:16 `
    /XD ".git" "uploads" "index_data" "venv" ".venv" "venv2" "__pycache__" `
    /XF "*.db" "*.log" "*.bak" /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
if ($LASTEXITCODE -ge 8) { Write-Output "FAIL-ROBO-APP $LASTEXITCODE"; exit 1 }

# ---- 2) llama bin + CUDA DLLs (silent) ----
robocopy $SrcLlama $DestLlama /E /MT:16 /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
if ($LASTEXITCODE -ge 8) { Write-Output "FAIL-ROBO-LLAMA $LASTEXITCODE"; exit 1 }

# ---- 3) model (silent) ----
New-Item -ItemType Directory -Force -Path $DestModels | Out-Null
Copy-Item -LiteralPath (Join-Path $SrcModels "model.gguf") -Destination (Join-Path $DestModels "model.gguf") -Force

# ---- 4) single silent verification line ----
$req = @(
    (Join-Path $DestRoot "server.py"),
    (Join-Path $DestLlama "llama-server.exe"),
    (Join-Path $DestLlama "ggml-cuda.dll"),
    (Join-Path $DestLlama "cublas64_12.dll"),
    (Join-Path $DestLlama "cublasLt64_12.dll"),
    (Join-Path $DestLlama "cudart64_12.dll"),
    (Join-Path $DestModels "model.gguf")
)
foreach ($f in $req) { if (-not (Test-Path $f)) { Write-Output "MISSING $f"; exit 1 } }
$size = (Get-ChildItem $DestRoot -Recurse -File | Measure-Object Length -Sum).Sum
Write-Output ("BACKUP-OK {0:N2}GB {1}" -f ($size/1GB), $DestRoot)
