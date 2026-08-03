@echo off
cd /d "%~dp0"
title BetterMint EngineWS v2.0

echo Installing dependencies...
python -m pip install -q -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo Failed to install dependencies. Exiting.
    pause
    exit /b
)

echo Starting EngineWS...
python main.py
if %ERRORLEVEL% neq 0 (
    echo EngineWS exited with an error.
    pause
    exit /b
)

pause
