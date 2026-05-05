@echo off
cd /d "%~dp0"

echo Uninstalling existing version of my_main_manager...
python -m pip uninstall -y my_main_manager

:: Install dependencies from requirements.txt
echo Installing dependencies from requirements.txt...
python -m pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo Failed to install dependencies. Exiting.
    pause
    exit /b
)

:: Run the application
echo Starting application...
python -m uvicorn main:app --reload
if %ERRORLEVEL% neq 0 (
    echo Failed to start the application. Exiting.
    pause
    exit /b
)

pause
