@echo off
title HULUL - Actualizar
cd /d "%~dp0"
echo.
echo  Descargando la ultima version de HULUL desde GitHub...
echo.
git pull
echo.
echo  Instalando dependencias nuevas, si las hay...
echo.
call npm.cmd install --no-audit --no-fund
echo.
echo  Listo. Ya puedes abrir iniciar-web.bat o iniciar-app.bat.
pause
