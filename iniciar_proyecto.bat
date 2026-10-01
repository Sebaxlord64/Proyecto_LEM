@echo off
title Probador Virtual de Corbatas - Proyecto LEM
color 0b
echo ========================================================
echo    PROBADOR VIRTUAL DE CORBATAS NEON (AR 3D)
echo    Proyecto de Legislacion Empresarial
echo ========================================================
echo.
echo Iniciando servidor local y abriendo navegador web...
echo.

cd /d "%~dp0"

where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    python server.py
) else (
    echo Python no encontrado, iniciando con npx serve...
    start http://localhost:8080
    npx -y serve -p 8080 .
)

pause
