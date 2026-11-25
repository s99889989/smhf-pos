@echo off
rem Build smhf-print-agent.exe with the C# compiler that ships with .NET Framework 4.0 (XP .. Win11)
set CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe
if not exist "%CSC%" (
  echo .NET Framework 4.0 not found. Please install .NET Framework 4.0 first.
  pause
  exit /b 1
)
cd /d "%~dp0"
"%CSC%" /nologo /target:winexe /codepage:65001 /r:System.Web.Extensions.dll /r:System.Drawing.dll /out:smhf-print-agent.exe PrintAgent.cs
if errorlevel 1 ( pause & exit /b 1 )
echo OK: smhf-print-agent.exe
pause
