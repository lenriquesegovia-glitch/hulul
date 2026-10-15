@echo off
title HULUL - Configurar correo
cd /d "%~dp0"
echo.
echo  Paso 1: inicia sesion en Firebase con lenriquesegovia@gmail.com
echo  (la cuenta duena del proyecto HULUL). Se abrira el navegador.
echo.
call npx.cmd -y firebase-tools@15 logout
call npx.cmd -y firebase-tools@15 login
if errorlevel 1 goto error
echo.
echo  Paso 2: pega la clave de Resend (empieza con re_) y pulsa Enter.
echo  No se vera mientras la pegas; es normal.
echo.
call npx.cmd -y firebase-tools@15 functions:secrets:set MAIL_PASSWORD --project hulul-59081
if errorlevel 1 goto error
echo.
echo  Listo. Ahora ejecuta publicar-firebase.bat
pause
exit /b 0

:error
echo.
echo  Algo fallo. Manda una captura de esta ventana.
pause
exit /b 1
