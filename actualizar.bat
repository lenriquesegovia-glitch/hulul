@echo off
title HULUL - Actualizar
cd /d "%~dp0"
echo.
echo  Descargando la ultima version de HULUL desde GitHub...
echo  (Se guardan tus ajustes locales, como el proyecto de Expo, y se vuelven a aplicar.)
echo.
set GUARDADO=
git diff --quiet
if errorlevel 1 (
  git stash
  set GUARDADO=1
)
git pull
if defined GUARDADO (
  git stash pop
  if errorlevel 1 (
    echo.
    echo  Hubo un choque con tus ajustes locales. Manda una captura de esta ventana.
    pause
    exit /b 1
  )
)
echo.
echo  Instalando dependencias nuevas, si las hay...
echo.
call npm.cmd install --no-audit --no-fund
echo.
echo  Listo. Ya puedes abrir iniciar-web.bat o iniciar-app.bat.
pause
