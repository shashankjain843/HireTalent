@echo off
echo ===================================================
echo     HireTalentIQ -- Starting Backend and Frontend
echo ===================================================

start "HireTalentIQ Backend (Port 8000)" cmd /k "cd /d %~dp0backend && python run.py"
start "HireTalentIQ Frontend (Port 3000)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo [OK] Both servers have been launched in separate windows!
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://localhost:3000
echo.
