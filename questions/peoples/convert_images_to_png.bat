@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM --- Vérifie ImageMagick
where magick >nul 2>&1
if errorlevel 1 (
  echo ERREUR : magick.exe introuvable dans le PATH.
  pause
  exit /b 1
)

REM --- Dossier racine = dossier du .bat
set "ROOT=%~dp0"
pushd "%ROOT%" >nul

echo Conversion recursive des .webp et .avif en .png...
echo Dossier racine : %ROOT%
echo.

REM --- WEBP
for /r "%ROOT%" %%F in (*.webp) do (
  echo [WEBP] "%%~fF" ^> "%%~dpnF.png"
  magick "%%~fF" "%%~dpnF.png"
  if not errorlevel 1 (
    del /q "%%~fF"
  ) else (
    echo ECHEC conversion : "%%~fF"
  )
)

REM --- AVIF
for /r "%ROOT%" %%F in (*.avif) do (
  echo [AVIF] "%%~fF" ^> "%%~dpnF.png"
  magick "%%~fF" "%%~dpnF.png"
  if not errorlevel 1 (
    del /q "%%~fF"
  ) else (
    echo ECHEC conversion : "%%~fF"
  )
)

echo.
echo Termine.
popd >nul
pause
endlocal