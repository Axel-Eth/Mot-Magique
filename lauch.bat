@echo off
setlocal EnableExtensions

cd /d "%~dp0"

REM === Configuration ===
set "PORT=8000"
set "HOST=127.0.0.1"
set "BASEURL=http://%HOST%:%PORT%"
set "START_PAGE=regie.html"
set "PYTHON_EXE=runtime\python\python.exe"

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

"%PYTHON_EXE%" --version >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] Le runtime Python existe mais ne demarre pas correctement.
  echo [INFO]   Verifie l'extraction du package embeddable officiel dans runtime\python\
  echo [INFO]   Puis execute runtime\configure_embedded_python.bat
  echo.
  pause
  exit /b 1
)

if exist "runtime\python\pyvenv.cfg" (
  echo [WARN] pyvenv.cfg detecte dans runtime\python\. Ce fichier peut perturber le runtime embarque.
  echo [WARN] Supprime-le si le serveur ne demarre pas.
  echo.
)

echo [OK] Runtime Python detecte.
echo [OK] Demarrage du serveur HTTP sur %BASEURL%
echo.

REM /k garde la fenetre ouverte meme en cas d'erreur (port occupe, runtime invalide, etc.)
start "Mot-Magique Server" cmd /k "\"%PYTHON_EXE%\" -m http.server %PORT% --bind %HOST%"

timeout /t 1 /nobreak >nul

echo [OK] Ouverture de %START_PAGE% dans le navigateur...
start "" "%BASEURL%/%START_PAGE%"

echo.
echo Serveur lance. Fermer la fenetre "Mot-Magique Server" pour l'arreter.
echo.
exit /b 0
