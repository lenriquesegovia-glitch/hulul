@echo off
title HULUL - App
cd /d "%~dp0"
echo.
echo  Iniciando la app de HULUL (modo tunel)...
echo  Escanea el codigo QR con Expo Go o con la camara del iPhone.
echo  No cierres esta ventana mientras uses la app.
echo.
call npm.cmd run app -- --tunnel
pause
