@echo off
REM ไฟล์นี้ถูกเรียกโดย Task Scheduler ตอน Windows login
REM ห้ามรีเนม / ห้ามย้าย ถ้าย้ายแล้ว task scheduler หาไม่เจอ
cd /d "%~dp0\.."

REM Ensure logs dir exists
if not exist "logs" mkdir "logs"

REM Marker log so we can see when the task fires (helpful for debugging boot-time failures)
echo [%date% %time%] task fired, cwd=%CD%, USER=%USERNAME% >> "logs\task-trigger.log"

REM Find node.exe — prefer absolute paths so we don't depend on PATH being loaded at logon
set "NODE_EXE="
if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
if not defined NODE_EXE if exist "C:\Program Files (x86)\nodejs\node.exe" set "NODE_EXE=C:\Program Files (x86)\nodejs\node.exe"
if not defined NODE_EXE (
    where node.exe >nul 2>&1
    if not errorlevel 1 set "NODE_EXE=node.exe"
)

if not defined NODE_EXE (
    echo [%date% %time%] ERROR: node.exe not found anywhere >> "logs\task-trigger.log"
    exit /b 2
)

echo [%date% %time%] using node: %NODE_EXE% >> "logs\task-trigger.log"
set NODE_ENV=production
"%NODE_EXE%" server\index.js >> "logs\server.out.log" 2>>&1
echo [%date% %time%] node exited with code %ERRORLEVEL% >> "logs\task-trigger.log"
