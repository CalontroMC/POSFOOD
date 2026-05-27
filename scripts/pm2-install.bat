@echo off
REM ติดตั้ง PM2 + Windows startup hook (รันครั้งเดียว)
cd /d "%~dp0\.."

call npm install -g pm2 pm2-windows-startup
if errorlevel 1 exit /b 1

call pm2-startup install
echo.
echo เสร็จ ใช้:  pm2 start ecosystem.config.cjs  ^&^&  pm2 save
