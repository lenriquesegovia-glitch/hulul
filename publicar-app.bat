@echo off
title HULUL - Publicar cambios en la app
cd /d "%~dp0apps\mobile"
echo.
echo  Envia los ultimos cambios a todos los celulares que ya tienen HULUL instalado.
echo  No hay que reinstalar: la proxima vez que abran la app se actualiza sola.
echo  Tarda 2 a 5 minutos. Antes corre actualizar.bat.
echo.
echo  (Si cambia algo nativo, como permisos o la version, hay que usar crear-apk.bat.)
echo.
call npx.cmd -y eas-cli@latest whoami >nul 2>&1 || call npx.cmd -y eas-cli@latest login
call npx.cmd -y eas-cli@latest update --channel production --platform android --environment production --message "Actualizacion %date% %time%"
if errorlevel 1 (
  echo.
  echo  Algo fallo. Manda una captura de esta ventana.
) else (
  echo.
  echo  Listo. Pide que cierren y vuelvan a abrir HULUL: se actualiza al abrir.
)
echo.
pause
