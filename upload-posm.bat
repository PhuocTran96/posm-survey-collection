@echo off
echo.
echo ========================================
echo       POSM Data Upload Script
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if posm.csv exists
if not exist "posm.csv" (
    echo ERROR: posm.csv file not found in current directory
    echo Please make sure posm.csv is in the same folder as this script
    pause
    exit /b 1
)

echo Found posm.csv file
echo.

echo Select upload option:
echo 1. Upsert POSM data (add new + update existing) [RECOMMENDED]
echo 2. Insert only (add new records, skip existing)
echo 3. Update only (update existing records)
echo 4. Clear existing data and upsert POSM data
echo 5. Show help
echo.

set /p choice=Enter your choice (1-5): 

if "%choice%"=="1" (
    echo.
    echo Upserting POSM data (smart mode)...
    node upload-posm-data.js --upsert
) else if "%choice%"=="2" (
    echo.
    echo Inserting new POSM data only...
    node upload-posm-data.js --insert-only
) else if "%choice%"=="3" (
    echo.
    echo Updating existing POSM data only...
    node upload-posm-data.js --update-only
) else if "%choice%"=="4" (
    echo.
    echo WARNING: This will delete all existing POSM data!
    set /p confirm=Are you sure? (y/N): 
    if /i "%confirm%"=="y" (
        echo.
        echo Clearing existing data and upserting...
        node upload-posm-data.js --clear --upsert
    ) else (
        echo Operation cancelled.
    )
) else if "%choice%"=="5" (
    echo.
    node upload-posm-data.js --help
) else (
    echo Invalid choice. Please run the script again.
)

echo.
echo Press any key to exit...
pause >nul
