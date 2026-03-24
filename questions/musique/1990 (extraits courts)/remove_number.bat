@echo off
setlocal enabledelayedexpansion

for %%F in (*) do (
    set "name=%%~nxF"
    
    echo !name! | findstr /r "^[0-9][0-9]*\. " >nul
    if !errorlevel! == 0 (
        for /f "tokens=1* delims=." %%A in ("!name!") do (
            set "rest=%%B"
        )
        set "rest=!rest:~1!"
        ren "%%F" "!rest!"
    )
)

echo Terminé.
pause