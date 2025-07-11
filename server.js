const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const multer = require('multer');
require('dotenv').config();

// Import Firebase integration
const {
    initializeFirebase,
    getProductImages,
    downloadImage,
    getAvailableBrands,
    matchProductsWithImages,
    uploadProcessedImage
} = require('./firebase-integration');

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
            console.log('    You may need to re-authenticate at /auth/zoho');
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
    console.log('    Using refresh token:', tokenStorage.zoho_refresh_token.substring(0, 20) + '...');
    
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
        console.log('    New access token:', data.access_token.substring(0, 20) + '...');
        console.log('    Expires in:', Math.floor(data.expires_in / 60), 'minutes');
        
        return data.access_token;
    } catch (error) {
        const errorDetails = error.response?.data || {};
        console.error('❌ Error refreshing Zoho token:');
        console.error('    Status:', error.response?.status);
        console.error('    Error:', errorDetails.error || error.message);
        console.error('    Description:', errorDetails.error_description);
        
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
    console.log(`    Settings: ${perPage} items/page, ${delayMs}ms delay, max ${maxPages} pages`);
    if (filterInactive) console.log('    Filtering: Active items only');
    if (manufacturer) console.log(`    Filtering: Only manufacturer "${manufacturer}"`);
    
    // Add retry logic for rate limiting
    const makeRequest = async (attempt = 1) => {
        try {
            const params = {
                page: page,
                per_page: perPage
            };
            
            // Note: We'll filter status client-side as Zoho's filter_by syntax varies
            console.log(`    Requesting page ${page}`);
            
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
                console.log(`    ⏳ Rate limited, retrying in ${retryDelay}ms...`);
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
                const originalCount = items.length;
                
                // Filter by status on our side
                if (filterInactive) {
                    items = items.filter(item => 
                        item.status && item.status.toLowerCase() === 'active'
                    );
                }
                
                // Apply manufacturer filter if specified
                if (manufacturer) {
                    items = items.filter(item => 
                        item.manufacturer?.toLowerCase() === manufacturer.toLowerCase() ||
                        item.brand?.toLowerCase() === manufacturer.toLowerCase()
                    );
                }
                
                const filteredCount = originalCount - items.length;
                if (filteredCount > 0) {
                    console.log(`    Filtered out ${filteredCount} items (inactive/non-matching)`);
                }
                
                allItems.push(...items);
                
                const pageContext = response.data.page_context || {};
                hasMore = pageContext.has_more_page || false;
                const total = pageContext.total || 'unknown';
                
                console.log(`    ✓ Page ${page}: ${items.length} items after filtering (Total collected: ${allItems.length})`);
                
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
        console.log(`    To fetch more, increase maxPages parameter.`);
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
            // Fetch single page of items
            console.log(`📥 Request to fetch Zoho items - Page: ${page}, Per Page: ${per_page}`);
            const response = await axios.get(`${ZOHO_BASE_URL}/items`, {
                headers: zohoHeaders,
                params: {
                    page: page,
                    per_page: per_page
                }
            });
            
            if (response.data.code === 0) {
                let items = response.data.items || [];
                // Apply server-side filtering for active status if requested
                if (filterInactive) {
                    items = items.filter(item => item.status && item.status.toLowerCase() === 'active');
                }
                // Apply manufacturer filter if specified
                if (manufacturer) {
                    items = items.filter(item => 
                        item.manufacturer?.toLowerCase() === manufacturer.toLowerCase() ||
                        item.brand?.toLowerCase() === manufacturer.toLowerCase()
                    );
                }

                res.json({ success: true, ...response.data, items: items, filters: { excludedInactive: filterInactive, manufacturer: manufacturer } });
            } else {
                res.status(response.data.code).json({ success: false, message: response.data.message });
            }
        }
    } catch (error) {
        const apiError = handleApiError(error, 'Zoho Inventory (Items)');
        res.status(apiError.status).json(apiError);
    }
});

// Update an item in Zoho Inventory
app.put('/api/zoho/items/:itemId', async (req, res) => {
    try {
        const itemId = req.params.itemId;
        const updatedItemData = req.body; // Data to update
        
        const zohoHeaders = await getZohoHeaders();
        
        console.log(`⬆️ Updating Zoho item ${itemId} with data:`, updatedItemData);
        
        const response = await axios.put(
            `${ZOHO_BASE_URL}/items/${itemId}`,
            updatedItemData,
            { headers: zohoHeaders }
        );
        
        if (response.data.code === 0) {
            console.log(`✅ Item ${itemId} updated successfully in Zoho.`);
            res.json({ success: true, message: 'Item updated successfully', item: response.data.item });
        } else {
            console.error(`❌ Error updating Zoho item ${itemId}:`, response.data.message);
            res.status(response.data.code).json({ success: false, message: response.data.message });
        }
    } catch (error) {
        const apiError = handleApiError(error, 'Zoho Inventory (Update Item)');
        res.status(apiError.status).json(apiError);
    }
});

// Get a single item by ID from Zoho Inventory
app.get('/api/zoho/items/:itemId', async (req, res) => {
    try {
        const itemId = req.params.itemId;
        const zohoHeaders = await getZohoHeaders();
        
        console.log(`🔎 Fetching Zoho item by ID: ${itemId}`);
        const response = await axios.get(`${ZOHO_BASE_URL}/items/${itemId}`, {
            headers: zohoHeaders
        });
        
        if (response.data.code === 0) {
            res.json({ success: true, item: response.data.item });
        } else {
            res.status(response.data.code).json({ success: false, message: response.data.message });
        }
    } catch (error) {
        const apiError = handleApiError(error, 'Zoho Inventory (Single Item)');
        res.status(apiError.status).json(apiError);
    }
});


// Faire API Routes

// Get product listings from Faire
app.get('/api/faire/products', async (req, res) => {
    try {
        if (!process.env.FAIRE_ACCESS_TOKEN) {
            throw new Error('Faire Access Token is not configured.');
        }
        
        const page = req.query.page || 1;
        const limit = req.query.limit || 50;
        
        console.log(`📥 Fetching Faire products - Page: ${page}, Limit: ${limit}`);
        
        const response = await axios.get(`${FAIRE_BASE_URL}/products`, {
            headers: faireHeaders,
            params: {
                page: page,
                limit: limit
            }
        });
        
        res.json({ success: true, products: response.data.products, pagination: response.data.pagination });
    } catch (error) {
        const apiError = handleApiError(error, 'Faire (Products)');
        res.status(apiError.status).json(apiError);
    }
});

// Get a single product from Faire by ID
app.get('/api/faire/products/:productId', async (req, res) => {
    try {
        if (!process.env.FAIRE_ACCESS_TOKEN) {
            throw new Error('Faire Access Token is not configured.');
        }

        const productId = req.params.productId;
        
        console.log(`🔎 Fetching Faire product by ID: ${productId}`);
        
        const response = await axios.get(`${FAIRE_BASE_URL}/products/${productId}`, {
            headers: faireHeaders
        });
        
        res.json({ success: true, product: response.data });
    } catch (error) {
        const apiError = handleApiError(error, 'Faire (Single Product)');
        res.status(apiError.status).json(apiError);
    }
});

// Update a product on Faire
app.put('/api/faire/products/:productId', async (req, res) => {
    try {
        if (!process.env.FAIRE_ACCESS_TOKEN) {
            throw new Error('Faire Access Token is not configured.');
        }

        const productId = req.params.productId;
        const updatedProductData = req.body;
        
        console.log(`⬆️ Updating Faire product ${productId} with data:`, updatedProductData);
        
        const response = await axios.put(
            `${FAIRE_BASE_URL}/products/${productId}`,
            updatedProductData,
            { headers: faireHeaders }
        );
        
        res.json({ success: true, message: 'Product updated successfully on Faire', product: response.data });
    } catch (error) {
        const apiError = handleApiError(error, 'Faire (Update Product)');
        res.status(apiError.status).json(apiError);
    }
});

// Image Processing Routes

// Upload images endpoint
app.post('/api/images/upload', upload.array('images'), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, message: 'No image files uploaded.' });
    }

    const { zoho_item_id, zoho_item_name, fair_brand_name, padding, quality, noDownload } = req.body;
    const uploadedFilePaths = req.files.map(file => file.path);
    const processedOutputDir = path.join(__dirname, 'processed-images');

    // Ensure the output directory exists
    try {
        await fs.mkdir(processedOutputDir, { recursive: true });
    } catch (error) {
        console.error("Error creating processed-images directory:", error);
        return res.status(500).json({ success: false, message: 'Server error: could not create output directory.' });
    }

    try {
        const processOptions = {
            padding: parseInt(padding) || undefined,
            quality: parseInt(quality) || undefined,
            noDownload: noDownload === 'true'
        };

        // Call the Python script for each image
        const processingPromises = uploadedFilePaths.map(async (inputPath) => {
            const result = await runImageProcessor(inputPath, processedOutputDir, processOptions);
            return result;
        });

        const results = await Promise.all(processingPromises);

        // Filter out successful results and collect processed image paths
        const successfulResults = results.filter(r => r.success);
        const processedImageDetails = successfulResults.flatMap(result => {
            // Assuming the Python script returns paths of processed images in its data or logs
            // This part might need adjustment based on exact Python script output
            if (result.data && result.data.processed_images) {
                return result.data.processed_images.map(img => ({
                    original: img.original_filename,
                    processed: img.processed_filepath.replace(processedOutputDir + path.sep, '') // Get relative path
                }));
            }
            return [];
        });

        res.json({
            success: true,
            message: 'Images processed and prepared for Firebase upload.',
            processed_images: processedImageDetails,
            zoho_item_id,
            zoho_item_name,
            fair_brand_name
        });

    } catch (error) {
        console.error('Image processing failed:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        // Clean up uploaded files after processing
        for (const filePath of uploadedFilePaths) {
            try {
                await fs.unlink(filePath);
            } catch (err) {
                console.error(`Error deleting uploaded file ${filePath}:`, err);
            }
        }
    }
});


// Firebase Image Management Endpoints

// Upload processed images to Firebase Storage
app.post('/api/firebase/upload-processed-images', async (req, res) => {
    try {
        const { processedImages, zohoItemId, zohoItemName, fairBrandName } = req.body;

        if (!processedImages || !Array.isArray(processedImages) || processedImages.length === 0) {
            return res.status(400).json({ success: false, message: 'No processed images provided for upload.' });
        }
        if (!zohoItemId || !zohoItemName || !fairBrandName) {
            return res.status(400).json({ success: false, message: 'Missing Zoho item details or Faire brand name.' });
        }

        const uploadPromises = processedImages.map(image =>
            uploadProcessedImage(image.processed, image.original, zohoItemId, zohoItemName, fairBrandName)
        );

        const uploadResults = await Promise.all(uploadPromises);
        const successfulUploads = uploadResults.filter(r => r.success);
        const failedUploads = uploadResults.filter(r => !r.success);

        // Clean up processed image files after successful upload
        for (const result of successfulUploads) {
            try {
                const filePath = path.join(__dirname, 'processed-images', result.fileName);
                await fs.unlink(filePath);
            } catch (err) {
                console.error(`Error deleting processed file ${result.fileName}:`, err);
            }
        }

        res.json({
            success: true,
            message: `${successfulUploads.length} images uploaded to Firebase. ${failedUploads.length} failed.`,
            successful_uploads: successfulUploads,
            failed_uploads: failedUploads
        });

    } catch (error) {
        console.error('Error uploading processed images to Firebase:', error);
        res.status(500).json({ success: false, message: 'Failed to upload images to Firebase.', error: error.message });
    }
});

// Get product images from Firebase
app.get('/api/firebase/product-images/:zohoItemId', async (req, res) => {
    try {
        const zohoItemId = req.params.zohoItemId;
        console.log(`🔎 Fetching images for Zoho item: ${zohoItemId} from Firebase`);
        const images = await getProductImages(zohoItemId);
        res.json({ success: true, images });
    } catch (error) {
        console.error('Error fetching product images from Firebase:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch product images.', error: error.message });
    }
});

// Download an image from Firebase and return its URL
app.get('/api/firebase/download-image', async (req, res) => {
    try {
        const { path: imagePath } = req.query; // 'path' query parameter will be the full path in Firebase storage
        if (!imagePath) {
            return res.status(400).json({ success: false, message: 'Image path is required.' });
        }
        
        console.log(`⬇️ Attempting to download image: ${imagePath} from Firebase`);
        const downloadUrl = await downloadImage(imagePath);
        res.json({ success: true, url: downloadUrl });
    } catch (error) {
        console.error('Error downloading image from Firebase:', error);
        res.status(500).json({ success: false, message: 'Failed to download image.', error: error.message });
    }
});

// Get available brands from Firebase
app.get('/api/firebase/brands', async (req, res) => {
    try {
        console.log('📚 Fetching available brands from Firebase...');
        const brands = await getAvailableBrands();
        res.json({ success: true, brands });
    } catch (error) {
        console.error('Error fetching brands from Firebase:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch brands.', error: error.message });
    }
});

// Match Zoho products with Firebase images
app.post('/api/firebase/match-products-images', async (req, res) => {
    try {
        const { zohoItems } = req.body;
        if (!zohoItems || !Array.isArray(zohoItems)) {
            return res.status(400).json({ success: false, message: 'Zoho items array is required.' });
        }
        console.log(`🔗 Matching ${zohoItems.length} Zoho items with Firebase images...`);
        const matchedItems = await matchProductsWithImages(zohoItems);
        res.json({ success: true, matchedItems });
    } catch (error) {
        console.error('Error matching products with images:', error);
        res.status(500).json({ success: false, message: 'Failed to match products with images.', error: error.message });
    }
});


// Zoho Faire Sync Routes

// Upload selected Zoho items to Faire
app.post('/api/sync/zoho-to-faire', async (req, res) => {
    const { itemsToUpload } = req.body;
    
    if (!itemsToUpload || itemsToUpload.length === 0) {
        return res.status(400).json({ success: false, message: 'No items provided for upload to Faire.' });
    }

    if (!process.env.FAIRE_ACCESS_TOKEN) {
        return res.status(500).json({ success: false, message: 'Faire Access Token is not configured on the backend.' });
    }

    console.log(`⚡ Syncing ${itemsToUpload.length} items from Zoho to Faire...`);
    const successfulUploads = [];
    const failedUploads = [];

    for (const item of itemsToUpload) {
        try {
            // Check if item already exists on Faire by SKU (item.sku)
            const existingProductsResponse = await axios.get(`${FAIRE_BASE_URL}/products`, {
                headers: faireHeaders,
                params: {
                    external_id: item.sku, // Use SKU as external_id for matching
                    limit: 1
                }
            });

            let faireProduct = existingProductsResponse.data.products[0];
            let method = 'POST';
            let url = `${FAIRE_BASE_URL}/products`;

            const payload = {
                external_id: item.sku,
                brand_id: item.fair_brand_id, // Assuming fair_brand_id is available on the Zoho item
                short_description: item.name,
                description: item.description || item.name,
                wholesale_price_cents: item.purchase_price * 100, // Convert to cents
                retail_price_cents: item.rate * 100, // Convert to cents
                unit_multiplier: item.unit_multiplier || 1, // Default to 1 if not provided
                active: item.status === 'Active' ? true : false,
                country_of_origin: item.country_of_origin || 'US', // Default or fetch from Zoho
                // Faire product options and images will need to be handled separately or added here
                // For now, mapping basic fields.
            };

            // Handle product images from Firebase
            if (item.firebase_image_urls && item.firebase_image_urls.length > 0) {
                payload.images = item.firebase_image_urls.map(url => ({
                    url: url,
                    is_primary: url === item.firebase_image_urls[0] // Set first image as primary
                }));
            }

            if (faireProduct) {
                // If product exists, update it
                method = 'PUT';
                url = `${FAIRE_BASE_URL}/products/${faireProduct.id}`;
                console.log(`🔄 Updating existing Faire product ${faireProduct.id} (SKU: ${item.sku})`);
            } else {
                // If product doesn't exist, create it
                console.log(`➕ Creating new Faire product for SKU: ${item.sku}`);
            }

            const response = await axios({ method, url, headers: faireHeaders, data: payload });
            
            // For now, handle simple success. Faire might return variants separately.
            if (response.status === 200 || response.status === 201) {
                successfulUploads.push({
                    zoho_item_id: item.item_id,
                    faire_product_id: response.data.id || (faireProduct ? faireProduct.id : 'N/A'),
                    status: 'success',
                    action: faireProduct ? 'updated' : 'created',
                    message: response.data.message || 'Product synced successfully to Faire.'
                });
                // Optionally, update Zoho item with Faire ID or status
                await updateZohoItemStatus(item.item_id, true);
            } else {
                failedUploads.push({
                    zoho_item_id: item.item_id,
                    status: 'failed',
                    message: response.data.message || `Faire API responded with status: ${response.status}`,
                    details: response.data
                });
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message;
            const errorDetails = error.response?.data || {};
            console.error(`❌ Failed to sync Zoho item ${item.item_id} (${item.name}) to Faire:`, errorMessage);
            failedUploads.push({
                zoho_item_id: item.item_id,
                status: 'failed',
                message: `Failed to sync: ${errorMessage}`,
                details: errorDetails
            });
        }
    }
    
    console.log(`📊 Sync Summary: ${successfulUploads.length} succeeded, ${failedUploads.length} failed.`);
    res.json({
        success: failedUploads.length === 0,
        message: failedUploads.length > 0 ? 'Some items failed to sync to Faire.' : 'All selected items synced to Faire successfully!',
        successful_uploads: successfulUploads,
        failed_uploads: failedUploads
    });
});

// Helper to update Zoho item status (e.g., mark as uploaded to Faire)
const updateZohoItemStatus = async (itemId, uploadedToFaire) => {
    try {
        const zohoHeaders = await getZohoHeaders();
        const payload = { cf_uploaded_to_faire: uploadedToFaire }; // Assuming custom field

        await axios.put(`${ZOHO_BASE_URL}/items/${itemId}`, payload, { headers: zohoHeaders });
        console.log(`✅ Zoho item ${itemId} custom field 'uploaded_to_faire' updated to ${uploadedToFaire}`);
    } catch (error) {
        console.error(`❌ Failed to update Zoho item ${itemId} status:`, error.response?.data || error.message);
    }
};


// Start the server
// REMOVED: app.use(express.static(path.join(__dirname, 'build')));
// REMOVED: app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'build', 'index.html')); });

// Initialize Zoho tokens if a refresh token is available at startup
initializeTokens();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API Base: ${ZOHO_BASE_URL}`);
    console.log(`Callback URL: ${REDIRECT_URI}`);
    console.log(`\n📋 Environment Status:`);
    console.log(`- ZOHO_CLIENT_ID: ${process.env.ZOHO_CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
    console.log(`- ZOHO_CLIENT_SECRET: ${process.env.ZOHO_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}`);
    console.log(`- ZOHO_ORGANIZATION_ID: ${process.env.ZOHO_ORGANIZATION_ID ? '✅ Set' : '❌ Missing'}`);
    console.log(`- FAIRE_ACCESS_TOKEN: ${process.env.FAIRE_ACCESS_TOKEN ? '✅ Set' : '❌ Missing'}`);
    console.log(`- ZOHO_REFRESH_TOKEN: ${process.env.ZOHO_REFRESH_TOKEN ? '✅ Set' : '❌ Not Set'}`);
    console.log(`- FIREBASE_SERVICE_ACCOUNT_JSON: ${process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? '✅ Set' : '❌ Missing'}`);
    console.log(`- FIREBASE_STORAGE_BUCKET: ${process.env.FIREBASE_STORAGE_BUCKET ? '✅ Set' : '🔶 Using default'}`);
    
    // Initialize Firebase
    try {
        const { storage, db } = initializeFirebase();
        if (storage && db) {
            console.log('\n🔥 Firebase Status: ✅ Initialized');
        } else {
            console.log('\n🔥 Firebase Status: ⚠️  Not configured. Check FIREBASE_SERVICE_ACCOUNT_JSON.');
        }
    } catch (e) {
        console.error('\n🔥 Firebase Initialization Error:', e.message);
    }
});