#!/bin/bash

# Zoho-Faire Integration Setup Script
echo "🚀 Setting up Zoho-Faire Integration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 16+ first.${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo -e "${RED}❌ Node.js version 16+ required. Current version: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node -v) detected${NC}"

# Install frontend dependencies
echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install frontend dependencies${NC}"
    exit 1
fi

# Install backend dependencies
echo -e "${BLUE}📦 Installing backend dependencies...${NC}"
cd backend
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install backend dependencies${NC}"
    exit 1
fi

cd ..

# Check if .env files exist
echo -e "${BLUE}🔧 Checking environment configuration...${NC}"

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Frontend .env file not found. Creating from template...${NC}"
    cp .env.example .env 2>/dev/null || echo "REACT_APP_API_BASE_URL=http://localhost:3001/api" > .env
fi

if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚠️  Backend .env file not found. Creating from template...${NC}"
    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example backend/.env
    else
        cat > backend/.env << EOL
# Server Configuration
PORT=3001
NODE_ENV=development

# Zoho OAuth Credentials
ZOHO_CLIENT_ID=your_zoho_client_id_here
ZOHO_CLIENT_SECRET=your_zoho_client_secret_here
ZOHO_ORGANIZATION_ID=your_zoho_organization_id_here

# Base URL for callbacks
BASE_URL=http://localhost:3001

# Faire API Configuration
FAIRE_ACCESS_TOKEN=your_faire_access_token_here
EOL
    fi
fi

echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Edit backend/.env with your API credentials:"
echo "   - Get Zoho credentials from: https://api-console.zoho.com/"
echo "   - Get Faire token from your brand account settings"
echo ""
echo "2. Start the development servers:"
echo -e "   ${GREEN}npm run dev${NC}     # Starts both frontend and backend"
echo ""
echo "   Or start them separately:"
echo -e "   ${GREEN}npm run server${NC}  # Backend only (port 3001)"
echo -e "   ${GREEN}npm start${NC}       # Frontend only (port 3000)"
echo ""
echo "3. Open http://localhost:3000 in your browser"
echo "4. Click 'Authenticate with Zoho' to complete setup"
echo ""
echo -e "${BLUE}📚 Need help?${NC}"
echo "- Read README.md for detailed instructions"
echo "- Check DEPLOY.md for production deployment"
echo ""
echo -e "${GREEN}🎉 Happy coding!${NC}"