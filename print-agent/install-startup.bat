@echo off
rem Add smhf-print-agent.exe to the Startup folder (works on XP and Win10) and start it now
cd /d "%~dp0"
set VBS=%TEMP%\smhf-shortcut.vbs
echo Set sh = CreateObject("WScript.Shell") > "%VBS%"
echo Set lnk = sh.CreateShortcut(sh.SpecialFolders("Startup") ^& "\smhf-print-agent.lnk") >> "%VBS%"
echo lnk.TargetPath = "%~dp0smhf-print-agent.exe" >> "%VBS%"
echo lnk.WorkingDirectory = "%~dp0" >> "%VBS%"
echo lnk.Save >> "%VBS%"
cscript //nologo "%VBS%"
del "%VBS%"
start "" "%~dp0smhf-print-agent.exe"
echo Installed. Test: open http://127.0.0.1:17890/status in the browser.
pause
