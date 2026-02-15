@echo off
setlocal EnableExtensions

REM === CONFIG ===
set PORT=8000
set BASEURL=http://localhost:%PORT%
set REGIE=%BASEURL%/regie.html
set PLATEAU=%BASEURL%/plateau.html

REM Se placer dans le dossier du .bat (racine projet)
cd /d "%~dp0"

echo.
echo ==========================================
echo   AVM - Lancement serveur + pages
echo ==========================================
echo Dossier: %CD%
echo URL:     %BASEURL%
echo.

REM === 1) Tenter Python (recommandé) ===
where python >nul 2>nul
if %errorlevel%==0 (
  echo [OK] Python detecte. Lancement du serveur sur le port %PORT%...
  start "AVM Server (Python)" cmd /c "python -m http.server %PORT% --bind 127.0.0.1"
  goto :OPEN
)

REM === 2) Fallback PowerShell (si pas de Python) ===
where powershell >nul 2>nul
if %errorlevel%==0 (
  echo [WARN] Python introuvable. Fallback PowerShell HttpListener...
  start "AVM Server (PowerShell)" powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$p=%PORT%; $root=(Resolve-Path '.').Path; " ^
    "$l=New-Object System.Net.HttpListener; " ^
    "$l.Prefixes.Add(\"http://127.0.0.1:$p/\"); $l.Start(); " ^
    "Write-Host \"Serving $root on http://127.0.0.1:$p/\"; " ^
    "while($l.IsListening){ " ^
    "  $c=$l.GetContext(); $path=$c.Request.Url.AbsolutePath.TrimStart('/'); " ^
    "  if([string]::IsNullOrWhiteSpace($path)){ $path='index.html' } " ^
    "  $file=Join-Path $root $path; " ^
    "  if(Test-Path $file){ " ^
    "    $bytes=[IO.File]::ReadAllBytes($file); " ^
    "    $c.Response.ContentLength64=$bytes.Length; " ^
    "    $c.Response.OutputStream.Write($bytes,0,$bytes.Length) " ^
    "  } else { " ^
    "    $c.Response.StatusCode=404; " ^
    "  } " ^
    "  $c.Response.OutputStream.Close(); " ^
    "}"
  goto :OPEN
)

echo [ERROR] Ni python ni powershell disponibles. Impossible de demarrer un serveur.
pause
exit /b 1

:OPEN
REM Petite pause pour laisser le serveur démarrer
timeout /t 1 /nobreak >nul

echo Ouverture du Plateau et de la Regie...
start "" "%PLATEAU%"
timeout /t 1 /nobreak >nul
start "" "%REGIE%"

echo.
echo C'est lance. (Ferme la fenetre "AVM Server" pour couper le serveur.)
echo.
exit /b 0
