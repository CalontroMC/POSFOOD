# Register a Scheduled Task that starts FoodPOS server when the current user logs in.
# Runs in current-user context, no admin elevation required.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\install-autostart.ps1
# Remove: powershell -ExecutionPolicy Bypass -File scripts\install-autostart.ps1 -Uninstall

param(
    [switch]$Uninstall
)

$taskName = "FoodPOS Server (autostart)"
$projectRoot = Split-Path -Parent $PSScriptRoot
$batFile = Join-Path $projectRoot "scripts\run-server.bat"
$vbsFile = Join-Path $projectRoot "scripts\run-hidden.vbs"

if ($Uninstall) {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "ลบ task แล้ว: $taskName" -ForegroundColor Green
    } else {
        Write-Host "ไม่พบ task: $taskName" -ForegroundColor Yellow
    }
    exit 0
}

if (-not (Test-Path $batFile)) {
    Write-Host "ไม่พบไฟล์ $batFile" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $vbsFile)) {
    Write-Host "ไม่พบไฟล์ $vbsFile" -ForegroundColor Red
    exit 1
}

# Remove existing task if present (so we can re-register cleanly)
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "เอา task เก่าออก" -ForegroundColor Yellow
}

# Launch via wscript + VBS so the cmd window stays truly hidden.
# (Hidden=$true in task settings only hides the task in TS UI — not the spawned cmd window.)
$action = New-ScheduledTaskAction `
    -Execute "wscript.exe" `
    -Argument "`"$vbsFile`"" `
    -WorkingDirectory $projectRoot

# Logon trigger + 15s delay so user environment (PATH, drives) is fully loaded
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$trigger.Delay = "PT15S"

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -RestartCount 5 `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -Hidden

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Start FoodPOS Express server on user logon" | Out-Null

Write-Host ""
Write-Host "✓ ติดตั้ง autostart เรียบร้อย" -ForegroundColor Green
Write-Host "  Task name: $taskName"
Write-Host "  Trigger:   ที่ user '$env:USERNAME' login + delay 15 วินาที"
Write-Host "  Action:    $batFile"
Write-Host "  Window:    hidden (no console)"
Write-Host "  Restart:   ทุก 1 นาที สูงสุด 5 ครั้งถ้า crash"
Write-Host ""
Write-Host "Log files:" -ForegroundColor Cyan
Write-Host "  logs\task-trigger.log  — บันทึกว่า task ฟ้องตอนไหน + node อยู่ที่ไหน"
Write-Host "  logs\server.out.log    — stdout/stderr ของ server"
Write-Host ""
Write-Host "คำสั่งที่ใช้บ่อย:" -ForegroundColor Cyan
Write-Host "  เริ่มเลย: Start-ScheduledTask -TaskName '$taskName'"
Write-Host "  หยุด:    Stop-ScheduledTask -TaskName '$taskName'"
Write-Host "  สถานะ:   Get-ScheduledTask -TaskName '$taskName' | Get-ScheduledTaskInfo"
Write-Host "  ลบ:      powershell -File scripts\install-autostart.ps1 -Uninstall"
