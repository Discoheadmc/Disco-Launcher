$ErrorActionPreference = 'SilentlyContinue'
$p = Get-Process 'Disco Launcher'
$t0 = ($p | Measure-Object CPU -Sum).Sum
Start-Sleep -Seconds 10
$p.Refresh()
$t1 = ($p | Measure-Object CPU -Sum).Sum
$ws = ($p | Measure-Object WorkingSet64 -Sum).Sum / 1MB
$cores = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
$cpu = (($t1 - $t0) / 10 / $cores) * 100
Write-Output ('idleCPU=' + [math]::Round($cpu, 2) + '% idleRAM=' + [math]::Round($ws, 1) + 'MB cores=' + $cores)
