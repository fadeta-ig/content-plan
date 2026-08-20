@echo off
TITLE Content Plan - PT Wijaya Inovasi Gemilang (Local Launcher)
echo ==============================================================================
echo   Content Plan - PT Wijaya Inovasi Gemilang (Local Development Launcher)
echo ==============================================================================
echo.

echo [1/2] Membuka Backend Django di Terminal Baru (Port 8000)...
start "Django API Backend" cmd /k "cd backend && python manage.py runserver 0.0.0.0:8000"

echo [2/2] Membuka Frontend Next.js di Terminal Baru (Port 3000)...
start "Next.js Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ==============================================================================
echo   Layanan lokal sedang berjalan:
echo   - Frontend UI: http://localhost:3000
echo   - Backend API: http://localhost:8000
echo   - Swagger Docs: http://localhost:8000/api/v1/docs
echo ==============================================================================
pause
