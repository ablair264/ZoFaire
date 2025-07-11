#!/usr/bin/env node
// test-firebase.js - Test Firebase connection and functionality

require('dotenv').config();
const { 
  initializeFirebase, 
  getAvailableBrands, 
  getProductImages 
} = require('./firebase-integration');

async function testFirebaseConnection() {
  console.log('🧪 Testing Firebase Connection...\n');
  
  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`- FIREBASE_SERVICE_ACCOUNT_JSON: ${process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? '✅ Set' : '❌ Missing'}`);
  console.log(`- FIREBASE_STORAGE_BUCKET: ${process.env.FIREBASE_STORAGE_BUCKET || 'Using default'}`);
  console.log('');
  
  try {
    // Test 1: Initialize Firebase
    console.log('Test 1: Initializing Firebase...');
    const { storage, db } = initializeFirebase();
    
    if (!storage || !db) {
      throw new Error('Firebase services not initialized');
    }
    
    console.log('✅ Firebase initialized successfully\n');
    
    // Test 2: Get available brands
    console.log('Test 2: Fetching available brands...');
    const brands = await getAvailableBrands();
    console.log(`✅ Found ${brands.length} brands:`);
    brands.slice(0, 5).forEach(brand => console.log(`   - ${brand}`));
    if (brands.length > 5) {
      console.log(`   ... and ${brands.length - 5} more`);
    }
    console.log('');
    
    // Test 3: Get images for a sample product
    if (brands.length > 0) {
      console.log('Test 3: Fetching sample product images...');
      console.log('   (Testing with first available brand)');
      
      // You might need to adjust this with a known SKU
      const testBrand = brands[0];
      const testSku = '31036'; // Example SKU - replace with actual
      
      try {
        const images = await getProductImages(testBrand, testSku);
        if (images.length > 0) {
          console.log(`✅ Found ${images.length} images for ${testBrand}/${testSku}:`);
          images.forEach(img => {
            console.log(`   - ${img.name} (${img.size} bytes)`);
          });
        } else {
          console.log(`⚠️  No images found for ${testBrand}/${testSku}`);
          console.log('   This is normal if the SKU doesn\'t exist');
        }
      } catch (error) {
        console.log(`⚠️  Error fetching images: ${error.message}`);
        console.log('   This is normal if the brand/SKU combination doesn\'t exist');
      }
    }
    
    console.log('\n✅ All Firebase tests passed!');
    console.log('\n📝 Next steps:');
    console.log('1. Add FIREBASE_SERVICE_ACCOUNT_JSON to Render environment variables');
    console.log('2. Deploy your updated server');
    console.log('3. Test the Firebase endpoints');
    
  } catch (error) {
    console.error('\n❌ Firebase test failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check that FIREBASE_SERVICE_ACCOUNT_JSON is properly formatted');
    console.error('2. Ensure the service account has Storage Admin permissions');
    console.error('3. Verify the project ID and storage bucket are correct');
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the test
testFirebaseConnection();