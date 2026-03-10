@echo off
setlocal EnableExtensions

cd /d "%~dp0\.."
set "PY_DIR=runtime\python"

echo.
echo ==========================================
echo   Verification runtime Python embarque
echo ==========================================
echo Dossier cible : %CD%\%PY_DIR%
echo.

if not exist "%PY_DIR%\python.exe" (
  echo [ERREUR] python.exe introuvable dans %PY_DIR%
  echo [INFO]   Placez le package embeddable officiel dans ce dossier.
  pause
  exit /b 1
)

set "PTH_FILE="
for %%F in ("%PY_DIR%\python*._pth") do (
  if exist "%%~fF" set "PTH_FILE=%%~fF"
)

if not defined PTH_FILE (
  echo [ERREUR] Aucun fichier python*._pth trouve dans %PY_DIR%
  pause
  exit /b 1
)

echo [INFO] Fichier ._pth detecte : %PTH_FILE%

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$f='%PTH_FILE%'; " ^
  "$lines=Get-Content -LiteralPath $f; " ^
  "if(-not ($lines -match '^[ ]*\\.$')){ $lines += '.' }; " ^
  "$zipLine = $lines | Where-Object { $_ -match '^[ ]*python[0-9]+\\.zip$' } | Select-Object -First 1; " ^
  "if(-not $zipLine){ Write-Error 'Ligne pythonXYZ.zip absente du fichier ._pth'; exit 1 }; " ^
  "if(-not ($lines -match '^[ ]*import site[ ]*$')){ " ^
  "  $lines = $lines | ForEach-Object { if($_ -match '^[ ]*#[ ]*import site[ ]*$'){ 'import site' } else { $_ } }; " ^
  "  if(-not ($lines -match '^[ ]*import site[ ]*$')){ $lines += 'import site' } " ^
  "}; " ^
  "Set-Content -LiteralPath $f -Value $lines -Encoding Ascii"

if errorlevel 1 (
  echo [ERREUR] Echec de la mise a jour du fichier ._pth
  pause
  exit /b 1
)

"%PY_DIR%\python.exe" -c "import sys; import http.server; print('OK runtime:', sys.version)"
if errorlevel 1 (
  echo [ERREUR] Runtime present mais import standard library en echec.
  pause
  exit /b 1
)

echo [OK] Runtime valide et configuration ._pth appliquee.
echo.
exit /b 0
