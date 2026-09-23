@echo off
echo ========================================================
echo PITCH AND PROSPER by CSEA - Launching Full Stack
echo ========================================================
echo.

:: 1. Check if MySQL is already listening on port 3306
netstat -ano | findstr /R /C:":3306 " >nul
if %errorlevel% equ 0 (
    echo [OK] MySQL is already running on port 3306.
) else (
    echo [*] Starting MySQL Database with D:\CSEA\data\my.ini ...
    start "MySQL Database Server" /min "D:\xampp\mysql\bin\mysqld.exe" --defaults-file="D:\CSEA\data\my.ini"
    timeout /t 3 /nobreak >nul
)

:: 2. Launch Next.js dev server
echo.
echo [*] Starting Next.js Dev Server on http://localhost:3000 ...
echo [INFO] Access the application at: http://localhost:3000
echo.
npm run dev
