# Register a Scheduled Task that runs the database backup daily at 03:00 AM.
# Runs in current-user context, no admin elevation required.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\install-backup.ps1
# Remove: powershell -ExecutionPolicy Bypass -File scripts\install-backup.ps1 -Uninstall

param(
    [switch]$Uninstall
)

$taskName = "FoodPOS Database Backup"
$projectRoot = Split-Path -Parent $PSScriptRoot
$backupScript = Join-Path $projectRoot "scripts\backup.js"

if ($Uninstall) {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "ลบ task สำรองข้อมูลแล้ว: $taskName" -ForegroundColor Green
    } else {
        Write-Host "ไม่พบ task: $taskName" -ForegroundColor Yellow
    }
    exit 0
}

if (-not (Test-Path $backupScript)) {
    Write-Host "ไม่พบไฟล์ $backupScript" -ForegroundColor Red
    exit 1
}

# Resolve node.exe path
$nodeExe = "node.exe"
if (Test-Path "C:\Program Files\nodejs\node.exe") {
    $nodeExe = "C:\Program Files\nodejs\node.exe"
} elseif (Test-Path "C:\Program Files (x86)\nodejs\node.exe") {
    $nodeExe = "C:\Program Files (x86)\nodejs\node.exe"
} else {
    $whereNode = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($whereNode) {
        $nodeExe = $whereNode.Source
    }
}

# Remove existing task if present (so we can re-register cleanly)
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "เอา task สำรองข้อมูลเก่าออก" -ForegroundColor Yellow
}

$action = New-ScheduledTaskAction `
    -Execute $nodeExe `
    -Argument "scripts\backup.js" `
    -WorkingDirectory $projectRoot

# Daily trigger at 3:00 AM
$trigger = New-ScheduledTaskTrigger -Daily -At 3:00AM

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Run daily hot database backup for FoodPOS" | Out-Null

Write-Host ""
Write-Host "✓ ติดตั้ง Task สำรองข้อมูลอัตโนมัติเรียบร้อย" -ForegroundColor Green
Write-Host "  Task name: $taskName"
Write-Host "  Trigger:   ทุกวันเวลา 03:00 น."
Write-Host "  Action:    $nodeExe scripts\backup.js"
Write-Host ""
Write-Host "คำสั่งที่ใช้บ่อย:" -ForegroundColor Cyan
Write-Host "  เริ่มรันทันที: Start-ScheduledTask -TaskName '$taskName'"
Write-Host "  หยุดรัน:      Stop-ScheduledTask -TaskName '$taskName'"
Write-Host "  ดูสถานะ:      Get-ScheduledTask -TaskName '$taskName' | Get-ScheduledTaskInfo"
Write-Host "  ลบออก:        powershell -File scripts\install-backup.ps1 -Uninstall"
Write-Host ""
