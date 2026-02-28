@echo off
setlocal enabledelayedexpansion

for %%F in (*.*) do (
    set "name=%%~nF"
    set "ext=%%~xF"

    rem On coupe tout avant le premier espace
    for /f "tokens=2,* delims= " %%A in ("!name!") do (
        set "newname=%%A %%B"
    )

    rem Si jamais il n’y a qu’un seul mot après le numéro
    if not defined newname (
        for /f "tokens=2 delims= " %%A in ("!name!") do (
            set "newname=%%A"
        )
    )

    if defined newname (
        ren "%%F" "!newname!!ext!"
    )

    set "newname="
)