@echo off
title HULUL - Publicar en Firebase
cd /d "%~dp0"
echo.
echo  Publicando las reglas de seguridad y los avisos por correo en Firebase...
echo  Si te pregunta FROM_EMAIL o NOTIFY_TO, pulsa Enter para usar
echo  reservas@hululapp.com
echo.
call npm.cmd install --prefix functions --no-audit --no-fund
call npx.cmd -y firebase-tools@15 deploy --only firestore:rules,functions --project hulul-59081
echo.
pause
