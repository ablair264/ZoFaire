const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configure multer for file uploads
const upload = multer({ 
    dest: 'uploads/',
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 10 // Max 10 files per request
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
        }
    }
});

// Helper function to run Python image processor
const runImageProcessor = (inputData, outputDir, options = {}) => {
    return new Promise((resolve, reject) => {
        const args = [
            path.join(__dirname, 'image-processing/zoho_faire_processor.py'),
            '--input', inputData,
            '--output', outputDir
        ];
        
        if (options.padding) args.push('--padding', options.padding.toString());
        if (options.quality) args.push('--quality', options.quality.toString());
        if (options.noDownload) args.push('--no-download');
        
        const python = spawn('python3', args);
        let stdout = '';
        let stderr = '';
        
        python.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        python.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        python.on('close', (code) => {
            if (code === 0) {
                try {
                    // Try to parse JSON output
                    const result = JSON.parse(stdout.split('\n').pop() || '{}');
                    resolve({ success: true, data: result, logs: stdout });
                } catch (e) {
                    resolve({ success: true, logs: stdout });
                }
            } else {
                reject(new Error(`Python script failed with code ${code}: ${stderr}`));
            }
        });
        
        python.on('error', (error) => {
            reject(new Error(`Failed to start Python script: ${error.message}`));
        });
    });
};

// Middleware
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'https://zofaire-frontend.netlify.app',
            'https://zofaire.netlify.app',
            /https:\/\/.*--zofaire.*\.netlify\.app$/ // Allow Netlify preview URLs
        ];
        
        const allowed = allowedOrigins.some(allowed => {
            if (allowed instanceof RegExp) {
                return allowed.test(origin);
            }
            return allowed === origin;
        });
        
        if (allowed) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/uploads', express.static('uploads')); // Serve uploaded files
app.use('/processed-images', express.static('processed-images')); // Serve processed images

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// In-memory token storage (use Redis/database in production)
let tokenStorage = {
    zoho_access_token: process.env.ZOHO_ACCESS_TOKEN || null,
    zoho_refresh_token: process.env.ZOHO_REFRESH_TOKEN || null,
    zoho_expires_at: null
};

// Initialize tokens on startup if refresh token exists
const initializeTokens = async () => {
    if (tokenStorage.zoho_refresh_token && !tokenStorage.zoho_expires_at) {
        console.log('🔄 Found refresh token in environment, initializing access token...');
        try {
            await refreshZohoToken();
            console.log('✅ Access token initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize access token:', error.message);
            console.log('   You may need to re-authenticate at /auth/zoho');
        }
    }
};

// Environment variables validation
const requiredEnvVars = [
    'ZOHO_CLIENT_ID',
    'ZOHO_CLIENT_SECRET',
    'ZOHO_ORGANIZATION_ID',
    'FAIRE_ACCESS_TOKEN'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
    console.log('Missing environment variables:', missingEnvVars);
    console.log('OAuth flow will be required for missing Zoho credentials');
}

// Zoho OAuth configuration - EU REGION
const ZOHO_OAUTH_BASE = 'https://accounts.zoho.eu/oauth/v2'; // Always use EU
const ZOHO_BASE_URL = 'https://www.zohoapis.eu/inventory/v1'; // Always use EU API
const REDIRECT_URI = `${process.env.BASE_URL || 'https://zofaire.onrender.com'}/auth/zoho/callback`;
const ZOHO_SCOPES = 'ZohoInventory.FullAccess.all';

// Faire API configuration
const FAIRE_BASE_URL = 'https://www.faire.com/api/v1';
const faireHeaders = {
    'X-FAIRE-ACCESS-TOKEN': process.env.FAIRE_ACCESS_TOKEN,
    'Content-Type': 'application/json'
};

// Helper function to get valid Zoho headers
const getZohoHeaders = async () => {
    // Check if we have a valid access token
    if (!tokenStorage.zoho_access_token) {
        throw new Error('No Zoho access token available. Please authenticate first.');
    }

    // Check if token is expired and refresh if needed
    if (tokenStorage.zoho_expires_at && Date.now() >= tokenStorage.zoho_expires_at) {
        await refreshZohoToken();
    }

    return {
        'Authorization': `Zoho-oauthtoken ${tokenStorage.zoho_access_token}`,
        'Content-Type': 'application/json',
        'X-com-zoho-inventory-organizationid': process.env.ZOHO_ORGANIZATION_ID // Required for EU
    };
};

// Refresh Zoho access token
const refreshZohoToken = async () => {
    if (!tokenStorage.zoho_refresh_token) {
        throw new Error('No refresh token available. Re-authentication required.');
    }

    console.log('🔄 Attempting to refresh Zoho access token...');
    console.log('   Using refresh token:', tokenStorage.zoho_refresh_token.substring(0, 20) + '...');
    
    try {
        const response = await axios.post(`${ZOHO_OAUTH_BASE}/token`, null, {
            params: {
                refresh_token: tokenStorage.zoho_refresh_token,
                client_id: process.env.ZOHO_CLIENT_ID,
                client_secret: process.env.ZOHO_CLIENT_SECRET,
                grant_type: 'refresh_token'
            }
        });

        const data = response.data;
        
        // Check for Zoho-specific errors
        if (data.error) {
            console.error('❌ Zoho returned error:', data.error, data.error_description);
            throw new Error(data.error_description || data.error);
        }
        
        tokenStorage.zoho_access_token = data.access_token;
        tokenStorage.zoho_expires_at = Date.now() + (data.expires_in * 1000);
        
        console.log('✅ Zoho token refreshed successfully');
        console.log('   New access token:', data.access_token.substring(0, 20) + '...');
        console.log('   Expires in:', Math.floor(data.expires_in / 60), 'minutes');
        
        return data.access_token;
    } catch (error) {
        const errorDetails = error.response?.data || {};
        console.error('❌ Error refreshing Zoho token:');
        console.error('   Status:', error.response?.status);
        console.error('   Error:', errorDetails.error || error.message);
        console.error('   Description:', errorDetails.error_description);
        
        // Provide more specific error messages
        if (errorDetails.error === 'invalid_client') {
            throw new Error('Invalid Client ID or Secret. Check your EU OAuth credentials.');
        } else if (errorDetails.error === 'invalid_grant') {
            throw new Error('Refresh token is invalid or expired. Re-authentication required.');
        } else {
            throw new Error(errorDetails.error_description || 'Failed to refresh Zoho token');
        }
    }
};

// Helper function to handle API errors
const handleApiError = (error, source) => {
    console.error(`${source} API Error:`, error.response?.data || error.message);
    return {
        success: false,
        message: error.response?.data?.message || error.message,
        status: error.response?.status || 500
    };
};

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        environment: {
            zoho_configured: !!tokenStorage.zoho_access_token,
            faire_configured: !!process.env.FAIRE_ACCESS_TOKEN,
            zoho_oauth_configured: !!(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET)
        }
    });
});

// Zoho OAuth Routes

// Step 1: Redirect to Zoho for authorization
app.get('/auth/zoho', (req, res) => {
    const authUrl = `${ZOHO_OAUTH_BASE}/auth?` +
        `scope=${encodeURIComponent(ZOHO_SCOPES)}&` +
        `client_id=${process.env.ZOHO_CLIENT_ID}&` +
        `response_type=code&` +
        `access_type=offline&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    
    res.redirect(authUrl);
});

// Step 2: Handle OAuth callback from Zoho
app.get('/auth/zoho/callback', async (req, res) => {
    const { code, error } = req.query;
    
    if (error) {
        return res.status(400).send(`
            <html>
                <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
                    <h2 style="color: #f44336;">Authentication Failed</h2>
                    <p>Error: ${error}</p>
                    <a href="/auth/zoho" style="background: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Try Again</a>
                </body>
            </html>
        `);
    }

    if (!code) {
        return res.status(400).send(`
            <html>
                <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
                    <h2 style="color: #f44336;">Authentication Failed</h2>
                    <p>No authorization code received</p>
                    <a href="/auth/zoho" style="background: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Try Again</a>
                </body>
            </html>
        `);
    }

    try {
        // Exchange authorization code for access token
        const response = await axios.post(`${ZOHO_OAUTH_BASE}/token`, null, {
            params: {
                grant_type: 'authorization_code',
                client_id: process.env.ZOHO_CLIENT_ID,
                client_secret: process.env.ZOHO_CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                code: code
            }
        });

        const data = response.data;
        
        // Store tokens
        tokenStorage.zoho_access_token = data.access_token;
        tokenStorage.zoho_refresh_token = data.refresh_token;
        tokenStorage.zoho_expires_at = Date.now() + (data.expires_in * 1000);
        
        console.log('Zoho OAuth successful. Tokens stored.');
        console.log('Access token received:', data.access_token ? 'Yes' : 'No');
        console.log('Refresh token received:', data.refresh_token ? 'Yes' : 'No');
        
        res.send(`
            <html>
                <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
                    <h2 style="color: #4CAF50;">✅ Authentication Successful!</h2>
                    <p>Zoho Inventory access has been granted.</p>
                    <p><strong>Access Token:</strong> ${data.access_token ? data.access_token.substring(0, 30) + '...' : 'Not received'}</p>
                    <p><strong>Refresh Token:</strong> ${data.refresh_token ? data.refresh_token.substring(0, 30) + '...' : 'Not received'}</p>
                    <p><strong>Expires in:</strong> ${data.expires_in ? Math.floor(data.expires_in / 3600) + ' hours' : 'Unknown'}</p>
                    <br>
                    <a href="/" style="background: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-right: 10px;">Go to Dashboard</a>
                    <a href="/auth/status" style="background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Check Status</a>
                    
                    <div style="margin-top: 30px; padding: 20px; background: #f5f5f5; border-radius: 8px; text-align: left;">
                        <h3>⚠️ Important: Add These to Render Environment Variables</h3>
                        <p>Copy and add these exact values to your Render dashboard:</p>
                        <code style="display: block; background: white; padding: 15px; margin: 10px 0; border-radius: 4px; word-break: break-all; font-size: 12px;">
                            ZOHO_ACCESS_TOKEN=${data.access_token || 'TOKEN_NOT_RECEIVED'}<br><br>
                            ZOHO_REFRESH_TOKEN=${data.refresh_token || 'REFRESH_TOKEN_NOT_RECEIVED'}<br><br>
                            ZOHO_BASE_URL=https://www.zohoapis.eu/inventory/v1<br><br>
                            ZOHO_REGION=eu
                        </code>
                        <p><strong>Steps:</strong></p>
                        <ol>
                            <li>Go to Render Dashboard → Your Service → Environment</li>
                            <li>Add the above environment variables</li>
                            <li>Redeploy your service</li>
                            <li>Refresh your frontend to see connected status</li>
                        </ol>
                    </div>
                </body>
            </html>
        `);

    } catch (error) {
        console.error('OAuth token exchange error:', error.response?.data || error.message);
        const errorData = error.response?.data || {};
        const errorCode = errorData.error || 'unknown_error';
        
        let errorTitle = 'Token Exchange Failed';
        let errorMessage = errorData.error_description || error.message;
        let troubleshootingTips = [];
        
        // EU-specific error handling
        switch(errorCode) {
            case 'invalid_client':
                errorTitle = 'Invalid OAuth Credentials';
                troubleshootingTips = [
                    'Verify Client ID and Secret are from api-console.zoho.eu (not .com)',
                    'Check for extra spaces or quotes in environment variables',
                    'Ensure the OAuth app is approved/active in Zoho EU console',
                    'Try regenerating Client Secret in Zoho EU console'
                ];
                break;
            case 'invalid_grant':
                errorTitle = 'Invalid or Expired Authorization Code';
                troubleshootingTips = [
                    'Authorization codes expire within 1 minute',
                    'Complete the OAuth flow quickly after authorization',
                    'Clear cookies for zoho.eu and try again',
                    'Ensure redirect URI matches exactly'
                ];
                break;
            case 'redirect_uri_mismatch':
                errorTitle = 'Redirect URI Mismatch';
                errorMessage = `Expected: ${REDIRECT_URI}`;
                troubleshootingTips = [
                    'The redirect URI must match EXACTLY in Zoho OAuth app',
                    'No trailing slash allowed',
                    'Case-sensitive - check capitalization',
                    'Must use https:// protocol'
                ];
                break;
            default:
                troubleshootingTips = [
                    'Ensure you are using Zoho EU account (not US)',
                    'Check all credentials are from api-console.zoho.eu',
                    'Verify Organization ID is correct',
                    'Try regenerating OAuth credentials'
                ];
        }
        
        res.status(500).send(`
            <html>
                <body style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
                    <h2 style="color: #f44336;">❌ ${errorTitle}</h2>
                    <div style="background: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Error Code:</strong> ${errorCode}</p>
                        <p><strong>Message:</strong> ${errorMessage}</p>
                    </div>
                    
                    <h3>🔍 Troubleshooting Tips:</h3>
                    <ul style="text-align: left; line-height: 1.8;">
                        ${troubleshootingTips.map(tip => `<li>${tip}</li>`).join('')}
                    </ul>
                    
                    <h3>📋 Your Configuration:</h3>
                    <pre style="background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: left; overflow-x: auto;">
OAuth Endpoint: ${ZOHO_OAUTH_BASE}
API Endpoint: ${ZOHO_BASE_URL}
Redirect URI: ${REDIRECT_URI}
Client ID Set: ${process.env.ZOHO_CLIENT_ID ? 'Yes' : 'No'}
Org ID Set: ${process.env.ZOHO_ORGANIZATION_ID ? 'Yes' : 'No'}
Region: EU</pre>
                    
                    <h3>🚀 Next Steps:</h3>
                    <ol style="text-align: left; line-height: 1.8;">
                        <li>Visit <a href="https://api-console.zoho.eu/" target="_blank">Zoho EU API Console</a></li>
                        <li>Verify your OAuth app configuration</li>
                        <li>Check redirect URI matches exactly</li>
                        <li>Update environment variables if needed</li>
                    </ol>
                    
                    <div style="margin-top: 30px;">
                        <a href="/auth/zoho/debug" style="background: #FF9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-right: 10px;">View Debug Info</a>
                        <a href="/auth/zoho" style="background: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Try Again</a>
                    </div>
                </body>
            </html>
        `);
    }
});

// Check authentication status
app.get('/auth/status', async (req, res) => {
    const hasAccessToken = !!tokenStorage.zoho_access_token;
    const hasRefreshToken = !!tokenStorage.zoho_refresh_token;
    const expiresAt = tokenStorage.zoho_expires_at;
    const timeUntilExpiry = expiresAt ? Math.max(0, expiresAt - Date.now()) : 0;
    const isExpired = expiresAt && Date.now() >= expiresAt;
    
    // Try to refresh if expired and we have a refresh token
    let authenticated = hasAccessToken && !isExpired;
    let refreshAttempted = false;
    let refreshError = null;
    
    if (hasRefreshToken && (!hasAccessToken || isExpired)) {
        refreshAttempted = true;
        try {
            await refreshZohoToken();
            authenticated = true;
        } catch (error) {
            refreshError = error.message;
            authenticated = false;
        }
    }
    
    res.json({
        authenticated,
        has_access_token: hasAccessToken,
        has_refresh_token: hasRefreshToken,
        is_expired: isExpired,
        expires_at: tokenStorage.zoho_expires_at ? new Date(tokenStorage.zoho_expires_at).toISOString() : null,
        expires_in_minutes: Math.floor(timeUntilExpiry / (1000 * 60)),
        refresh_attempted: refreshAttempted,
        refresh_error: refreshError,
        region: 'eu',
        api_base: ZOHO_BASE_URL,
        org_id_set: !!process.env.ZOHO_ORGANIZATION_ID
    });
});

// Debug OAuth configuration
app.get('/auth/zoho/debug', (req, res) => {
    const debugInfo = {
        oauth_base: ZOHO_OAUTH_BASE,
        api_base: ZOHO_BASE_URL,
        redirect_uri: REDIRECT_URI,
        client_id_set: !!process.env.ZOHO_CLIENT_ID,
        client_secret_set: !!process.env.ZOHO_CLIENT_SECRET,
        org_id_set: !!process.env.ZOHO_ORGANIZATION_ID,
        region: 'eu',
        scopes: ZOHO_SCOPES,
        auth_url_preview: `${ZOHO_OAUTH_BASE}/auth?scope=${encodeURIComponent(ZOHO_SCOPES)}&client_id=${process.env.ZOHO_CLIENT_ID ? '[SET]' : '[MISSING]'}&response_type=code&access_type=offline&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
    };
    
    res.send(`
        <html>
            <body style="font-family: Arial, sans-serif; padding: 40px;">
                <h2>🔍 Zoho OAuth Debug Information</h2>
                <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="margin-top: 0; color: #1976d2;">🇪🇺 EU Region Configuration Active</h3>
                    <p>Your app is configured for Zoho EU region.</p>
                </div>
                
                <pre style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
${JSON.stringify(debugInfo, null, 2)}
                </pre>
                
                <h3>✅ Configuration Checklist:</h3>
                <ul>
                    <li>${process.env.ZOHO_CLIENT_ID ? '✅' : '❌'} ZOHO_CLIENT_ID is set</li>
                    <li>${process.env.ZOHO_CLIENT_SECRET ? '✅' : '❌'} ZOHO_CLIENT_SECRET is set</li>
                    <li>${process.env.ZOHO_ORGANIZATION_ID ? '✅' : '❌'} ZOHO_ORGANIZATION_ID is set</li>
                    <li>✅ Region: EU (Europe)</li>
                    <li>✅ Using EU OAuth endpoint: ${ZOHO_OAUTH_BASE}</li>
                    <li>✅ Using EU API endpoint: ${ZOHO_BASE_URL}</li>
                </ul>
                
                <h3>🔧 Setup Instructions:</h3>
                <ol>
                    <li>Go to <a href="https://api-console.zoho.eu/" target="_blank">Zoho EU API Console</a></li>
                    <li>Create a new Client ID (Server-based Applications)</li>
                    <li>Set Redirect URI to: <code>${REDIRECT_URI}</code></li>
                    <li>Copy the Client ID and Client Secret to your environment variables</li>
                    <li>Get your Organization ID from Zoho Inventory settings</li>
                </ol>
                
                <h3>🚀 Ready to Authenticate?</h3>
                <p>Once all environment variables are set:</p>
                <a href="/auth/zoho" style="background: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Start OAuth Flow</a>
                
                <div style="margin-top: 30px; padding: 15px; background: #fff3cd; border-radius: 8px;">
                    <h4>⚠️ Important for EU Users:</h4>
                    <ul>
                        <li>You must use <a href="https://api-console.zoho.eu/">api-console.zoho.eu</a> (not .com)</li>
                        <li>Your Zoho account must be on EU data center</li>
                        <li>Organization ID must be from your EU account</li>
                    </ul>
                </div>
            </body>
        </html>
    `);
});

// Force refresh token (for debugging)
app.post('/auth/zoho/refresh', async (req, res) => {
    try {
        if (!tokenStorage.zoho_refresh_token) {
            return res.status(400).json({
                success: false,
                message: 'No refresh token available'
            });
        }
        
        const oldToken = tokenStorage.zoho_access_token;
        await refreshZohoToken();
        
        res.json({
            success: true,
            message: 'Token refreshed successfully',
            old_token: oldToken ? oldToken.substring(0, 20) + '...' : null,
            new_token: tokenStorage.zoho_access_token.substring(0, 20) + '...',
            expires_at: new Date(tokenStorage.zoho_expires_at).toISOString()
        });
    } catch (error) {
        console.error('Manual refresh failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to refresh token',
            error: error.message
        });
    }
});

// Revoke Zoho authentication
app.post('/auth/zoho/revoke', async (req, res) => {
    try {
        if (tokenStorage.zoho_access_token) {
            await axios.post(`${ZOHO_OAUTH_BASE}/token/revoke`, null, {
                params: {
                    token: tokenStorage.zoho_access_token
                }
            });
        }
        
        // Clear stored tokens
        tokenStorage = {
            zoho_access_token: null,
            zoho_refresh_token: null,
            zoho_expires_at: null
        };
        
        res.json({ success: true, message: 'Authentication revoked successfully' });
    } catch (error) {
        console.error('Error revoking token:', error);
        res.json({ success: true, message: 'Tokens cleared locally' });
    }
});

// Zoho Inventory Routes

// Helper function to fetch all pages of items
const fetchAllZohoItems = async (zohoHeaders, options = {}) => {
    const allItems = [];
    let page = 1;
    let hasMore = true;
    const perPage = 200; // Max allowed by Zoho
    const maxPages = options.maxPages || 100;
    const delayMs = options.delayMs || 300;
    const filterInactive = options.filterInactive !== false; // Default true
    const manufacturer = options.manufacturer || null;
    
    console.log('🔄 Starting to fetch all Zoho items...');
    console.log(`   Settings: ${perPage} items/page, ${delayMs}ms delay, max ${maxPages} pages`);
    if (filterInactive) console.log('   Filtering: Active items only');
    if (manufacturer) console.log(`   Filtering: Only manufacturer "${manufacturer}"`);
    
    // Add retry logic for rate limiting
    const makeRequest = async (attempt = 1) => {
        try {
            // Build filter string for Zoho API
            const filters = [];
            
            // Always filter by active status if filterInactive is true
            if (filterInactive) {
                filters.push('Status.StartsWith(Active)');
            }
            
            const params = {
                page: page,
                per_page: perPage
            };
            
            // Add filter string if we have filters
            if (filters.length > 0) {
                params.filter_by = filters.join(' and ');
            }
            
            console.log(`   Requesting page ${page} with params:`, params);
            
            const response = await axios.get(
                `${ZOHO_BASE_URL}/items`,
                {
                    headers: zohoHeaders,
                    params: params
                }
            );
            return response;
        } catch (error) {
            if (error.response?.status === 429 && attempt < 3) {
                // Rate limited, wait and retry
                const retryDelay = Math.pow(2, attempt) * 1000; // Exponential backoff
                console.log(`   ⏳ Rate limited, retrying in ${retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return makeRequest(attempt + 1);
            }
            throw error;
        }
    };
    
    while (hasMore && page <= maxPages) {
        try {
            const response = await makeRequest();
            
            if (response.data.code === 0) {
                let items = response.data.items || [];
                
                // Double-check status filter on our side (in case Zoho API doesn't filter properly)
                if (filterInactive) {
                    const beforeCount = items.length;
                    items = items.filter(item => 
                        item.status && item.status.toLowerCase() === 'active'
                    );
                    if (beforeCount !== items.length) {
                        console.log(`   Filtered out ${beforeCount - items.length} inactive items`);
                    }
                }
                
                // Apply manufacturer filter if specified
                if (manufacturer) {
                    items = items.filter(item => 
                        item.manufacturer?.toLowerCase() === manufacturer.toLowerCase() ||
                        item.brand?.toLowerCase() === manufacturer.toLowerCase()
                    );
                }
                
                allItems.push(...items);
                
                const pageContext = response.data.page_context || {};
                hasMore = pageContext.has_more_page || false;
                const total = pageContext.total || 'unknown';
                
                console.log(`   ✓ Page ${page}: ${items.length} items after filtering (Total collected: ${allItems.length})`);
                
                if (hasMore) {
                    page++;
                    // Progressive delay - longer waits as we fetch more pages
                    const progressiveDelay = delayMs + (Math.floor(page / 10) * 100);
                    await new Promise(resolve => setTimeout(resolve, progressiveDelay));
                } else {
                    console.log(`✅ Completed: ${allItems.length} total items fetched`);
                }
            } else {
                console.error(`❌ Error on page ${page}:`, response.data.message);
                hasMore = false;
            }
        } catch (error) {
            console.error(`❌ Failed to fetch page ${page}:`, error.message);
            
            // If we've already fetched some items, return what we have
            if (allItems.length > 0) {
                console.log(`⚠️  Partial success: Returning ${allItems.length} items`);
                break;
            }
            throw error;
        }
    }
    
    if (page > maxPages && hasMore) {
        console.log(`⚠️  Reached max pages limit (${maxPages}). There may be more items.`);
        console.log(`   To fetch more, increase maxPages parameter.`);
    }
    
    console.log(`📊 Final count: ${allItems.length} active items`);
    
    return allItems;
};

// Get all items from Zoho Inventory
app.get('/api/zoho/items', async (req, res) => {
    try {
        // Check if user wants paginated results or all items
        const fetchAll = req.query.fetchAll === 'true';
        const page = req.query.page || 1;
        const per_page = req.query.per_page || 200;
        const filterInactive = req.query.filterInactive !== 'false'; // Default true
        const manufacturer = req.query.manufacturer || null;
        
        const zohoHeaders = await getZohoHeaders();
        
        if (fetchAll) {
            // Fetch all items with pagination
            console.log('📥 Request to fetch ALL items from Zoho');
            const allItems = await fetchAllZohoItems(zohoHeaders, {
                maxPages: parseInt(req.query.maxPages) || 100,
                delayMs: parseInt(req.query.delayMs) || 300,
                filterInactive: filterInactive,
                manufacturer: manufacturer
            });
            
            res.json({
                success: true,
                items: allItems,
                total: allItems.length,
                fetchedAll: true,
                filters: {
                    excludedInactive: filterInactive,
                    manufacturer: manufacturer
                },
                page_context: {
                    page: 1,
                    per_page: allItems.length,
                    total: allItems.length,
                    has_more_page: false
                }
            });
        } else {
            // Single page request (existing behavior)
            const filters = [];
            
            // Build filter for active status
            if (filterInactive) {
                filters.push('Status.StartsWith(Active)');
            }
            
            const params = {
                page: page,
                per_page: per_page
            };
            
            // Add filter string if we have filters
            if (filters.length > 0) {
                params.filter_by = filters.join(' and ');
            }
            
            console.log('📥 Fetching Zoho items with params:', params);
            
            const response = await axios.get(
                `${ZOHO_BASE_URL}/items`,
                {
                    headers: zohoHeaders,
                    params: params
                }
            );

            if (response.data.code === 0) {
                let items = response.data.items;
                
                // Double-check status filter on our side
                if (filterInactive) {
                    const beforeCount = items.length;
                    items = items.filter(item => 
                        item.status && item.status.toLowerCase() === 'active'
                    );
                    if (beforeCount !== items.length) {
                        console.log(`Filtered out ${beforeCount - items.length} inactive items`);
                    }
                }
                
                // Apply manufacturer filter if specified
                if (manufacturer) {
                    items = items.filter(item => 
                        item.manufacturer?.toLowerCase() === manufacturer.toLowerCase() ||
                        item.brand?.toLowerCase() === manufacturer.toLowerCase()
                    );
                }
                
                res.json({
                    success: true,
                    items: items,
                    page_context: response.data.page_context,
                    filters: {
                        excludedInactive: filterInactive,
                        manufacturer: manufacturer
                    }
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: response.data.message
                });
            }
        }

    } catch (error) {
        if (error.message.includes('No Zoho access token')) {
            return res.status(401).json({
                success: false,
                message: 'Please authenticate with Zoho first',
                auth_url: '/auth/zoho'
            });
        }
        
        const errorResponse = handleApiError(error, 'Zoho');
        res.status(errorResponse.status).json(errorResponse);
    }
});

// Get count of total items in Zoho Inventory
app.get('/api/zoho/items/count', async (req, res) => {
    try {
        const zohoHeaders = await getZohoHeaders();
        
        // Fetch just one item to get the page context with total count
        const response = await axios.get(
            `${ZOHO_BASE_URL}/items`,
            {
                headers: zohoHeaders,
                params: {
                    page: 1,
                    per_page: 1
                }
            }
        );

        if (response.data.code === 0) {
            const pageContext = response.data.page_context || {};
            res.json({
                success: true,
                total: pageContext.total || 0,
                has_more_page: pageContext.has_more_page || false
            });
        } else {
            res.status(400).json({
                success: false,
                message: response.data.message
            });
        }

    } catch (error) {
        if (error.message.includes('No Zoho access token')) {
            return res.status(401).json({
                success: false,
                message: 'Please authenticate with Zoho first',
                auth_url: '/auth/zoho'
            });
        }
        
        const errorResponse = handleApiError(error, 'Zoho');
        res.status(errorResponse.status).json(errorResponse);
    }
});

// Get a specific item from Zoho Inventory
app.get('/api/zoho/items/:item_id', async (req, res) => {
    try {
        const { item_id } = req.params;
        const zohoHeaders = await getZohoHeaders();
        
        const response = await axios.get(
            `${ZOHO_BASE_URL}/items/${item_id}`,
            {
                headers: zohoHeaders,
                params: {
                    // organization_id is now in headers, not params
                }
            }
        );

        if (response.data.code === 0) {
            res.json({
                success: true,
                item: response.data.item
            });
        } else {
            res.status(400).json({
                success: false,
                message: response.data.message
            });
        }

    } catch (error) {
        if (error.message.includes('No Zoho access token')) {
            return res.status(401).json({
                success: false,
                message: 'Please authenticate with Zoho first',
                auth_url: '/auth/zoho'
            });
        }
        
        const errorResponse = handleApiError(error, 'Zoho');
        res.status(errorResponse.status).json(errorResponse);
    }
});

// Faire API Routes

// Get all products from Faire
app.get('/api/faire/products', async (req, res) => {
    try {
        const limit = req.query.limit || 50;
        const page = req.query.page || 1;
        
        const response = await axios.get(
            `${FAIRE_BASE_URL}/products`,
            {
                headers: faireHeaders,
                params: {
                    limit: limit,
                    page: page
                }
            }
        );

        res.json({
            success: true,
            products: response.data.products,
            pagination: response.data.pagination
        });

    } catch (error) {
        const errorResponse = handleApiError(error, 'Faire');
        res.status(errorResponse.status).json(errorResponse);
    }
});

// Create a new product on Faire
app.post('/api/faire/products', async (req, res) => {
    try {
        const productData = req.body;
        
        // Validate required fields
        const requiredFields = ['name', 'sku', 'wholesale_price_cents', 'retail_price_cents'];
        const missingFields = requiredFields.filter(field => !productData[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        // Ensure options array exists and has at least one option
        if (!productData.options || productData.options.length === 0) {
            productData.options = [{
                name: "Default",
                sku: productData.sku,
                wholesale_price_cents: productData.wholesale_price_cents,
                retail_price_cents: productData.retail_price_cents,
                inventory_quantity: productData.inventory_quantity || 0,
                minimum_order_quantity: productData.minimum_order_quantity || 1,
                unit_multiplier: productData.unit_multiplier || 1
            }];
        }

        const response = await axios.post(
            `${FAIRE_BASE_URL}/products`,
            productData,
            {
                headers: faireHeaders
            }
        );

        res.json({
            success: true,
            product: response.data.product
        });

    } catch (error) {
        const errorResponse = handleApiError(error, 'Faire');
        res.status(errorResponse.status).json(errorResponse);
    }
});

// Update a product on Faire
app.put('/api/faire/products/:product_id', async (req, res) => {
    try {
        const { product_id } = req.params;
        const updateData = req.body;
        
        const response = await axios.put(
            `${FAIRE_BASE_URL}/products/${product_id}`,
            updateData,
            {
                headers: faireHeaders
            }
        );

        res.json({
            success: true,
            product: response.data.product
        });

    } catch (error) {
        const errorResponse = handleApiError(error, 'Faire');
        res.status(errorResponse.status).json(errorResponse);
    }
});

// Helper function to map Zoho categories to Faire categories
const mapZohoToFaireCategory = (zohoCategory) => {
    const categoryMap = {
        'Accessories': 'accessories',
        'Clothing': 'apparel',
        'Home & Kitchen': 'home_and_living',
        'Electronics': 'electronics',
        'Beauty': 'beauty_and_wellness',
        'Jewelry': 'jewelry',
        'Bags': 'bags_and_luggage',
        'Shoes': 'shoes'
    };
    
    return categoryMap[zohoCategory] || 'other';
};

// Bulk upload endpoint
app.post('/api/bulk/upload', async (req, res) => {
    try {
        const { items } = req.body;
        
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Items array is required'
            });
        }

        const results = [];
        let successCount = 0;
        let errorCount = 0;

        for (const item of items) {
            try {
                // Transform and upload to Faire
                const faireProduct = {
                    name: item.name,
                    description: item.description,
                    sku: item.sku,
                    wholesale_price_cents: Math.round(item.rate * 100),
                    retail_price_cents: Math.round(item.rate * 2 * 100),
                    category: mapZohoToFaireCategory(item.category_name),
                    inventory_quantity: item.stock_on_hand,
                    unit_multiplier: 1,
                    minimum_order_quantity: 1,
                    brand_name: item.brand || 'Default Brand',
                    options: [{
                        name: "Default",
                        sku: item.sku,
                        wholesale_price_cents: Math.round(item.rate * 100),
                        retail_price_cents: Math.round(item.rate * 2 * 100),
                        inventory_quantity: item.stock_on_hand,
                        minimum_order_quantity: 1,
                        unit_multiplier: 1
                    }]
                };

                const response = await axios.post(
                    `${FAIRE_BASE_URL}/products`,
                    faireProduct,
                    {
                        headers: faireHeaders
                    }
                );

                results.push({
                    item_id: item.item_id,
                    sku: item.sku,
                    success: true,
                    product_id: response.data.product.id
                });
                successCount++;

            } catch (error) {
                results.push({
                    item_id: item.item_id,
                    sku: item.sku,
                    success: false,
                    error: error.response?.data?.message || error.message
                });
                errorCount++;
            }
        }

        res.json({
            success: true,
            results: results,
            summary: {
                total: items.length,
                successful: successCount,
                failed: errorCount
            }
        });

    } catch (error) {
        const errorResponse = handleApiError(error, 'Bulk Upload');
        res.status(errorResponse.status).json(errorResponse);
    }
});

// Image Processing Routes

// Process images from Zoho products
app.post('/api/images/process-zoho', async (req, res) => {
    try {
        const { items, options = {} } = req.body;
        
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Items array is required'
            });
        }
        
        // Create temporary input file
        const timestamp = Date.now();
        const inputFile = path.join(__dirname, `temp_zoho_data_${timestamp}.json`);
        const outputDir = path.join(__dirname, `processed-images/${timestamp}`);
        
        await fs.writeFile(inputFile, JSON.stringify(items, null, 2));
        
        // Process images
        const result = await runImageProcessor(inputFile, outputDir, {
            padding: options.padding || 50,
            quality: options.quality || 85,
            noDownload: !options.downloadImages
        });
        
        // Clean up temp file
        await fs.unlink(inputFile);
        
        res.json({
            success: true,
            message: 'Images processed successfully',
            data: result.data,
            outputDir: `/processed-images/${timestamp}`
        });
        
    } catch (error) {
        console.error('Image processing error:', error);
        res.status(500).json({
            success: false,
            message: 'Image processing failed',
            error: error.message
        });
    }
});

// Upload and process images
app.post('/api/images/upload', upload.array('images', 10), async (req, res) => {
    try {
        const { sku, options = {} } = req.body;
        
        if (!sku) {
            return res.status(400).json({
                success: false,
                message: 'SKU is required'
            });
        }
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No images uploaded'
            });
        }
        
        // Create product data for processing
        const productData = [{
            sku: sku,
            name: req.body.name || sku,
            images: req.files.map(file => file.path)
        }];
        
        const timestamp = Date.now();
        const inputFile = path.join(__dirname, `temp_upload_data_${timestamp}.json`);
        const outputDir = path.join(__dirname, `processed-images/${timestamp}`);
        
        await fs.writeFile(inputFile, JSON.stringify(productData, null, 2));
        
        // Process images
        const result = await runImageProcessor(inputFile, outputDir, {
            padding: parseInt(options.padding) || 50,
            quality: parseInt(options.quality) || 85,
            noDownload: true // Local files, no download needed
        });
        
        // Clean up temp files
        await fs.unlink(inputFile);
        for (const file of req.files) {
            await fs.unlink(file.path);
        }
        
        res.json({
            success: true,
            message: 'Images uploaded and processed successfully',
            data: result.data,
            outputDir: `/processed-images/${timestamp}`
        });
        
    } catch (error) {
        console.error('Image upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Image upload failed',
            error: error.message
        });
    }
});

// Get processing status
app.get('/api/images/status/:timestamp', async (req, res) => {
    try {
        const { timestamp } = req.params;
        const outputDir = path.join(__dirname, `processed-images/${timestamp}`);
        const manifestPath = path.join(outputDir, 'faire_image_manifest.json');
        
        try {
            const manifestData = await fs.readFile(manifestPath, 'utf8');
            const manifest = JSON.parse(manifestData);
            
            res.json({
                success: true,
                manifest: manifest,
                outputDir: `/processed-images/${timestamp}`
            });
        } catch (error) {
            res.status(404).json({
                success: false,
                message: 'Processing results not found'
            });
        }
        
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({
            success: false,
            message: 'Status check failed',
            error: error.message
        });
    }
});

// Integrated workflow: Fetch from Zoho, process images, prepare for Faire
app.post('/api/workflow/process-for-faire', async (req, res) => {
    try {
        const { itemIds, imageOptions = {} } = req.body;
        
        if (!itemIds || !Array.isArray(itemIds)) {
            return res.status(400).json({
                success: false,
                message: 'Item IDs array is required'
            });
        }
        
        // Fetch items from Zoho
        const zohoHeaders = await getZohoHeaders();
        const zohoItems = [];
        
        for (const itemId of itemIds) {
            try {
                const response = await axios.get(
                    `${ZOHO_BASE_URL}/items/${itemId}`,
                    {
                        headers: zohoHeaders
                        // organization_id is now in headers, not params
                    }
                );
                
                if (response.data.code === 0) {
                    const item = response.data.item;
                    // Add image URLs if available
                    const itemData = {
                        ...item,
                        images: item.image_url ? [item.image_url] : []
                    };
                    zohoItems.push(itemData);
                }
            } catch (error) {
                console.error(`Error fetching item ${itemId}:`, error.message);
            }
        }
        
        if (zohoItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid items found in Zoho'
            });
        }
        
        // Process images
        const timestamp = Date.now();
        const inputFile = path.join(__dirname, `temp_workflow_${timestamp}.json`);
        const outputDir = path.join(__dirname, `processed-images/${timestamp}`);
        
        await fs.writeFile(inputFile, JSON.stringify(zohoItems, null, 2));
        
        const result = await runImageProcessor(inputFile, outputDir, {
            padding: imageOptions.padding || 50,
            quality: imageOptions.quality || 85,
            noDownload: false // Download from Zoho URLs
        });
        
        // Clean up temp file
        await fs.unlink(inputFile);
        
        res.json({
            success: true,
            message: 'Workflow completed successfully',
            zohoItems: zohoItems.length,
            imageProcessing: result.data,
            outputDir: `/processed-images/${timestamp}`,
            nextSteps: {
                uploadToFaire: `/api/bulk/upload`,
                viewImages: `/processed-images/${timestamp}`
            }
        });
        
    } catch (error) {
        if (error.message.includes('No Zoho access token')) {
            return res.status(401).json({
                success: false,
                message: 'Please authenticate with Zoho first',
                auth_url: '/auth/zoho'
            });
        }
        
        console.error('Workflow error:', error);
        res.status(500).json({
            success: false,
            message: 'Workflow failed',
            error: error.message
        });
    }
});

// Integrated workflow: Fetch all from Zoho (Simple version without Firebase)
app.post('/api/workflow/complete-sync', async (req, res) => {
    try {
        const { 
            fetchAllItems = true,
            matchImages = false, // Disabled until Firebase is added
            processImages = false,
            options = {} 
        } = req.body;
        
        const workflow = {
            started: new Date().toISOString(),
            steps: []
        };
        
        // Step 1: Fetch all items from Zoho
        let zohoItems = [];
        if (fetchAllItems) {
            console.log('\n📥 Step 1: Fetching all items from Zoho...');
            const zohoHeaders = await getZohoHeaders();
            
            zohoItems = await fetchAllZohoItems(zohoHeaders, {
                maxPages: options.maxPages || 100,
                delayMs: options.delayMs || 300,
                filterInactive: options.filterInactive !== false,
                manufacturer: options.manufacturer || null
            });
            
            workflow.steps.push({
                step: 'fetch_zoho_items',
                success: true,
                itemCount: zohoItems.length
            });
        }
        
        // Step 2: Placeholder for image matching
        if (matchImages) {
            console.log('\n⚠️  Image matching requested but Firebase not configured yet');
            workflow.steps.push({
                step: 'match_firebase_images',
                success: false,
                error: 'Firebase integration pending',
                matched: 0,
                notMatched: zohoItems.length
            });
        }
        
        workflow.completed = new Date().toISOString();
        workflow.duration = Date.now() - new Date(workflow.started).getTime();
        
        res.json({
            success: true,
            workflow: workflow,
            summary: {
                zohoItems: zohoItems.length,
                matchedImages: 0,
                unmatchedImages: zohoItems.length
            },
            data: {
                items: zohoItems.map(item => ({
                    product: item,
                    matched: false,
                    images: [],
                    error: 'Firebase not configured'
                }))
            }
        });
        
    } catch (error) {
        if (error.message.includes('No Zoho access token')) {
            return res.status(401).json({
                success: false,
                message: 'Please authenticate with Zoho first',
                auth_url: '/auth/zoho'
            });
        }
        
        console.error('Workflow error:', error);
        res.status(500).json({
            success: false,
            message: 'Workflow failed',
            error: error.message
        });
    }
});

// API-only server - frontend served by Netlify
// Root endpoint for API documentation
app.get('/', (req, res) => {
    res.json({
        name: 'Zoho to Faire Integration API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/health',
            auth: {
                start: '/auth/zoho',
                callback: '/auth/zoho/callback',
                status: '/auth/status',
                revoke: '/auth/zoho/revoke'
            },
            zoho: {
                items: '/api/zoho/items',
                item: '/api/zoho/items/:id'
            },
            faire: {
                products: '/api/faire/products',
                create: 'POST /api/faire/products',
                update: 'PUT /api/faire/products/:id'
            },
            bulk: {
                upload: 'POST /api/bulk/upload'
            }
        },
        frontend: 'https://zofaire-frontend.netlify.app',
        docs: 'https://github.com/ablair264/ZoFaire'
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

app.listen(PORT, async () => {
    console.log(`\n🚀 ZoFaire Server Started`);
    console.log(`=======================`);
    console.log(`Port: ${PORT}`);
    console.log(`Region: 🇪🇺 EU (Europe)`);
    console.log(`OAuth Base: ${ZOHO_OAUTH_BASE}`);
    console.log(`API Base: ${ZOHO_BASE_URL}`);
    console.log(`Callback URL: ${REDIRECT_URI}`);
    console.log(`\n📋 Environment Status:`);
    console.log(`- ZOHO_CLIENT_ID: ${process.env.ZOHO_CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
    console.log(`- ZOHO_CLIENT_SECRET: ${process.env.ZOHO_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}`);
    console.log(`- ZOHO_ORGANIZATION_ID: ${process.env.ZOHO_ORGANIZATION_ID ? '✅ Set' : '❌ Missing'}`);
    console.log(`- FAIRE_ACCESS_TOKEN: ${process.env.FAIRE_ACCESS_TOKEN ? '✅ Set' : '❌ Missing'}`);
    console.log(`- ZOHO_REFRESH_TOKEN: ${process.env.ZOHO_REFRESH_TOKEN ? '✅ Set' : '❌ Not Set'}`);
    
    // Initialize tokens if refresh token exists
    await initializeTokens();
    
    console.log(`\n🔗 Debug URL: ${process.env.BASE_URL || `http://localhost:${PORT}`}/auth/zoho/debug`);
    console.log(`\n✨ Ready for EU Zoho Integration!\n`);
});