' VBS wrapper — รัน run-server.bat แบบไม่มี window (intStyle = 0)
' ใช้คู่กับ Task Scheduler: Execute=wscript.exe, Args="...\run-hidden.vbs"
Option Explicit
Dim shell, scriptDir, bat
Set shell = CreateObject("WScript.Shell")
scriptDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\") - 1)
bat = scriptDir & "\run-server.bat"
' intStyle = 0 (hidden), bWaitOnReturn = False
shell.Run """" & bat & """", 0, False
