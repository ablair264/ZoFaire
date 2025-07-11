// test-eu-config.js
// Run this locally to test your EU configuration: node test-eu-config.js

require('dotenv').config();
const axios = require('axios');

console.log('🔍 Testing Zoho EU Configuration...\n');

// Configuration
const ZOHO_OAUTH_BASE = 'https://accounts.zoho.eu/oauth/v2';
const ZOHO_BASE_URL = 'https://www.zohoapis.eu/inventory/v1';
const REDIRECT_URI = 'https://zofaire.onrender.com/auth/zoho/callback';

// Check environment variables
console.log('📋 Environment Check:');
console.log('====================');

const checks = {
    'ZOHO_CLIENT_ID': process.env.ZOHO_CLIENT_ID,
    'ZOHO_CLIENT_SECRET': process.env.ZOHO_CLIENT_SECRET,
    'ZOHO_ORGANIZATION_ID': process.env.ZOHO_ORGANIZATION_ID,
    'ZOHO_REGION': process.env.ZOHO_REGION,
    'FAIRE_ACCESS_TOKEN': process.env.FAIRE_ACCESS_TOKEN
};

let allGood = true;

Object.entries(checks).forEach(([key, value]) => {
    if (value) {
        console.log(`✅ ${key}: ${value.substring(0, 20)}...`);
    } else {
        console.log(`❌ ${key}: NOT SET`);
        allGood = false;
    }
});

// Check region
if (process.env.ZOHO_REGION !== 'eu') {
    console.log('\n⚠️  WARNING: ZOHO_REGION should be set to "eu"');
    allGood = false;
}

console.log('\n🌍 EU Configuration:');
console.log('===================');
console.log(`OAuth Base: ${ZOHO_OAUTH_BASE}`);
console.log(`API Base: ${ZOHO_BASE_URL}`);
console.log(`Redirect URI: ${REDIRECT_URI}`);

// Generate OAuth URL
const authUrl = `${ZOHO_OAUTH_BASE}/auth?` +
    `scope=ZohoInventory.FullAccess.all&` +
    `client_id=${process.env.ZOHO_CLIENT_ID}&` +
    `response_type=code&` +
    `access_type=offline&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

console.log('\n🔗 OAuth URL for Testing:');
console.log('========================');
console.log(authUrl);

// Test token refresh if we have a refresh token
if (process.env.ZOHO_REFRESH_TOKEN) {
    console.log('\n🔄 Testing Token Refresh...');
    
    axios.post(`${ZOHO_OAUTH_BASE}/token`, null, {
        params: {
            refresh_token: process.env.ZOHO_REFRESH_TOKEN,
            client_id: process.env.ZOHO_CLIENT_ID,
            client_secret: process.env.ZOHO_CLIENT_SECRET,
            grant_type: 'refresh_token'
        }
    })
    .then(response => {
        console.log('✅ Token refresh successful!');
        console.log(`   Access token: ${response.data.access_token.substring(0, 30)}...`);
        console.log(`   Expires in: ${response.data.expires_in / 3600} hours`);
        
        // Test API call
        return axios.get(`${ZOHO_BASE_URL}/items`, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${response.data.access_token}`,
                'X-com-zoho-inventory-organizationid': process.env.ZOHO_ORGANIZATION_ID
            },
            params: {
                page: 1,
                per_page: 1
            }
        });
    })
    .then(response => {
        if (response.data.code === 0) {
            console.log('\n✅ API Test successful!');
            console.log(`   Total items: ${response.data.page_context?.total || 0}`);
        } else {
            console.log('\n❌ API returned error:', response.data.message);
        }
    })
    .catch(error => {
        if (error.response?.status === 401) {
            console.log('❌ Authentication failed. Refresh token may be invalid.');
        } else {
            console.log('❌ Error:', error.response?.data?.message || error.message);
        }
    });
} else {
    console.log('\n📝 No refresh token found. Complete OAuth flow first.');
}

// Summary
console.log('\n📊 Configuration Summary:');
console.log('========================');
if (allGood) {
    console.log('✅ All required environment variables are set');
    console.log('✅ EU region is properly configured');
    console.log('\n🚀 Ready for deployment!');
    console.log('\nNext steps:');
    console.log('1. Deploy to Render with these environment variables');
    console.log('2. Visit /auth/zoho/debug to verify');
    console.log('3. Complete OAuth flow at /auth/zoho');
} else {
    console.log('❌ Some configuration is missing');
    console.log('\nFix the issues above and run this test again.');
}

console.log('\n💡 Zoho EU OAuth App Setup:');
console.log('1. Go to https://api-console.zoho.eu/');
console.log('2. Create new Server-based Application');
console.log(`3. Set redirect URI: ${REDIRECT_URI}`);
console.log('4. Add scope: ZohoInventory.FullAccess.all');
console.log('5. Copy Client ID and Secret to .env\n');