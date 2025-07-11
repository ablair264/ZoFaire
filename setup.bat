@echo off
REM Zoho-Faire Integration Setup Script for Windows

echo 🚀 Setting up Zoho-Faire Integration...

REM Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 16+ first.
    pause
    exit /b 1
)

echo ✅ Node.js detected: 
node -v

REM Install frontend dependencies
echo 📦 Installing frontend dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install frontend dependencies
    pause
    exit /b 1
)

REM Install backend dependencies
echo 📦 Installing backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install backend dependencies
    pause
    exit /b 1
)

cd ..

REM Check if .env files exist
echo 🔧 Checking environment configuration...

if not exist ".env" (
    echo ⚠️  Frontend .env file not found. Creating from template...
    echo REACT_APP_API_BASE_URL=http://localhost:3001/api > .env
)

if not exist "backend\.env" (
    echo ⚠️  Backend .env file not found. Creating from template...
    (
        echo # Server Configuration
        echo PORT=3001
        echo NODE_ENV=development
        echo.
        echo # Zoho OAuth Credentials
        echo ZOHO_CLIENT_ID=your_zoho_client_id_here
        echo ZOHO_CLIENT_SECRET=your_zoho_client_secret_here
        echo ZOHO_ORGANIZATION_ID=your_zoho_organization_id_here
        echo.
        echo # Base URL for callbacks
        echo BASE_URL=http://localhost:3001
        echo.
        echo # Faire API Configuration
        echo FAIRE_ACCESS_TOKEN=your_faire_access_token_here
    ) > backend\.env
)

echo ✅ Setup complete!
echo.
echo 📋 Next Steps:
echo 1. Edit backend\.env with your API credentials:
echo    - Get Zoho credentials from: https://api-console.zoho.com/
echo    - Get Faire token from your brand account settings
echo.
echo 2. Start the development servers:
echo    npm run dev     # Starts both frontend and backend
echo.
echo    Or start them separately:
echo    npm run server  # Backend only (port 3001)
echo    npm start       # Frontend only (port 3000)
echo.
echo 3. Open http://localhost:3000 in your browser
echo 4. Click 'Authenticate with Zoho' to complete setup
echo.
echo 📚 Need help?
echo - Read README.md for detailed instructions
echo - Check DEPLOY.md for production deployment
echo.
echo 🎉 Happy coding!
pause