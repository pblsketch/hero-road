# manifest에서 아직 없는 그림을 다시 생성한다. 계정 한도 등으로 실패하면 기다렸다가 다시 시도한다.
# 사용: powershell -File tools\genretry.ps1 [-Manifest tools\manifest.tsv] [-Tries 18] [-WaitMin 10]
param([string]$Manifest = "", [int]$Tries = 18, [int]$WaitMin = 10, [int]$Parallel = 3)
$root = Split-Path $PSScriptRoot
if (-not $Manifest) { $Manifest = Join-Path $root "tools\manifest.tsv" }
function Missing {
  Get-Content -LiteralPath $Manifest -Encoding UTF8 | Where-Object { $_.Trim() -ne "" -and -not $_.StartsWith("#") } |
    ForEach-Object { $_.Split("`t")[0] } | Where-Object { -not (Test-Path (Join-Path $root "assets\raw\$_.png")) }
}
for ($i = 1; $i -le $Tries; $i++) {
  $miss = @(Missing)
  "$(Get-Date -Format HH:mm:ss) try $i : missing $($miss.Count)"
  if ($miss.Count -eq 0) { break }
  # 먼저 한 장으로 되는지 본다(안 되면 기다림)
  & powershell -NoProfile -ExecutionPolicy Bypass -File "$root\tools\genqueue.ps1" -Manifest $Manifest -Parallel 1 -SkipExisting -Only $miss[0] | Select-Object -Last 2
  if (Test-Path (Join-Path $root "assets\raw\$($miss[0]).png")) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File "$root\tools\genqueue.ps1" -Manifest $Manifest -Parallel $Parallel -SkipExisting | Select-Object -Last 40
  } else { Start-Sleep -Seconds ($WaitMin * 60) }
}
"remaining: " + (@(Missing) -join ",")
