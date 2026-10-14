@echo off
title HULUL - App (modo tunel)
cd /d "%~dp0"
echo.
echo  Iniciando la app de HULUL en modo tunel...
echo  Usalo si el celular no logra conectarse con iniciar-app.bat.
echo  Funciona aunque el celular use otra red o datos moviles.
echo  La primera vez puede pedir instalar "@expo/ngrok": responde Y.
echo.
call npm.cmd run app -- --tunnel
pause
