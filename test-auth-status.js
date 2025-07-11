// test-auth-status.js
// Run this to test your authentication status: node test-auth-status.js

const axios = require('axios');

// Change this to your local or deployed URL
const BASE_URL = process.env.BASE_URL || 'https://zofaire.onrender.com';

console.log('🔍 Testing Authentication Status...\n');
console.log(`Server: ${BASE_URL}\n`);

async function testAuth() {
    try {
        // 1. Check auth status
        console.log('1️⃣ Checking /auth/status...');
        const statusResponse = await axios.get(`${BASE_URL}/auth/status`);
        const status = statusResponse.data;
        
        console.log('\nAuthentication Status:');
        console.log('======================');
        console.log(`Authenticated: ${status.authenticated ? '✅ Yes' : '❌ No'}`);
        console.log(`Has Access Token: ${status.has_access_token ? '✅ Yes' : '❌ No'}`);
        console.log(`Has Refresh Token: ${status.has_refresh_token ? '✅ Yes' : '❌ No'}`);
        console.log(`Token Expired: ${status.is_expired ? '❌ Yes' : '✅ No'}`);
        console.log(`Organization ID Set: ${status.org_id_set ? '✅ Yes' : '❌ No'}`);
        
        if (status.expires_at) {
            console.log(`Expires At: ${new Date(status.expires_at).toLocaleString()}`);
            console.log(`Expires In: ${status.expires_in_minutes} minutes`);
        }
        
        if (status.refresh_attempted) {
            console.log(`\nRefresh Attempted: Yes`);
            if (status.refresh_error) {
                console.log(`Refresh Error: ${status.refresh_error}`);
            } else {
                console.log(`Refresh Success: ✅`);
            }
        }
        
        console.log(`\nRegion: ${status.region}`);
        console.log(`API Base: ${status.api_base}`);
        
        // 2. If authenticated, try to fetch items
        if (status.authenticated) {
            console.log('\n2️⃣ Testing API access by fetching items...');
            const itemsResponse = await axios.get(`${BASE_URL}/api/zoho/items?per_page=1`);
            const items = itemsResponse.data;
            
            if (items.success) {
                console.log('✅ API Access Working!');
                console.log(`Total Items: ${items.page_context?.total || 'Unknown'}`);
            } else {
                console.log('❌ API returned error:', items.message);
            }
        } else {
            console.log('\n❌ Not authenticated. Cannot test API access.');
            
            // Try to refresh if we have a refresh token
            if (status.has_refresh_token) {
                console.log('\n3️⃣ Attempting manual token refresh...');
                try {
                    const refreshResponse = await axios.post(`${BASE_URL}/auth/zoho/refresh`);
                    const refreshData = refreshResponse.data;
                    
                    if (refreshData.success) {
                        console.log('✅ Token refresh successful!');
                        console.log(`New Token: ${refreshData.new_token}`);
                        console.log(`Expires At: ${refreshData.expires_at}`);
                    }
                } catch (refreshError) {
                    console.log('❌ Manual refresh failed:', refreshError.response?.data?.message || refreshError.message);
                }
            }
        }
        
        // 3. Check health
        console.log('\n4️⃣ Checking /health...');
        const healthResponse = await axios.get(`${BASE_URL}/health`);
        const health = healthResponse.data;
        
        console.log('\nHealth Check:');
        console.log('=============');
        console.log(`Status: ${health.status}`);
        console.log(`Zoho Configured: ${health.environment.zoho_configured ? '✅' : '❌'}`);
        console.log(`Faire Configured: ${health.environment.faire_configured ? '✅' : '❌'}`);
        console.log(`OAuth Configured: ${health.environment.zoho_oauth_configured ? '✅' : '❌'}`);
        
    } catch (error) {
        console.error('\n❌ Error:', error.response?.data || error.message);
    }
    
    console.log('\n📊 Summary:');
    console.log('===========');
    console.log('If authentication is failing:');
    console.log('1. Check that ZOHO_REFRESH_TOKEN is set in environment variables');
    console.log('2. Ensure all OAuth credentials are from api-console.zoho.eu');
    console.log('3. Verify ZOHO_ORGANIZATION_ID is correct');
    console.log('4. Try re-authenticating at /auth/zoho');
}

testAuth();