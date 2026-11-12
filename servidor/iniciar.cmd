@echo off
rem Abre a Filo: enciende el servidor local y la pagina en Chrome.
cd /d "%~dp0"
start "Filo (cierra para apagar)" /min python servidor.py
timeout /t 2 /nobreak >nul
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://localhost:5077/"
