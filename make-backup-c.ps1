# ============================================================
#  make-backup-c.ps1   (PURE ASCII - safe on any PS / codepage)
#  ------------------------------------------------------------
#  SILENT backup of the whole mada-rag application + ALL its
#  dependencies to drive C:, used when the USB flash version
#  cannot run on some PC.
#
#  SILENT = zero prompts, zero console spam (robocopy quiet in
#  all 4 steps). Only ONE confirmation line is printed at the
#  very end. Exit codes: 0 ok / 1 failure (nothing on screen).
#
#  Target (same layout server.py auto-detects -> discover_portable_llm):
#    C:\mada-rag\                       (the whole application)
#    C:\mada-rag\portable\llama\        (llama-server.exe + CUDA libs)
#    C:\mada-rag\portable\models\model.gguf
#
#  Run it on any PC as:
#     powershell -NoProfile -ExecutionPolicy Bypass -File make-backup-c.ps1
#  Then run the app with:
#     cd /d C:\mada-rag && python -X utf8 server.py
#     open  http://127.0.0.1:8787/chat
# ============================================================

param(
    [string]$DestRoot = "C:\mada-rag"
)

$ErrorActionPreference = "Stop"

# ---- source layout (read live from the app's own config) ----
$AppSource = "D:\projects\skill-Agents\mada-rag"
$ConfigJson = Join-Path $AppSource "model_config.json"
$cfg  = Get-Content $ConfigJson -Encoding UTF8 -Raw | ConvertFrom-Json
$srcExe   = [string]$cfg.exe
$srcModel = [string]$cfg.model
$srcBin   = Split-Path $srcExe
if (-not (Test-Path $srcExe))   { throw "llama-server.exe missing: $srcExe" }
if (-not (Test-Path $srcModel)) { throw "model missing: $srcModel" }
if (-not (Test-Path "C:\"))     { throw "C: drive unavailable" }

$DestLlama  = Join-Path $DestRoot "portable\llama"
$DestModels = Join-Path $DestRoot "portable\models"

# ---- 1/4 app (silent) ----
robocopy $AppSource $DestRoot /E /MT:16 /XD ".git" "uploads" "index_data" "venv" ".venv" "venv2" "__pycache__" /XF "*.db" "*.log" "*.bak" "*.tmp" /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
if ($LASTEXITCODE -ge 8) { Write-Output "FAIL-ROBOCOPY-APP $LASTEXITCODE"; exit 1 }

# ---- 2/4 llama bin + CUDA libs (silent) ----
New-Item -ItemType Directory -Force -Path $DestLlama,$DestModels | Out-Null
robocopy $srcBin $DestLlama /E /MT:16 /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
if ($LASTEXITCODE -ge 8) { Write-Output "FAIL-ROBOCOPY-BIN $LASTEXITCODE"; exit 1 }

# ---- 3/4 model (silent) ----
Copy-Item -LiteralPath $srcModel -Destination (Join-Path $DestModels "model.gguf") -Force

# ---- 4/4 VERIFY (silent; one quiet outcome line only, machine-readable) ----
$req = [ordered]@{
    "server.py"            = Join-Path $DestRoot "server.py"
    "llama-server.exe"     = Join-Path $DestLlama "llama-server.exe"
    "ggml-cuda.dll"        = Join-Path $DestLlama "ggml-cuda.dll"
    "cublas64_12.dll"      = Join-Path $DestLlama "cublas64_12.dll"
    "cublasLt64_12.dll"    = Join-Path $DestLlama "cublasLt64_12.dll"
    "cudart64_12.dll"      = Join-Path $DestLlama "cudart64_12.dll"
    "model.gguf"           = Join-Path $DestModels "model.gguf"
}
foreach ($k in $req.Keys) {
    if (-not (Test-Path $req[$k])) {
        Write-Output ("FAIL-MISSING {0} <{1}>" -f $k, $req[$k])
        exit 1
    }
}
$size = (Get-ChildItem $DestRoot -Recurse -File | Measure-Object Length -Sum).Sum
Write-Output ("BACKUP-OK {0:N2}GB {1} -> {2}" -f ($size/1GB), (Split-Path $DestRoot -Leaf), $DestRoot)