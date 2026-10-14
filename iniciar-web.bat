@echo off
title HULUL - Web
cd /d "%~dp0"
echo.
echo  Iniciando la web de HULUL...
echo  Cuando aparezca "Ready", abre http://localhost:3000 en el navegador.
echo  No cierres esta ventana mientras uses la web.
echo.
call npm.cmd run web
pause
