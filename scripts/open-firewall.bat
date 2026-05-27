@echo off
REM ============================================================
REM  FoodPOS — เปิด Windows Firewall ให้พอร์ต 3000 รับ inbound
REM  ต้องคลิกขวา → Run as administrator
REM ============================================================

net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo.
    echo *** ต้องคลิกขวาที่ไฟล์นี้ ^> เลือก "Run as administrator" ***
    echo.
    pause
    exit /b 1
)

echo Adding firewall rule "FoodPOS Server (3000)" ...
powershell -NoProfile -Command "if (-not (Get-NetFirewallRule -DisplayName 'FoodPOS Server (3000)' -ErrorAction SilentlyContinue)) { New-NetFirewallRule -DisplayName 'FoodPOS Server (3000)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Profile Any -Enabled True | Out-Null; 'Added.' } else { 'Already exists.' }"

echo.
echo เสร็จเรียบร้อย — ตอนนี้มือถือใน WiFi เดียวกันเข้า http://192.168.1.100:3000 ได้แล้ว
echo (ถ้า IP เครื่องเปลี่ยน แก้ที่ .env: PUBLIC_BASE_URL)
echo.
pause
