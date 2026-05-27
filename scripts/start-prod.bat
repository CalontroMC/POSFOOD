@echo off
REM Start FoodPOS in production mode (single Node process)
REM ใช้สำหรับเทสด่วน  ถ้าใช้จริงให้ใช้ PM2 จะดีกว่า

cd /d "%~dp0\.."

if not exist dist (
  echo Building frontend...
  call npm run build
)

set NODE_ENV=production
node server/index.js
