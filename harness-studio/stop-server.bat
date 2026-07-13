@echo off
chcp 65001 >nul 2>&1
title Harness Studio - Stop Server

echo ==============================================
echo   Harness Studio - Stop Development Server
echo ==============================================
echo.

echo Stopping all node processes...
taskkill /F /IM node.exe 2>nul

if %errorlevel% equ 0 (
    echo.
    echo Server stopped successfully!
) else (
    echo.
    echo No node process found to stop.
)

echo.
echo ==============================================
pause