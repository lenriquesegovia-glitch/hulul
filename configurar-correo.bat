@echo off
title HULUL - Configurar correo
cd /d "%~dp0"
echo.
echo  Paso 1: inicia sesion en Firebase con la cuenta duena del proyecto
echo  (se abrira el navegador).
echo.
call npx.cmd -y firebase-tools@15 login
echo.
echo  Paso 2: pega la contrasena de aplicacion del Gmail de HULUL
echo  (16 letras, sin espacios) y pulsa Enter.
echo  No se vera mientras la pegas; es normal.
echo.
call npx.cmd -y firebase-tools@15 functions:secrets:set MAIL_PASSWORD --project hulul-59081
echo.
echo  Listo. Ahora ejecuta publicar-firebase.bat
pause
