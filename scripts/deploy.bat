@echo off
REM Build + (re)start ภายใต้ PM2  ใช้ตอนอัพเดตโค้ดแล้ว deploy ใหม่
cd /d "%~dp0\.."

echo === 1/3  npm install (lockfile-based) ===
call npm ci --omit=dev || call npm install

echo === 2/3  build frontend ===
call npm run build

echo === 3/3  reload PM2 ===
call pm2 reload ecosystem.config.cjs || call pm2 start ecosystem.config.cjs
call pm2 save

echo.
echo เสร็จเรียบร้อย  ดูสถานะ:  pm2 status
echo ดู log live:               pm2 logs foodpos
echo ดู tunnel log:             pm2 logs foodpos-tunnel
