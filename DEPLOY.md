# Render Deployment Guide

This guide covers deploying the Zoho-Faire Integration app to Render with the combined frontend/backend setup.

## 🚀 Quick Deploy to Render

### 1. Prepare Repository

```bash
# Ensure everything is committed
git add .
git commit -m "Production ready deployment"
git push origin main
```

### 2. Create Render Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:

```yaml
Name: zoho-faire-integration
Environment: Node
Branch: main
Root Directory: backend
Build Command: npm install && cd .. && npm run build && mkdir -p build && cp -r build/* ./build/
Start Command: npm start
```

### 3. Environment Variables

Add these in Render Dashboard → Environment:

```bash
# Required - Zoho OAuth
ZOHO_CLIENT_ID=your_zoho_client_id_from_api_console
ZOHO_CLIENT_SECRET=your_zoho_client_secret_from_api_console
ZOHO_ORGANIZATION_ID=your_zoho_org_id

# Required - Faire API
FAIRE_ACCESS_TOKEN=your_faire_api_token

# Required - Deployment
NODE_ENV=production
BASE_URL=https://your-service-name.onrender.com

# Optional - After OAuth completion
ZOHO_ACCESS_TOKEN=will_be_provided_after_oauth
ZOHO_REFRESH_TOKEN=will_be_provided_after_oauth
```

### 4. Deploy and Test

1. **Deploy**: Render will automatically build and deploy
2. **Check Health**: Visit `https://your-app.onrender.com/health`
3. **Authenticate**: Visit your app and click "Connect with Zoho"
4. **Save Tokens**: After OAuth, add the provided tokens to environment variables

## 🔧 Render Configuration Details

### Build Process

The build process does the following:
1. Installs backend dependencies (`npm install`)
2. Moves to root and builds React app (`npm run build`)
3. Creates build directory in backend
4. Copies React build to backend build directory
5. Backend serves the React app at root path

### File Structure After Build

```
backend/
├── server.js          # Express server
├── package.json       # Backend dependencies
├── build/             # React app build
│   ├── index.html
│   ├── static/
│   └── ...
└── node_modules/      # Backend dependencies
```

## 🔐 OAuth Setup for Production

### 1. Update Zoho OAuth App

1. Go to [Zoho API Console](https://api-console.zoho.com/)
2. Edit your OAuth application
3. Update **Authorized Redirect URIs** to:
   ```
   https://your-service-name.onrender.com/auth/zoho/callback
   ```

### 2. Complete OAuth Flow

1. Visit your deployed app
2. Click "Connect with Zoho"
3. Grant permissions
4. Copy the provided tokens
5. Add tokens to Render environment variables:
   - `ZOHO_ACCESS_TOKEN`
   - `ZOHO_REFRESH_TOKEN`

## 📊 Monitoring

### Health Checks

- **App Health**: `https://your-app.onrender.com/health`
- **Auth Status**: `https://your-app.onrender.com/auth/status`

### Logs

- View logs in Render Dashboard → Logs tab
- Monitor for authentication and API errors

## 🐛 Troubleshooting

### Common Deploy Issues

1. **Build Fails**
   ```bash
   # Check if all dependencies are in package.json
   # Ensure build script runs locally first
   npm run build-production
   ```

2. **OAuth Callback URL Mismatch**
   ```bash
   # Verify in Zoho console:
   # https://your-actual-service-name.onrender.com/auth/zoho/callback
   ```

3. **Environment Variables Not Set**
   ```bash
   # Check all required vars are set in Render dashboard
   # Redeploy after adding missing variables
   ```

4. **API Errors**
   ```bash
   # Check logs for specific error messages
   # Verify API tokens are valid and not expired
   ```

### Debug Steps

1. **Check Build Logs**: Render Dashboard → Deploy tab
2. **Check Runtime Logs**: Render Dashboard → Logs tab  
3. **Test Endpoints**: 
   - `/health` - Service status
   - `/auth/status` - Authentication status
   - `/api/zoho/items` - API functionality

## 🔄 Updates and Redeploys

### Auto-Deploy

Render automatically redeploys when you push to the main branch:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

### Manual Deploy

Use the "Manual Deploy" button in Render Dashboard if needed.

### Environment Variable Updates

1. Update variables in Render Dashboard
2. Click "Deploy Latest Commit" to restart with new variables

## 💡 Production Tips

1. **Use Render's Persistent Disks** for file storage if needed
2. **Monitor usage** in Render Dashboard to avoid overages
3. **Set up alerts** for downtime monitoring
4. **Regular backups** of your configuration and tokens
5. **Log rotation** - Render handles this automatically

## 🚨 Security Checklist

- ✅ All API keys in environment variables (not code)
- ✅ OAuth callback URL uses HTTPS
- ✅ Tokens stored securely in Render environment
- ✅ No sensitive data in git repository
- ✅ Regular token rotation (optional but recommended)

## 📞 Support

- **Render Issues**: [Render Support](https://render.com/docs)
- **Zoho API**: [Zoho Documentation](https://www.zoho.com/inventory/api/v1/)
- **Faire API**: [Faire Documentation](https://faire.github.io/external-api-v2-docs/)

---

**Deployment Checklist:**
- [ ] Repository pushed to GitHub
- [ ] Render service created and configured
- [ ] Environment variables set
- [ ] OAuth app callback URL updated
- [ ] Service deployed successfully
- [ ] Health check passes
- [ ] OAuth flow completed
- [ ] Tokens saved to environment variables
- [ ] Full functionality tested