# Development Guide

Quick reference for developing the Zoho-Faire Integration app locally.

## 🚀 Quick Start

```bash
# Run setup script (Mac/Linux)
chmod +x setup.sh
./setup.sh

# Or on Windows
setup.bat

# Start development
npm run dev
```

## 📁 Project Structure

```
zoho-faire-integration/
├── src/                          # React frontend
│   ├── components/
│   │   └── ZohoFaireIntegration.jsx  # Main component
│   ├── App.js                    # App with Material-UI theme
│   └── index.js                  # React entry point
├── backend/                      # Express.js backend
│   ├── server.js                # Main server with OAuth
│   ├── package.json             # Backend dependencies
│   └── .env                     # Backend config
├── package.json                 # Frontend dependencies & scripts
├── .env                         # Frontend config
└── README.md                    # Full documentation
```

## 🛠️ Development Scripts

### Frontend + Backend Together
```bash
npm run dev              # Start both frontend (3000) and backend (3001)
```

### Separate Processes
```bash
npm start               # Frontend only (port 3000)
npm run server          # Backend only (port 3001)
```

### Build & Deploy
```bash
npm run build           # Build React app for production
npm run build-production  # Build + install backend production deps
```

## 🔧 Environment Setup

### Frontend (.env)
```bash
REACT_APP_API_BASE_URL=http://localhost:3001/api
```

### Backend (backend/.env)
```bash
# OAuth Credentials (from https://api-console.zoho.com/)
ZOHO_CLIENT_ID=your_client_id
ZOHO_CLIENT_SECRET=your_client_secret
ZOHO_ORGANIZATION_ID=your_org_id

# API Tokens
FAIRE_ACCESS_TOKEN=your_faire_token

# Development settings
PORT=3001
NODE_ENV=development
BASE_URL=http://localhost:3001
```

## 🔐 Getting API Credentials

### Zoho Setup
1. Visit [Zoho API Console](https://api-console.zoho.com/)
2. Create "Server-based Application"
3. Set callback: `http://localhost:3001/auth/zoho/callback`
4. Add scope: `ZohoInventory.FullAccess.all`
5. Copy Client ID and Secret

### Faire Setup
1. Login to Faire brand account
2. Go to Account Settings → API Access
3. Generate API token
4. Copy the token

## 🔄 OAuth Flow (Development)

1. Start both frontend and backend
2. Visit http://localhost:3000
3. Click "Authenticate with Zoho"
4. Complete OAuth in Zoho
5. Save returned tokens to backend/.env:
   ```bash
   ZOHO_ACCESS_TOKEN=1000.abc123...
   ZOHO_REFRESH_TOKEN=1000.def456...
   ```

## 📡 API Endpoints

### Local URLs
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api
- **OAuth Start**: http://localhost:3001/auth/zoho
- **Health Check**: http://localhost:3001/health

### Testing Endpoints
```bash
# Health check
curl http://localhost:3001/health

# Auth status
curl http://localhost:3001/auth/status

# Get Zoho items (requires auth)
curl http://localhost:3001/api/zoho/items

# Get Faire products
curl http://localhost:3001/api/faire/products
```

## 🐛 Common Development Issues

### Port Already in Use
```bash
# Kill process on port 3000 or 3001
npx kill-port 3000
npx kill-port 3001

# Or find and kill manually
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### CORS Errors
- Ensure backend is running on port 3001
- Check REACT_APP_API_BASE_URL in frontend .env
- Restart both servers

### OAuth Issues
- Verify callback URL: `http://localhost:3001/auth/zoho/callback`
- Check client ID/secret in backend/.env
- Clear browser cookies and try again

### Module Not Found
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Backend dependencies
cd backend
rm -rf node_modules package-lock.json  
npm install
cd ..
```

## 🧪 Testing

### Manual Testing Flow
1. Start development servers
2. Complete OAuth authentication
3. Test fetching Zoho items
4. Test searching/filtering
5. Test selecting items
6. Test upload to Faire (with test products)

### Component Testing
```bash
# Run React tests
npm test

# Run specific test file
npm test -- --testNamePattern="ZohoFaireIntegration"
```

## 📊 Debugging

### Frontend Debugging
- Use React Developer Tools
- Check browser console for errors
- Monitor Network tab for API calls

### Backend Debugging
- Check terminal output for server logs
- Add console.log statements in server.js
- Use Postman to test API endpoints

### Common Log Messages
```bash
# Good signs
✓ Server running on port 3001
✓ Zoho OAuth successful. Tokens stored.
✓ Successfully fetched X items from Zoho

# Issues to investigate
✗ No Zoho access token available
✗ OAuth token exchange error
✗ Failed to fetch items from Zoho
```

## 🔄 Hot Reload

Both frontend and backend support hot reload:
- **Frontend**: Automatic reload on file changes
- **Backend**: Uses nodemon for auto-restart

## 📦 Dependencies

### Frontend Key Deps
- React 19.1.0
- Material-UI 7.2.0
- Emotion (CSS-in-JS)

### Backend Key Deps
- Express 4.18.2
- Axios 1.6.0 (HTTP client)
- CORS 2.8.5
- dotenv 16.3.1

## 🚀 Ready for Production?

When ready to deploy:
1. Test OAuth flow thoroughly
2. Verify all API integrations work
3. Test error handling
4. Check all environment variables
5. Follow DEPLOY.md guide

---

Happy developing! 🎉