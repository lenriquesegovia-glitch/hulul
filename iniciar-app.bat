@echo off
title HULUL - App
cd /d "%~dp0"
echo.
echo  Iniciando la app de HULUL...
echo  Escanea el codigo QR con la camara del iPhone o con Expo Go.
echo  No cierres esta ventana mientras uses la app.
echo.
call npm.cmd run app
pause
