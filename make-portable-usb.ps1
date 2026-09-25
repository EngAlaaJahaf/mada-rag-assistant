# =====================================================================
# Direct Fast Sync - النقل السريع المباشر لتطبيق مَدى إلى فلاشة USB
# =====================================================================
param(
    [string]$Flash = '',
    [string]$DestRoot = '',
    [string]$LlamaBinDir = '',
    [string]$ModelFile = ''
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$AppSource = $PSScriptRoot
$Dist = Join-Path $AppSource 'dist'

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "     مساعد مَدى - أداة النقل المباشر السريع إلى الفلاشة    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. التحقق من جاهزية البناء المدمج mada-rag-server.exe
$serverExe = Join-Path $Dist 'mada-rag-server.exe'
if (-not (Test-Path -LiteralPath $serverExe)) {
    throw "الملف التنفيذي غير موجود في مجلد البناء: $serverExe. يرجى بناؤه أولاً."
}

# 2. قراءة إعدادات المحرك والنموذج
$cfgFile = Join-Path $AppSource 'model_config.json'
if (-not (Test-Path -LiteralPath $cfgFile)) {
    throw "ملف الإعدادات غير موجود: $cfgFile"
}
$cfg = Get-Content -LiteralPath $cfgFile -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $LlamaBinDir) { $LlamaBinDir = Split-Path -Parent $cfg.exe }
if (-not $ModelFile) { $ModelFile = $cfg.model }

if (-not (Test-Path -LiteralPath $LlamaBinDir)) {
    throw "مجلد محرك llama.cpp غير موجود: $LlamaBinDir"
}
if (-not (Test-Path -LiteralPath $ModelFile)) {
    throw "ملف النموذج .gguf غير موجود: $ModelFile"
}

# 3. دالة فحص وتحديد الفلاشات المتصلة
function Get-AvailableUsbDrives {
    $list = @()
    # أ) الأقراص الموصولة عبر ناقل USB
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

    # ب) الأقراص المصنفة كـ Removable
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

# 4. طلب تحديد الفلاشة إن لم تُحدد
while ([string]::IsNullOrWhiteSpace($Flash)) {
    $usbTargets = Get-AvailableUsbDrives

    if ($usbTargets.Count -eq 0) {
        Write-Host ""
        Write-Host "⚠️ لم يتم اكتشاف فلاشة USB متصلة حالياً." -ForegroundColor Yellow
        Write-Host "يرجى توصيل الفلاشة الآن بالكمبيوتر ثم الضغط على [Enter] للمتابعة..." -ForegroundColor White -NoNewline
        $null = Read-Host
        $usbTargets = Get-AvailableUsbDrives
        if ($usbTargets.Count -eq 0) {
            # إمكانية إدخال حرف القرص يدوياً لمن لديه فلاشة ذات تصنيف خاص
            Write-Host "يمكنك كتابة حرف الفلاشة يدوياً (مثال: F أو H)، أو اضغط Enter للمحاولة ثانية: " -ForegroundColor Gray -NoNewline
            $manual = Read-Host
            if ($manual -match '^[A-Za-z]') {
                $Flash = ($manual.Trim().Substring(0, 1).ToUpper() + ':')
                break
            }
        }
    }

    if ($usbTargets.Count -eq 1) {
        $Flash = $usbTargets[0].Drive
        Write-Host "تم التعرف تلقائياً على الفلاشة: $Flash ($($usbTargets[0].Label) - متبقي $($usbTargets[0].FreeGB) GB)" -ForegroundColor Green
        break
    } elseif ($usbTargets.Count -gt 1) {
        Write-Host "`nتم العثور على أكثر من وحدة تخزين USB، يرجى اختيار الهدف:" -ForegroundColor Yellow
        for ($i = 0; $i -lt $usbTargets.Count; $i++) {
            $t = $usbTargets[$i]
            Write-Host ("  [{0}] {1}  ({2})  المساحة الحرة: {3} GB" -f ($i + 1), $t.Drive, $t.Label, $t.FreeGB) -ForegroundColor White
        }
        $choice = Read-Host "أدخل رقم الفلاشة المطلوبة (1-$($usbTargets.Count))"
        $num = 0
        if ([int]::TryParse($choice, [ref]$num) -and $num -ge 1 -and $num -le $usbTargets.Count) {
            $Flash = $usbTargets[$num - 1].Drive
            break
        } else {
            Write-Host "اختيار غير صالح، يرجى إعادة المحاولة." -ForegroundColor Red
        }
    }
}

$Flash = $Flash.Trim().TrimEnd('\')
if ($Flash -notmatch '^[A-Za-z]:$') { throw "حرف الفلاشة يجب أن يكون حرف قرص صالح مثل F: أو H:" }
if (-not (Test-Path -LiteralPath ($Flash + '\'))) { throw "تعذر الوصول إلى محرك الأقراص: $Flash" }

if (-not $DestRoot) { $DestRoot = Join-Path ($Flash + '\') 'mada-rag' }
Write-Host "`n📁 مسار التثبيت على الفلاشة: $DestRoot" -ForegroundColor Cyan

# 5. دالة النقل السريع المقارن (Differential Fast Copy)
# تعتمد على مقارنة الحجم وتاريخ التعديل بدلاً من حساب SHA256 البطيء للـ 3 جيجابايت
function Copy-FastFile($SourcePath, $TargetPath, $DisplayName) {
    $parent = Split-Path -Parent $TargetPath
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }

    $src = Get-Item -LiteralPath $SourcePath
    if (Test-Path -LiteralPath $TargetPath) {
        $tgt = Get-Item -LiteralPath $TargetPath
        # إذا كان الحجم متطابقاً للملفات الكبيرة (كالموديل)، نتخطى النسخ فوراً
        if ($src.Length -eq $tgt.Length) {
            if ($src.Length -gt 50MB -or $src.LastWriteTime -le $tgt.LastWriteTime) {
                Write-Host "  ⏩ [موجود مسبقاً] $DisplayName" -ForegroundColor DarkGray
                return
            }
        }
    }

    $sizeStr = if ($src.Length -gt 1GB) { "$([math]::Round($src.Length / 1GB, 2)) GB" } else { "$([math]::Round($src.Length / 1MB, 1)) MB" }
    Write-Host "  ⚡ [جاري النقل] $DisplayName ($sizeStr)..." -ForegroundColor White
    Copy-Item -LiteralPath $SourcePath -Destination $TargetPath -Force
    Write-Host "     تم النقل بنجاح." -ForegroundColor Green
}

# 6. تجهيز المجلد الهدف وتنظيف الملفات البرمجية القديمة غير الضرورية
if (-not (Test-Path -LiteralPath $DestRoot)) {
    New-Item -ItemType Directory -Force -Path $DestRoot | Out-Null
}

Write-Host "`n🚀 بدء النقل المباشر للملفات..." -ForegroundColor Yellow

# أ) الملف التنفيذي المدمج (يحتوي بداخله كافة واجهات HTML و JS و CSS)
Copy-FastFile $serverExe (Join-Path $DestRoot 'mada-rag-server.exe') "الملف التنفيذي المدمج (mada-rag-server.exe)"

# ب) محرك llama.cpp والمكتبات التابعة له (CUDA و AVX)
$runtimeDlls = @('llama-server.exe','llama-server-impl.dll','llama-common.dll',
    'llama.dll','mtmd.dll','ggml.dll','ggml-base.dll','ggml-cpu.dll',
    'ggml-cuda.dll','cublas64_12.dll','cublasLt64_12.dll','cudart64_12.dll')

foreach ($dll in $runtimeDlls) {
    $srcDll = Join-Path $LlamaBinDir $dll
    if (Test-Path -LiteralPath $srcDll) {
        Copy-FastFile $srcDll (Join-Path $DestRoot "portable\llama\$dll") "مكتبة المحرك: $dll"
    }
}

# ج) ملف نموذج الذكاء الاصطناعي الفعلي .gguf
Copy-FastFile $ModelFile (Join-Path $DestRoot 'portable\models\model.gguf') "نموذج الذكاء الاصطناعي (model.gguf)"

# د) ملف الإعدادات بمسارات نسبية وتفعيل الضبط التلقائي
$portableConfig = @{
    spec = "auto"
    exe = "portable\llama\llama-server.exe"
    model = "portable\models\model.gguf"
} | ConvertTo-Json

$portableConfig | Set-Content -LiteralPath (Join-Path $DestRoot 'model_config.json') -Encoding UTF8
Write-Host "  ✅ [تجهيز] ملف إعدادات النموذج (model_config.json)" -ForegroundColor Green

# هـ) سكربت التشغيل run-mada-rag.bat
$launcherContent = @'
@echo off
chcp 65001 >nul
setlocal
title Mada-RAG Portable Assistant
cd /d "%~dp0"
if not exist "runtime-temp" mkdir "runtime-temp"
set "TEMP=%~dp0runtime-temp"
set "TMP=%TEMP%"
echo ============================================================
echo      مساعد مَدى الذكي - النسخة المحمولة (Portable USB)
echo ============================================================
echo.
echo جاري بدء تشغيل السيرفر والمحرك وفتح واجهة المحادثة...
echo.
"%~dp0mada-rag-server.exe" %*
if errorlevel 1 (
  echo.
  echo ❌ حدث خطأ أثناء تشغيل التطبيق. يرجى مراجعة الرسالة أعلاه.
  pause
)
'@
$launcherContent | Set-Content -LiteralPath (Join-Path $DestRoot 'run-mada-rag.bat') -Encoding UTF8
Write-Host "  ✅ [تجهيز] سكربت التشغيل التلقائي (run-mada-rag.bat)" -ForegroundColor Green

# و) ملف الإرشادات والتعليمات PORTABLE-README.txt
$readmeContent = @'
===============================================================================
               دليل تشغيل مساعد مَدى الذكي من الفلاشة (Mada-RAG)
===============================================================================

1. طريقة التشغيل:
   - انقر نقراً مزدوجاً على ملف: run-mada-rag.bat
   - سيقوم السكربت ببدء السيرفر وفتح واجهة المحادثة تلقائياً في متصفحك:
     http://127.0.0.1:8787/chat

2. ⚠️ تنبيه Windows SmartScreen (عند أول تشغيل على جهاز جديد):
   - نظراً لأن التطبيق مفتوح المصدر وحديث، قد تظهر لك نافذة زرقاء من ويندوز تقول:
     "Windows protected your PC"
   - الحل: اضغط على More info (مزيد من المعلومات) ثم Run anyway (تشغيل على أي حال).

3. ⏳ الانتظار لأول سؤال (Warm-up):
   - عند إرسال أول رسالة أو استخدام اختصار المنبثقة، يحتاج المحرك من 2 إلى 5 ثوانٍ
     لتحميل أوزان النموذج إلى الذاكرة، وبعدها تصبح جميع الردود فورية وسريعة جداً.

4. ⌨️ اختصارات المنبثقة السريعة (Quick Popup):
   - Ctrl + Alt + Space: حدد أي نص في أي تطبيق واضغط الاختصار للحصول على رد فوري.
   - Ctrl + Alt + R: إعادة فتح نافذة المنبثقة بآخر رد تم توليده.

5. المميزات:
   - يعمل محلياً 100% بدون إنترنت.
   - لا يتطلب تثبيت بايثون أو أي برامج وسيطة.
   - يتعرف تلقائياً على كروت شاشة NVIDIA (CUDA) أو المعالجات (AVX).
===============================================================================
'@
$readmeContent | Set-Content -LiteralPath (Join-Path $DestRoot 'PORTABLE-README.txt') -Encoding UTF8
Write-Host "  ✅ [تجهيز] ملف الإرشادات (PORTABLE-README.txt)" -ForegroundColor Green

# 7. الملخص النهائي
$totalSize = (Get-ChildItem -LiteralPath $DestRoot -Recurse -File | Measure-Object Length -Sum).Sum
$totalSizeGB = [math]::Round($totalSize / 1GB, 2)
$fileCount = (Get-ChildItem -LiteralPath $DestRoot -Recurse -File | Measure-Object).Count

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "  🎉 اكتمل النقل السريع للفلاشة بنجاح 100%!" -ForegroundColor Green
Write-Host "  📁 المسار: $DestRoot" -ForegroundColor Cyan
Write-Host "  📊 عدد الملفات: $fileCount ملفاً فقط" -ForegroundColor White
Write-Host "  💾 الحجم الإجمالي: $totalSizeGB GB" -ForegroundColor White
Write-Host "  🚀 للتشغيل: افتح الفلاشة وشغل [run-mada-rag.bat]" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green
