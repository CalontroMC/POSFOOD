@echo off
REM เริ่ม Cloudflare Quick Tunnel (ไม่ต้องมี account)
REM Public URL จะแสดงบนหน้าจอ ใช้ URL นั้นเปิดในมือถือได้เลย

where cloudflared >nul 2>nul
if errorlevel 1 (
  echo cloudflared not found in PATH
  echo Download: https://github.com/cloudflare/cloudflared/releases/latest
  echo หรือ: winget install --id Cloudflare.cloudflared
  pause
  exit /b 1
)

echo.
echo === Starting Cloudflare Quick Tunnel  ^>^>^> localhost:3000 ===
echo URL จะปรากฏด้านล่าง: https://xxx-xxx.trycloudflare.com
echo อย่าลืม:
echo   1. คัดลอก URL ไปใส่ใน .env  PUBLIC_BASE_URL=https://xxx-xxx.trycloudflare.com
echo   2. รีสตาร์ท server เพื่อให้ QR Code ใช้ URL ใหม่
echo.

cloudflared tunnel --url http://localhost:3000
