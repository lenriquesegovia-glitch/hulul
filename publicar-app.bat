@echo off
title HULUL - Publicar cambios en la app
echo.
echo  Envia los ultimos cambios a todos los celulares que ya tienen HULUL instalado.
echo  No hay que reinstalar: la proxima vez que abran la app se actualiza sola.
echo  Tarda 2 a 5 minutos. Antes corre actualizar.bat.
echo.
echo  (Si cambia algo nativo, como permisos o la version, hay que usar crear-apk.bat.)
echo.
rem Bloqueo: solo se publica desde la ultima version de GitHub (main), sin cambios sin guardar
rem y nunca desde la carpeta raiz antigua C:\Users\lsego\Hulul.
call node "%~dp0scripts\verificar-copia.cjs"
if errorlevel 1 (
  pause
  exit /b 1
)
for /f %%c in ('git -C "%~dp0." rev-parse --short HEAD') do set HULUL_COMMIT=%%c
cd /d "%~dp0apps\mobile"
call npx.cmd -y eas-cli@latest whoami >nul 2>&1 || call npx.cmd -y eas-cli@latest login
call npx.cmd -y eas-cli@latest update --channel production --platform android --environment production --message "main %HULUL_COMMIT% - %date% %time%"
if errorlevel 1 (
  echo.
  echo  Algo fallo. Manda una captura de esta ventana.
) else (
  echo.
  echo  Listo. Pide que cierren y vuelvan a abrir HULUL: se actualiza al abrir.
)
echo.
pause
