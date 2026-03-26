@echo off
cd /d "%~dp0"
python "%~dp0merge_personal_dictionary.py"
if errorlevel 1 pause
