# Zoho to Faire Integration App

A complete production-ready application that syncs products from Zoho Inventory to Faire marketplace with OAuth authentication and Material-UI interface.

## 🚀 Features

- **OAuth Authentication** - Secure Zoho API access
- **Real-time Sync** - Fetch products from Zoho Inventory
- **Bulk Upload** - Select and upload multiple products to Faire
- **Progress Tracking** - Real-time upload progress with detailed feedback
- **Search & Filter** - Find products by name, SKU, or category
- **Material-UI Interface** - Professional, responsive design
- **Automatic Token Refresh** - Handles expired tokens seamlessly
- **Production Ready** - Optimized for deployment on Render

## 📁 Project Structure

```
zoho-faire-integration/
├── src/                          # React frontend
│   ├── components/
│   │   └── ZohoFaireIntegration.jsx
│   ├── App.js
│   └── index.js
├── backend/                      # Express.js backend
│   ├── server.js                # Main server file
│   ├── package.json             # Backend dependencies
│   └── .env                     # Backend environment variables
├── package.json                 # Frontend dependencies
├── .env                         # Frontend environment variables
└── README.md
```

## 🛠️ Setup Instructions

### 1. Prerequisites

- Node.js 16+ installed
- Zoho Inventory account with API access
- Faire brand account with API access
- Git for version control

### 2. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 3. Configure Environment Variables

#### Frontend (.env)
```bash
REACT_APP_API_BASE_URL=http://localhost:3001/api
```

#### Backend (backend/.env)
```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Zoho OAuth Credentials
ZOHO_CLIENT_ID=your_zoho_client_id_here
ZOHO_CLIENT_SECRET=your_zoho_client_secret_here
ZOHO_ORGANIZATION_ID=your_zoho_organization_id_here

# Base URL for callbacks
BASE_URL=http://localhost:3001

# Faire API
FAIRE_ACCESS_TOKEN=your_faire_access_token_here
```

### 4. Get API Credentials

#### Zoho Setup:
1. Go to [Zoho API Console](https://api-console.zoho.com/)
2. Create "Server-based Application"
3. Set callback URL: `http://localhost:3001/auth/zoho/callback`
4. Add scope: `ZohoInventory.FullAccess.all`
5. Copy Client ID and Client Secret

#### Faire Setup:
1. Log into Faire brand account
2. Go to Account Settings > API Access
3. Generate API token
4. Copy the access token

### 5. Run the Application

```bash
# Terminal 1 - Start backend server
cd backend
npm run dev

# Terminal 2 - Start React frontend
npm start
```

### 6. Authenticate with Zoho

1. Open http://localhost:3000
2. Click "Authenticate with Zoho"
3. Grant permissions in Zoho
4. Save the provided tokens to your .env file

## 🌐 Production Deployment (Render)

### 1. Build for Production

This app is configured to serve both frontend and backend from a single Render service:

```bash
# Build React app
npm run build

# The backend will serve the built React app
```

### 2. Deploy to Render

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Create Render Service**:
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New" > "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Root Directory**: `backend`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`

3. **Set Environment Variables in Render**:
   ```bash
   PORT=3001
   NODE_ENV=production
   BASE_URL=https://your-app-name.onrender.com
   ZOHO_CLIENT_ID=your_zoho_client_id
   ZOHO_CLIENT_SECRET=your_zoho_client_secret
   ZOHO_ORGANIZATION_ID=your_org_id
   FAIRE_ACCESS_TOKEN=your_faire_token
   ```

4. **Update Zoho OAuth App**:
   - Update callback URL to: `https://your-app-name.onrender.com/auth/zoho/callback`

### 3. Production OAuth Flow

1. Visit your deployed app
2. Click "Connect with Zoho"
3. Complete OAuth flow
4. Save the returned tokens to Render environment variables:
   - `ZOHO_ACCESS_TOKEN`
   - `ZOHO_REFRESH_TOKEN`

## 📡 API Endpoints

### Authentication
- `GET /auth/zoho` - Start OAuth flow
- `GET /auth/zoho/callback` - OAuth callback
- `GET /auth/status` - Check authentication status
- `POST /auth/zoho/revoke` - Revoke authentication

### Zoho Inventory
- `GET /api/zoho/items` - Get all items
- `GET /api/zoho/items/:id` - Get specific item

### Faire Products
- `GET /api/faire/products` - Get all products
- `POST /api/faire/products` - Create product
- `PUT /api/faire/products/:id` - Update product

### Utilities
- `GET /health` - Health check
- `POST /api/bulk/upload` - Bulk upload to Faire

## 🔧 Development

### Available Scripts

**Frontend:**
- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests

**Backend:**
- `npm start` - Start production server
- `npm run dev` - Start with nodemon (auto-restart)

### Key Components

1. **ZohoFaireIntegration.jsx** - Main React component
2. **server.js** - Express server with OAuth handling
3. **OAuth Flow** - Secure token management
4. **API Integration** - Real Zoho and Faire API calls

## 🐛 Troubleshooting

### Common Issues

1. **"Invalid redirect URI"**
   - Verify callback URL in Zoho console matches exactly
   - Check for trailing slashes or extra characters

2. **"Authentication required"**
   - Complete OAuth flow
   - Check if tokens are expired
   - Verify environment variables

3. **CORS errors**
   - Ensure backend is running on port 3001
   - Check API_BASE_URL in frontend .env

4. **Faire upload failures**
   - Verify Faire API token is valid
   - Check product data meets Faire requirements
   - Review error messages in console

### Debug Steps

1. Check `/health` endpoint
2. Verify `/auth/status` shows authenticated
3. Test `/api/zoho/items` manually
4. Review browser console for errors
5. Check server logs for API responses

## 📊 Monitoring

- **Health Check**: `GET /health`
- **Auth Status**: `GET /auth/status`
- **Logs**: Check Render logs for detailed error information

## 🔒 Security

- OAuth 2.0 for secure authentication
- Environment variables for sensitive data
- Automatic token refresh
- No hardcoded credentials

## 📄 License

MIT License - feel free to modify and distribute.

## 🆘 Support

For issues:
- **Zoho API**: [Zoho Developer Documentation](https://www.zoho.com/inventory/api/v1/)
- **Faire API**: [Faire API Documentation](https://faire.github.io/external-api-v2-docs/)
- **Render**: [Render Documentation](https://render.com/docs)

---

Built with ❤️ using React, Material-UI, Express.js, and the power of modern web APIs.