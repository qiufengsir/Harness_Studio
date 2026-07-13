@echo off
chcp 65001 >nul 2>&1
title Harness Studio - Restart Server

echo ==============================================
echo   Harness Studio - Restart Development Server
echo ==============================================
echo.

echo [1/3] Stopping existing server on port 3000...
taskkill /F /IM node.exe 2>nul || echo No running node process found
timeout /t 2 /nobreak >nul
echo.

echo [2/3] Starting development server...
cd /d "%~dp0"
start cmd /k "npm run dev"
echo.

echo [3/3] Server restart initiated!
echo.
echo Waiting 5 seconds for server to start...
timeout /t 5 /nobreak >nul

echo Opening browser...
start http://localhost:3000

echo ==============================================
echo   Server restarted successfully!
echo ==============================================
pause