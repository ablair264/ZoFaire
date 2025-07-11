const axios = require('axios');

// In-memory cache for the access token and its expiry
let cachedAccessToken = null;
let cachedExpiry = null;

// Read credentials from environment variables
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_REGION = process.env.ZOHO_REGION || 'eu';

const ZOHO_TOKEN_URL = `https://accounts.zoho.${ZOHO_REGION}/oauth/v2/token`;

async function refreshZohoTokens() {
  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN) {
    throw new Error('Missing Zoho OAuth environment variables');
  }
  try {
    const response = await axios.post(ZOHO_TOKEN_URL, null, {
      params: {
        refresh_token: ZOHO_REFRESH_TOKEN,
        client_id: ZOHO_CLIENT_ID,
        client_secret: ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token',
      },
    });
    const { access_token, expires_in } = response.data;
    if (!access_token) {
      throw new Error('No access_token returned from Zoho');
    }
    // Cache the token and expiry
    cachedAccessToken = access_token;
    cachedExpiry = Date.now() + (parseInt(expires_in, 10) - 60) * 1000; // 60s buffer
    return access_token;
  } catch (error) {
    console.error('Error refreshing Zoho access token:', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function getZohoAccessToken() {
  // If we have a cached token and it's not expired, use it
  if (cachedAccessToken && cachedExpiry && Date.now() < cachedExpiry) {
    return cachedAccessToken;
  }
  // Otherwise, refresh
  return await refreshZohoTokens();
}

module.exports = {
  getZohoAccessToken,
  refreshZohoTokens,
}; 