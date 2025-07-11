const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'build'))); // Serve React build

// In-memory token storage (use Redis/database in production)
let tokenStorage = {
    zoho_access_token: process.env.ZOHO_ACCESS_TOKEN || null,
    zoho_refresh_token: process.env.ZOHO_REFRESH_TOKEN || null,
    zoho_expires_at: null
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

// Zoho OAuth configuration
const ZOHO_OAUTH_BASE = 'https://accounts.zoho.com/oauth/v2';
const ZOHO_BASE_URL = process.env.ZOHO_BASE_URL || 'https://www.zohoapis.com/inventory/v1';
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
        'Content-Type': 'application/json'
    };
};

// Refresh Zoho access token
const refreshZohoToken = async () => {
    if (!tokenStorage.zoho_refresh_token) {
        throw new Error('No refresh token available. Re-authentication required.');
    }

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
        tokenStorage.zoho_access_token = data.access_token;
        tokenStorage.zoho_expires_at = Date.now() + (data.expires_in * 1000);
        
        console.log('Zoho token refreshed successfully');
        return data.access_token;
    } catch (error) {
        console.error('Error refreshing Zoho token:', error.response?.data || error.message);
        throw new Error('Failed to refresh Zoho token');
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
        
        res.send(`
            <html>
                <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
                    <h2 style="color: #4CAF50;">✅ Authentication Successful!</h2>
                    <p>Zoho Inventory access has been granted.</p>
                    <p><strong>Access Token:</strong> ${data.access_token.substring(0, 20)}...</p>
                    <p><strong>Expires in:</strong> ${Math.floor(data.expires_in / 3600)} hours</p>
                    <br>
                    <a href="/" style="background: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-right: 10px;">Go to Dashboard</a>
                    <a href="/auth/status" style="background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Check Status</a>
                    
                    <div style="margin-top: 30px; padding: 20px; background: #f5f5f5; border-radius: 8px; text-align: left;">
                        <h3>⚠️ Important: Save These Environment Variables</h3>
                        <p>Add these to your Render environment variables for persistent authentication:</p>
                        <code style="display: block; background: white; padding: 10px; margin: 10px 0; border-radius: 4px;">
                            ZOHO_ACCESS_TOKEN=${data.access_token}<br>
                            ZOHO_REFRESH_TOKEN=${data.refresh_token}
                        </code>
                        <p><small>This will prevent re-authentication on server restarts.</small></p>
                    </div>
                </body>
            </html>
        `);

    } catch (error) {
        console.error('OAuth token exchange error:', error.response?.data || error.message);
        res.status(500).send(`
            <html>
                <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
                    <h2 style="color: #f44336;">Token Exchange Failed</h2>
                    <p>Error: ${error.response?.data?.error || error.message}</p>
                    <a href="/auth/zoho" style="background: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Try Again</a>
                </body>
            </html>
        `);
    }
});

// Check authentication status
app.get('/auth/status', (req, res) => {
    const isAuthenticated = !!tokenStorage.zoho_access_token;
    const expiresAt = tokenStorage.zoho_expires_at;
    const timeUntilExpiry = expiresAt ? Math.max(0, expiresAt - Date.now()) : 0;
    
    res.json({
        authenticated: isAuthenticated,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        expires_in_minutes: Math.floor(timeUntilExpiry / (1000 * 60)),
        has_refresh_token: !!tokenStorage.zoho_refresh_token
    });
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

// Get all items from Zoho Inventory
app.get('/api/zoho/items', async (req, res) => {
    try {
        const page = req.query.page || 1;
        const per_page = req.query.per_page || 200;
        
        const zohoHeaders = await getZohoHeaders();
        
        const response = await axios.get(
            `${ZOHO_BASE_URL}/items`,
            {
                headers: zohoHeaders,
                params: {
                    organization_id: process.env.ZOHO_ORGANIZATION_ID,
                    page: page,
                    per_page: per_page
                }
            }
        );

        if (response.data.code === 0) {
            res.json({
                success: true,
                items: response.data.items,
                page_context: response.data.page_context
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
                    organization_id: process.env.ZOHO_ORGANIZATION_ID
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

// Helper function to map categories
function mapZohoToFaireCategory(zohoCategory) {
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
}

// Serve the React app for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Callback URL: ${REDIRECT_URI}`);
    console.log(`Environment variables status:`);
    console.log(`- ZOHO_CLIENT_ID: ${process.env.ZOHO_CLIENT_ID ? '✓ Set' : '✗ Missing'}`);
    console.log(`- ZOHO_CLIENT_SECRET: ${process.env.ZOHO_CLIENT_SECRET ? '✓ Set' : '✗ Missing'}`);
    console.log(`- ZOHO_ORGANIZATION_ID: ${process.env.ZOHO_ORGANIZATION_ID ? '✓ Set' : '✗ Missing'}`);
    console.log(`- FAIRE_ACCESS_TOKEN: ${process.env.FAIRE_ACCESS_TOKEN ? '✓ Set' : '✗ Missing'}`);
});