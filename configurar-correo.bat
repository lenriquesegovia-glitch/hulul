@echo off
title HULUL - Configurar correo
cd /d "%~dp0"
echo.
echo  Paso 1: inicia sesion en Firebase con lenriquesegovia@gmail.com
echo  (se abrira el navegador).
echo.
call npx.cmd -y firebase-tools@15 login
echo.
echo  Paso 2: pega la contrasena de aplicacion de Gmail (16 letras, sin espacios)
echo  y pulsa Enter. No se vera mientras la escribes; es normal.
echo.
call npx.cmd -y firebase-tools@15 functions:secrets:set SMTP_PASSWORD --project hulul-59081
echo.
echo  Listo. Ahora ejecuta publicar-firebase.bat
pause
