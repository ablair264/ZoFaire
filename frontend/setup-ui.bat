@echo off
REM ZoFaire Frontend Setup Script for Windows

echo Setting up ZoFaire Frontend with UI Enhancements...

REM Navigate to frontend directory
cd frontend

REM Install all dependencies including lottie-react
echo Installing dependencies...
call npm install

REM Copy logos if they exist in the parent directory
if exist "..\splitfin.png" (
    echo Copying splitfin.png to public directory...
    copy "..\splitfin.png" "public\"
)

if exist "..\splitfin-white.png" (
    echo Copying splitfin-white.png to public directory...
    copy "..\splitfin-white.png" "public\"
)

echo.
echo Setup complete!
echo.
echo To start the application, run:
echo   npm start
echo.
echo Make sure to place your logo files in the public directory:
echo   - public\splitfin.png
echo   - public\splitfin-white.png
pause