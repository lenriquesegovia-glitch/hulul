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
echo  Al final, si pregunta "Install and run the Android build on an emulator?",
echo  responde N (no). Eso es para emuladores de PC; la app se instala en el celular.
echo.
call npx.cmd -y eas-cli@latest whoami >nul 2>&1 || call npx.cmd -y eas-cli@latest login
call npx.cmd -y eas-cli@latest build --platform android --profile apk
if errorlevel 1 (
  echo.
  echo  Si arriba dice "Build finished" o "Successfully downloaded app", la app SI quedo lista:
  echo  el error es solo del emulador. Descargala desde https://expo.dev, proyecto hulul, Builds.
  echo  Si no, manda una captura de esta ventana.
) else (
  echo.
  echo  Listo. Abre el enlace que aparece arriba en tu celular Android para descargar e instalar HULUL.
  echo  Tambien queda en https://expo.dev, en tu proyecto hulul, seccion Builds.
)
echo.
pause
