@echo off
rem Doble clic: busca el juego (Steam, GOG, carpetas Games) y pregunta. O arrastra la carpeta del juego encima.
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -GamePath "%~1"
)
pause
