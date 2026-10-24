@echo off
cd /d "%~dp0"
echo Starting AI Fountain Academy preview at http://localhost:3000 ...
start "" http://localhost:3000
npx --yes serve public -l 3000
pause
