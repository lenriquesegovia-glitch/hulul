@echo off
title HULUL - Publicar en Firebase
cd /d "%~dp0"
echo.
echo  Publicando las reglas de seguridad (base de datos y archivos) y los avisos por correo en Firebase...
echo  La primera vez te preguntara:
echo    MAIL_PROVIDER = resend
echo    FROM_EMAIL    = reservas@hululec.com
echo    NOTIFY_TO     = el correo donde quieres recibir los avisos
echo.
rem Bloqueo: solo se publica desde la ultima version de GitHub (main), sin cambios sin guardar
rem y nunca desde la carpeta raiz antigua C:\Users\lsego\Hulul.
call node "%~dp0scripts\verificar-copia.cjs"
if errorlevel 1 (
  pause
  exit /b 1
)
call npm.cmd install --prefix functions --no-audit --no-fund
call npx.cmd -y firebase-tools@15 deploy --only firestore:rules,storage,functions --project hulul-59081
if errorlevel 1 (
  echo.
  echo  Algo fallo. Manda una captura de esta ventana.
)
echo.
pause
