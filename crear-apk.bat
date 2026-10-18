@echo off
title HULUL - Crear APK
cd /d "%~dp0apps\mobile"
echo.
echo  Crea el instalador de la app (APK) en los servidores de Expo.
echo  Tu PC puede apagarse despues de enviarlo: Expo lo arma en la nube (10 a 20 minutos).
echo.
echo  La primera vez te pedira:
echo    - Iniciar sesion en Expo: usuario lsegovia941
echo    - Crear el proyecto en Expo: responde Y (si)
echo    - Crear una llave para firmar la app: responde Y (si)
echo.
call npx.cmd -y eas-cli@latest whoami >nul 2>&1 || call npx.cmd -y eas-cli@latest login
call npx.cmd -y eas-cli@latest build --platform android --profile apk
if errorlevel 1 (
  echo.
  echo  Algo fallo. Manda una captura de esta ventana.
) else (
  echo.
  echo  Listo. Abre el enlace que aparece arriba en tu celular Android para descargar e instalar HULUL.
  echo  Tambien queda en https://expo.dev, en tu proyecto hulul, seccion Builds.
)
echo.
pause
