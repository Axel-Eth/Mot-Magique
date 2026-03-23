@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM --- Vérifie ImageMagick
where magick >nul 2>&1
if errorlevel 1 (
  echo ERREUR: magick.exe introuvable dans le PATH.
  pause
  exit /b 1
)

REM --- Dossier cible = dossier du .bat
set "DIR=%~dp0"
pushd "%DIR%" >nul

echo Conversion des .webp et .avif en .png dans le meme dossier...
echo.

REM --- WEBP
for %%F in (*.webp) do (
  echo %%~nxF  ^>  %%~nF.png
  magick "%%~fF" "%%~dpnF.png"
  if not errorlevel 1 del /q "%%~fF"
)

REM --- AVIF
for %%F in (*.avif) do (
  echo %%~nxF  ^>  %%~nF.png
  magick "%%~fF" "%%~dpnF.png"
  if not errorlevel 1 del /q "%%~fF"
)

echo.
echo Termine.
popd >nul
pause
endlocal
