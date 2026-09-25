# فحص حي للفلاشة: العمليات + المنافذ + زمن المحرك + سجلات
$ErrorActionPreference = 'SilentlyContinue'
$now = Get-Date

Write-Host "==== 1) عمليات الحزمة (مباشرة) ====" -ForegroundColor Cyan
$pk = Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('mada-rag-server.exe','llama-server.exe','llama-server<pid>.exe') }
$pk | Group-Object Name | ForEach-Object { "  {0,-24} {1}" -f $_.Name, $_.Count }

$ordered = $pk | Sort-Object CreationDate
$oldest = $ordered | Select-Object -First 1
$newest = $ordered | Select-Object -Last 1
"  أقدم:  PID {0}  {1}" -f $oldest.ProcessId, $oldest.CreationDate
"  أحدث:  PID {0}  {1}" -f $newest.ProcessId, $newest.CreationDate

Write-Host "`n==== 2) ما يستمع على المنافذ الحساسة (8787/8081/8080) ====" -ForegroundColor Cyan
$ports = 8787, 8081, 8080
$list = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in $ports }
$list | ForEach-Object {
  $nm = (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).Name
  "  {0} : {1}  <-  {2} ({3})" -f $_.LocalAddress, $_.LocalPort, $_.OwningProcess, $nm
}

Write-Host "`n==== 3) الخطوط الأخيرة من سجل المحرك ====" -ForegroundColor Cyan
$log = 'H:\mada-rag\portable\llama\llama-server.log'
if (Test-Path -LiteralPath $log) {
  Get-Content -LiteralPath $log -Tail 20
} else {
  "  لا يوجد: $log"
}

Write-Host "`n==== 4) سجلات التطبيق على الفلاشة ====" -ForegroundColor Cyan
Get-ChildItem -LiteralPath 'H:\mada-rag' -Filter '*.log' -Recurse -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 6 |
  ForEach-Object { "  {0}  ({1} ك.ب)" -f $_.Name, [math]::Round($_.Length/1KB,1) }
