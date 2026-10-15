@echo off
title HULUL - Publicar en Firebase
cd /d "%~dp0"
echo.
echo  Publicando las reglas de seguridad y los avisos por correo en Firebase...
echo  La primera vez te preguntara:
echo    SMTP_USER  = el Gmail que envia los correos
echo    NOTIFY_TO  = el correo donde quieres recibir los avisos
echo.
call npm.cmd install --prefix functions --no-audit --no-fund
call npx.cmd -y firebase-tools@15 deploy --only firestore:rules,functions --project hulul-59081
echo.
pause
