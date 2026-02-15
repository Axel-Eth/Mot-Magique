@echo off
setlocal
 
REM Se place dans le dossier où se trouve ce .bat (donc la racine a-vos-mots)
cd /d "%~dp0"

REM Lance le serveur dans une nouvelle fenêtre (et laisse la fenêtre ouverte)
start "AVM - Serveur" cmd /k python -m http.server 8000

REM Petit délai pour laisser le serveur démarrer
timeout /t 1 /nobreak >nul

REM Ouvre la régie (index.html)
start "" "http://localhost:8000/index.html"
/