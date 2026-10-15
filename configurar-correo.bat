@echo off
title HULUL - Configurar correo
cd /d "%~dp0"
echo.
echo  Paso 1: inicia sesion en Firebase con la cuenta duena del proyecto
echo  (se abrira el navegador).
echo.
call npx.cmd -y firebase-tools@15 login
echo.
echo  Paso 2: pega la clave de Resend (empieza con re_) y pulsa Enter.
echo  No se vera mientras la pegas; es normal.
echo.
call npx.cmd -y firebase-tools@15 functions:secrets:set RESEND_API_KEY --project hulul-59081
echo.
echo  Listo. Ahora ejecuta publicar-firebase.bat
pause
