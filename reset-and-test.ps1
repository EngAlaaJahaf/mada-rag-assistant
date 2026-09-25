# ─ اختبار حاسم: نسخة واحدة فقط = هل يبقى محرك واحد ورد سريع بلا 400؟
$ErrorActionPreference = 'SilentlyContinue'

function Stop-All-Of($filterName) {
  Get-CimInstance Win32_Process | Where-Object { $_.Name -like $filterName } |
    ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
}

Write-Host "== [1] إيقاف كل نسخ التطبيق والمحرك ==" -ForegroundColor Cyan
Stop-All-Of 'mada-rag-server.exe'
Stop-All-Of 'llama-server*'
Stop-All-Of 'pythonw.exe'
Start-Sleep -Seconds 3
$left = @(Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('mada-rag-server.exe','llama-server.exe','pythonw.exe') })
"  المتبقّي بعد الإيقاف: {0}" -f $left.Count

Write-Host "`n== [2] مسح ملفات القفل القديمة ==" -ForegroundColor Cyan
$lockFiles = @('H:\mada-rag\.bgagepid','H:\mada-rag\.bgagepid.lock','H:\mada-rag\server.pid','H:\mada-rag\.bgagepid.watchdog')
foreach ($lf in $lockFiles) {
  if (Test-Path -LiteralPath $lf) { Remove-Item -LiteralPath $lf -Force -ErrorAction SilentlyContinue; "  حُذف: $lf" }
}
"  (وضع التفسير: ملفات القفل القديمة تجعل وحدة الحراسة تظن وكيلاً ميتاً فتُشغّل مكررات)"

Write-Host "`n== [3] تشغيل نسخة واحدة فقط من الفلاشة ==" -ForegroundColor Cyan
$exe = 'H:\mada-rag\mada-rag-server.exe'
if (Test-Path -LiteralPath $exe) {
  $p = Start-Process -FilePath $exe -WorkingDirectory 'H:\mada-rag' -PassThru
  "  أُطلقت نسخة واحدة، PID={0}" -f $p.Id
} else {
  "  خطأ: التنفيذي غير موجود في $exe"
  exit 1
}

Write-Host "`n== [4] انتظار 10 ثوانٍ ثم العدّ (المطلوب: 1 محرك فقط + لا مكررات) ==" -ForegroundColor Cyan
Start-Sleep -Seconds 10
$now = @(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'mada-rag-server.exe' })
"  عدد mada-rag-server.exe الآن: {0}" -f $now.Count
$now | Select-Object ProcessId, ExecutablePath | Format-Table -AutoSize

Write-Host "`n== [5] فحص المنافذ ==" -ForegroundColor Cyan
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in 8787,8081 } |
  ForEach-Object {
    $owner = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)").Name
    "  {0}:{1}  <-  {2} ({3})" -f $_.LocalAddress, $_.LocalPort, $_.OwningProcess, $owner
  }

Write-Host "`n== [6] قياس استجابة المحرك (طلب صغير) ==" -ForegroundColor Cyan
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
  $body = @{ model='mada'; messages=@(@{role='user'; content='مرحبا'}) } | ConvertTo-Json -Depth 5
  $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8081/v1/chat/completions' -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 120 -UseBasicParsing
  $sw.Stop()
  "  استجابة المحرك خلال {0:N1} ثانية — HTTP {1}" -f $sw.Elapsed.TotalSeconds, $r.StatusCode
} catch {
  $sw.Stop()
  "  فشل طلب المحرك بعد {0:N1} ثانية: {1}" -f $sw.Elapsed.TotalSeconds, $_.Exception.Message
}

Write-Host "`n== [7] طلب HTTP 400 للتحقق من التوليد الفعلي ==" -ForegroundColor Cyan
$sw2 = [System.Diagnostics.Stopwatch]::StartNew()
try {
  $r2 = Invoke-WebRequest -Uri 'http://127.0.0.1:8787/api/chat' -Method Post -Body (@{message='مرحبا'} | ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 120 -UseBasicParsing
  $sw2.Stop()
  "  رد الخادم خلال {0:N1} ثانية — HTTP {1}" -f $sw2.Elapsed.TotalSeconds, $r2.StatusCode
} catch {
  $sw2.Stop()
  "  فشل طلب الخادم بعد {0:N1} ثانية: {1}" -f $sw2.Elapsed.TotalSeconds, $_.Exception.Message
  if ($_.Exception.Response) { $resp = $_.Exception.Response.StatusCode.value__; "     (رمز HTTP: $resp)" }
}

"`n== انتهى — قرّرت بنفسك من النتائج =="
