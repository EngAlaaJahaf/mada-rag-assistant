# ======================================================================
# Mada-RAG - Flash Drive Rescue & Malware Cleanup Tool
# ======================================================================
param(
    [string]$Drive = ''
)

$ErrorActionPreference = 'Continue'
if (-not $Drive) {
    $Drive = (Split-Path -Qualifier $PSScriptRoot)
    if (-not $Drive) { $Drive = 'H:' }
}
$Drive = $Drive.TrimEnd('\').Trim()

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "          Mada-RAG Assistant - USB Rescue & Virus Cleaner             " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

if (-not (Test-Path -LiteralPath "$Drive\")) {
    Write-Host "[ERROR] Drive $Drive is not connected or accessible." -ForegroundColor Red
    exit 1
}

Write-Host "[1/5] Checking for hidden virus staging folder (__)..." -ForegroundColor Yellow
$hiddenFolder = Join-Path "$Drive\" "__"
if (Test-Path -LiteralPath $hiddenFolder) {
    Write-Host "  Found virus container: $hiddenFolder" -ForegroundColor Magenta
    Write-Host "  Restoring original files to root of $Drive\..." -ForegroundColor Cyan
    
    # Remove system and hidden attributes from container first
    attrib -s -h -r "$hiddenFolder" /d
    
    Get-ChildItem -LiteralPath $hiddenFolder -Force | ForEach-Object {
        $dest = Join-Path "$Drive\" $_.Name
        if (-not (Test-Path -LiteralPath $dest)) {
            Move-Item -LiteralPath $_.FullName -Destination $dest -Force
            Write-Host "  [RESTORED] $($_.Name)" -ForegroundColor Green
        } else {
            # If folder already exists, merge
            if ($_.PSIsContainer) {
                Copy-Item -LiteralPath "$($_.FullName)\*" -Destination $dest -Recurse -Force
                Remove-Item -LiteralPath $_.FullName -Recurse -Force
                Write-Host "  [MERGED] $($_.Name)" -ForegroundColor Green
            }
        }
    }
    
    # Remove container if empty or remaining
    attrib -s -h -r "$hiddenFolder" /d
    Remove-Item -LiteralPath $hiddenFolder -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  Virus container (__ ) removed successfully." -ForegroundColor Green
} else {
    Write-Host "  No hidden __ folder found." -ForegroundColor DarkGray
}

Write-Host "`n[2/5] Cleaning malicious shortcut (.lnk) and script files from root..." -ForegroundColor Yellow
Get-ChildItem -LiteralPath "$Drive\" -Filter "*.lnk" -Force | ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Force
    Write-Host "  [DELETED MALICIOUS LNK] $($_.Name)" -ForegroundColor Red
}
Get-ChildItem -LiteralPath "$Drive\" -Filter "*.vbs" -Force | ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Force
    Write-Host "  [DELETED MALICIOUS VBS] $($_.Name)" -ForegroundColor Red
}

Write-Host "`n[3/5] Removing hidden & system attributes from all files and folders..." -ForegroundColor Yellow
cmd.exe /c "attrib -s -h -r $Drive\*.* /s /d"
Write-Host "  Attributes reset successfully." -ForegroundColor Green

Write-Host "`n[4/5] Checking Mada-RAG core executables..." -ForegroundColor Yellow
$madaDir = Join-Path "$Drive\" "mada-rag"
$serverExe = Join-Path $madaDir "mada-rag-server.exe"
$distExe = Join-Path $PSScriptRoot "dist\mada-rag-server.exe"

if (-not (Test-Path -LiteralPath $serverExe) -and (Test-Path -LiteralPath $distExe)) {
    Write-Host "  [RESTORE] Copying latest mada-rag-server.exe to USB..." -ForegroundColor Cyan
    Copy-Item -LiteralPath $distExe -Destination $serverExe -Force
    Write-Host "  [OK] mada-rag-server.exe restored." -ForegroundColor Green
} else {
    Write-Host "  mada-rag-server.exe is present." -ForegroundColor Green
}

$llamaExe = Join-Path $madaDir "portable\llama\llama-server.exe"
$janLlamaExe = "D:\jan\llamacpp\backends\b9967\win-avx-cuda-cu12.0-x64\build\bin\llama-server.exe"
if (-not (Test-Path -LiteralPath $llamaExe) -and (Test-Path -LiteralPath $janLlamaExe)) {
    Write-Host "  [RESTORE] Copying llama-server.exe to USB..." -ForegroundColor Cyan
    Copy-Item -LiteralPath $janLlamaExe -Destination $llamaExe -Force
    Write-Host "  [OK] llama-server.exe restored." -ForegroundColor Green
} else {
    Write-Host "  llama-server.exe is present." -ForegroundColor Green
}

Write-Host "`n[5/5] Flash drive rescue completed successfully!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
