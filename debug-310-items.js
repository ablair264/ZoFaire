// debug-310-items.js
// Run this to check for items with UID starting with 310 in your Firestore

const { initializeFirebase } = require('./firebase-integration');

async function debug310Items() {
  try {
    console.log('🔍 Checking for items with UID starting with 310...\n');
    
    const { db } = initializeFirebase();
    if (!db) {
      throw new Error('Firebase not initialized');
    }
    
    // Get all items from items_data
    const snapshot = await db.collection('items_data').get();
    
    let found310 = [];
    let totalItems = 0;
    
    snapshot.forEach(doc => {
      totalItems++;
      const docId = doc.id;
      const data = doc.data();
      
      // Check document ID
      if (docId && docId.startsWith('310')) {
        found310.push({
          docId: docId,
          sku: data.sku,
          name: data.name,
          item_id: data.item_id,
          type: 'Document ID starts with 310'
        });
      }
      
      // Check item_id field
      if (data.item_id && String(data.item_id).startsWith('310')) {
        found310.push({
          docId: docId,
          sku: data.sku,
          name: data.name,
          item_id: data.item_id,
          type: 'item_id field starts with 310'
        });
      }
      
      // Check SKU field
      if (data.sku && String(data.sku).startsWith('310')) {
        found310.push({
          docId: docId,
          sku: data.sku,
          name: data.name,
          item_id: data.item_id,
          type: 'SKU starts with 310'
        });
      }
    });
    
    console.log(`📊 Total items in collection: ${totalItems}`);
    console.log(`🚫 Items with UID/SKU starting with 310: ${found310.length}\n`);
    
    if (found310.length > 0) {
      console.log('Found the following items with 310:');
      found310.forEach((item, index) => {
        console.log(`\n${index + 1}. ${item.type}`);
        console.log(`   Document ID: ${item.docId}`);
        console.log(`   SKU: ${item.sku}`);
        console.log(`   Name: ${item.name}`);
        console.log(`   Item ID: ${item.item_id}`);
      });
      
      console.log('\n🔧 To fix this, you can:');
      console.log('1. Delete these documents from Firestore manually');
      console.log('2. Run a cleanup script to remove them');
      console.log('3. Check why they\'re being added in the first place');
    } else {
      console.log('✅ No items found with UID starting with 310!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the debug
debug310Items().then(() => {
  console.log('\n✨ Debug complete!');
  process.exit(0);
}).catch(error => {
  console.error('Failed:', error);
  process.exit(1);
});
