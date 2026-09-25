# ======================================================================
# Create Desktop Shortcut for Mada-RAG USB Assistant
# ======================================================================
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath 'مساعد مدى الذكي.lnk'

# Find mada-rag folder relative to this script
$madaDir = ''
if (Test-Path (Join-Path $PSScriptRoot 'mada-rag\run-mada-rag.bat')) {
    $madaDir = Join-Path $PSScriptRoot 'mada-rag'
} elseif (Test-Path (Join-Path $PSScriptRoot 'run-mada-rag.bat')) {
    $madaDir = $PSScriptRoot
} else {
    # Check H:\ or common drives
    foreach ($let in (Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root)) {
        $cand = Join-Path $let 'mada-rag'
        if (Test-Path (Join-Path $cand 'run-mada-rag.bat')) {
            $madaDir = $cand
            break
        }
    }
}

if (-not $madaDir) {
    throw "تعذر العثور على مجلد mada-rag. يرجى التأكد من تشغيل السكربت من الفلاشة."
}

$launcher = Join-Path $madaDir 'run-mada-rag.bat'
$icon = Join-Path $madaDir 'mada-rag-server.exe'

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $launcher
$Shortcut.WorkingDirectory = $madaDir
$Shortcut.IconLocation = "$icon,0"
$Shortcut.Description = 'تشغيل مساعد مدى الذكي المحلي من الفلاشة'
$Shortcut.Save()

Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  تم إنشاء اختصار التطبيق بنجاح على سطح المكتب (Desktop)!" -ForegroundColor Green
Write-Host "  اسم الاختصار: [مساعد مدى الذكي]" -ForegroundColor Cyan
Write-Host "  الآن يمكنك تشغيل التطبيق مباشرة من سطح المكتب بمجرد تركيب الفلاشة." -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Green
