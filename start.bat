@echo off
title Vantuz Gateway & Engine
color 0b

echo.
echo    V A N T U Z   A I
echo    -----------------
echo    System Starting...
echo.

:: 1. Vantuz Gateway Başlat (Arka planda)
if exist ".openclaw\gateway.cmd" (
    echo [INFO] Starting Vantuz Gateway...
    start /min "Vantuz Gateway" cmd /c ".openclaw\gateway.cmd"
) else (
    echo [WARN] Gateway logic not found. Skipping...
)

:: 2. Bekle (Gateway'in açılması için)
timeout /t 3 >nul

:: 3. Vantuz Sunucusunu Başlat (Arka planda)
echo [INFO] Starting Vantuz API Server...
start /min "Vantuz Server" node server/app.js

:: 4. CLI Arayüzünü Başlat
echo [INFO] Launching CLI...
timeout /t 2 >nul
node cli.js tui

echo.
echo [INFO] System shutdown.
pause
