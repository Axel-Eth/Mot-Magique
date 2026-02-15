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

REM --- Si aucun webp, on sort
dir /b *.webp >nul 2>&1
if errorlevel 1 (
  echo Aucun fichier .webp trouve dans: "%DIR%"
  popd >nul
  pause
  exit /b 0
)

echo Conversion des .webp en .png dans le meme dossier...
echo.

for %%F in (*.webp) do (
  echo %%~nxF  ^>  %%~nF.png
  magick "%%~fF" "%%~dpnF.png"
  if not errorlevel 1 (
    del /q "%%~fF"
  ) else (
    echo   [ECHEC] %%~nxF
  )
)

echo.
echo Termine.
popd >nul
pause
endlocal
