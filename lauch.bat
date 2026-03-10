@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM === Configuration ===
set "PORT=8000"
set "HOST=127.0.0.1"
set "BASEURL=http://%HOST%:%PORT%"
set "START_PAGE=regie.html"
set "PYTHON_EXE=%SCRIPT_DIR%runtime\python\python.exe"
set "PYTHON_DIR=%SCRIPT_DIR%runtime\python"

REM Neutraliser toute pollution d'environnement Python machine.
set "PYTHONHOME="
set "PYTHONPATH="
set "PYTHONSTARTUP="
set "PYTHONUSERBASE="
set "__PYVENV_LAUNCHER__="
set "PYTHONNOUSERSITE=1"

echo.
echo ==========================================
echo   MOT-MAGIQUE - Lancement local
echo ==========================================
echo Dossier projet : %CD%
echo Runtime Python : %PYTHON_EXE%
echo URL cible      : %BASEURL%/%START_PAGE%
echo.

if not exist "%PYTHON_EXE%" (
  echo [ERREUR] Runtime Python embarque introuvable.
  echo [INFO]   Fichier attendu : %PYTHON_EXE%
  echo [INFO]   Voir : runtime\README.md
  echo.
  pause
  exit /b 1
)

if exist "%SCRIPT_DIR%pyvenv.cfg" (
  echo [WARN] pyvenv.cfg detecte a la racine du projet.
  echo [WARN] Ce fichier peut forcer le mauvais runtime si quelqu'un lance python manuellement.
  echo.
)

"%PYTHON_EXE%" -I --version >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] Le runtime Python existe mais ne demarre pas correctement.
  echo [INFO]   Verifie l'extraction du package embeddable officiel dans runtime\python\
  echo [INFO]   Puis execute runtime\configure_embedded_python.bat
  echo.
  pause
  exit /b 1
)

if exist "%PYTHON_DIR%\pyvenv.cfg" (
  echo [WARN] pyvenv.cfg detecte dans runtime\python\. Ce fichier peut perturber le runtime embarque.
  echo [WARN] Supprime-le si le serveur ne demarre pas.
  echo.
)

echo [INFO] Verification executable reel en cours...
"%PYTHON_EXE%" -I -c "import os,sys; print(os.path.abspath(sys.executable)); import http.server" > "%TEMP%\mot_magique_pycheck.txt" 2>&1
if errorlevel 1 (
  echo [ERREUR] Le runtime embarque est present mais la stdlib est invalide.
  type "%TEMP%\mot_magique_pycheck.txt"
  echo.
  echo [INFO] Verifie le contenu de runtime\python et le fichier python*._pth
  echo [INFO] Puis relance runtime\configure_embedded_python.bat
  echo.
  pause
  exit /b 1
)
set /p PY_EXEC_USED=<"%TEMP%\mot_magique_pycheck.txt"
del "%TEMP%\mot_magique_pycheck.txt" >nul 2>nul
echo [OK] Python reel utilise : %PY_EXEC_USED%

echo [OK] Runtime Python detecte.
echo [OK] Demarrage du serveur HTTP sur %BASEURL%
echo.

REM /k garde la fenetre ouverte meme en cas d'erreur (port occupe, runtime invalide, etc.)
start "Mot-Magique Server" cmd /k ""%PYTHON_EXE%" -I -m http.server %PORT% --bind %HOST%""

timeout /t 1 /nobreak >nul

echo [OK] Ouverture de %START_PAGE% dans le navigateur...
start "" "%BASEURL%/%START_PAGE%"

echo.
echo Serveur lance. Fermer la fenetre "Mot-Magique Server" pour l'arreter.
echo.
exit /b 0
