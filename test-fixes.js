// test-fixes.js - Run this to verify all fixes are working
// Place in the root directory and run with: node test-fixes.js

const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

async function testFixes() {
    console.log('🧪 Testing ZoFaire Fixes...\n');
    
    // Test 1: Check if items with UID starting with 310 are filtered
    console.log('📋 Test 1: Checking UID filtering (items starting with 310)...');
    try {
        const response = await axios.get(`${API_BASE_URL}/items?per_page=1000`);
        const items = response.data.items;
        const items310 = items.filter(item => 
            (item.item_id && String(item.item_id).startsWith('310')) ||
            (item.id && String(item.id).startsWith('310'))
        );
        
        if (items310.length === 0) {
            console.log('✅ PASS: No items with UID starting with 310 found');
        } else {
            console.log(`❌ FAIL: Found ${items310.length} items with UID starting with 310`);
            console.log('   First few:', items310.slice(0, 3).map(i => i.item_id || i.id));
        }
    } catch (error) {
        console.log('❌ ERROR:', error.message);
    }
    
    // Test 2: Check brand_normalized field
    console.log('\n📋 Test 2: Checking brand_normalized field...');
    try {
        const response = await axios.get(`${API_BASE_URL}/items?per_page=10`);
        const items = response.data.items;
        const itemsWithBrandNormalized = items.filter(item => item.brand_normalized);
        const itemsWithoutBrandNormalized = items.filter(item => !item.brand_normalized);
        
        console.log(`✅ Items with brand_normalized: ${itemsWithBrandNormalized.length}`);
        console.log(`⚠️  Items without brand_normalized: ${itemsWithoutBrandNormalized.length}`);
        
        if (itemsWithBrandNormalized.length > 0) {
            console.log('   Sample brand_normalized values:', 
                itemsWithBrandNormalized.slice(0, 3).map(i => ({
                    sku: i.sku,
                    brand: i.brand,
                    brand_normalized: i.brand_normalized
                }))
            );
        }
    } catch (error) {
        console.log('❌ ERROR:', error.message);
    }
    
    // Test 3: Check image matching endpoint
    console.log('\n📋 Test 3: Testing image matching endpoint...');
    try {
        // Get a sample item
        const itemsResponse = await axios.get(`${API_BASE_URL}/items?per_page=1`);
        if (itemsResponse.data.items.length > 0) {
            const testItem = itemsResponse.data.items[0];
            
            const matchResponse = await axios.post(`${API_BASE_URL}/workflow/match-images`, {
                products: [testItem]
            });
            
            if (matchResponse.data.success) {
                console.log('✅ PASS: Image matching endpoint works');
                console.log(`   Matched: ${matchResponse.data.matched || 0}`);
                console.log(`   Not matched: ${matchResponse.data.notMatched || 0}`);
            } else {
                console.log('❌ FAIL: Image matching failed');
            }
        }
    } catch (error) {
        console.log('❌ ERROR:', error.message);
    }
    
    // Test 4: Check Firebase status
    console.log('\n📋 Test 4: Checking Firebase connection...');
    try {
        const response = await axios.get(`${API_BASE_URL}/firebase/status`);
        if (response.data.connected) {
            console.log('✅ PASS: Firebase is connected');
        } else {
            console.log('❌ FAIL: Firebase is not connected');
        }
    } catch (error) {
        console.log('❌ ERROR:', error.message);
    }
    
    // Test 5: Check items data structure
    console.log('\n📋 Test 5: Checking items data structure...');
    try {
        const response = await axios.get(`${API_BASE_URL}/items?per_page=5`);
        const items = response.data.items;
        
        if (items.length > 0) {
            const sampleItem = items[0];
            const requiredFields = ['item_id', 'sku', 'name', 'brand_normalized', 'images_matched'];
            const missingFields = requiredFields.filter(field => !(field in sampleItem));
            
            if (missingFields.length === 0) {
                console.log('✅ PASS: All required fields present');
            } else {
                console.log('❌ FAIL: Missing fields:', missingFields);
            }
            
            console.log('   Sample item structure:', {
                item_id: sampleItem.item_id,
                sku: sampleItem.sku,
                name: sampleItem.name,
                brand: sampleItem.brand,
                brand_normalized: sampleItem.brand_normalized,
                images_matched: sampleItem.images_matched,
                imageCount: sampleItem.imageCount
            });
        }
    } catch (error) {
        console.log('❌ ERROR:', error.message);
    }
    
    console.log('\n✨ Testing complete!');
}

// Run tests
testFixes().catch(console.error);
