const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function previewCleanup() {
  try {
    console.log('Previewing cleanup of duplicate items...');
    console.log('This will show what would be deleted without actually deleting anything.\n');
    
    // Get all documents from items_data collection
    const snapshot = await db.collection('items_data').get();
    
    if (snapshot.empty) {
      console.log('No documents found in items_data collection.');
      return;
    }
    
    console.log(`Found ${snapshot.size} total documents in items_data collection.\n`);
    
    let toDeleteCount = 0;
    let toKeepCount = 0;
    const toDelete = [];
    const toKeep = [];
    
    // Process each document
    for (const doc of snapshot.docs) {
      const docId = doc.id;
      const data = doc.data();
      
      // Check if document ID is a numeric ID (like 310656000000263000)
      if (/^\d+$/.test(docId)) {
        toDelete.push({
          id: docId,
          sku: data.sku || 'No SKU',
          name: data.name || data.item_name || 'No Name'
        });
        toDeleteCount++;
      } else {
        toKeep.push({
          id: docId,
          sku: data.sku || 'No SKU',
          name: data.name || data.item_name || 'No Name'
        });
        toKeepCount++;
      }
    }
    
    console.log('=== DOCUMENTS TO BE DELETED ===');
    console.log(`Total: ${toDeleteCount} documents\n`);
    
    if (toDelete.length > 0) {
      toDelete.slice(0, 10).forEach(doc => {
        console.log(`- ${doc.id} | SKU: ${doc.sku} | Name: ${doc.name}`);
      });
      
      if (toDelete.length > 10) {
        console.log(`... and ${toDelete.length - 10} more documents`);
      }
    } else {
      console.log('No documents found with numeric IDs (like 310656000000263000)');
    }
    
    console.log('\n=== DOCUMENTS TO KEEP ===');
    console.log(`Total: ${toKeepCount} documents\n`);
    
    if (toKeep.length > 0) {
      toKeep.slice(0, 10).forEach(doc => {
        console.log(`- ${doc.id} | SKU: ${doc.sku} | Name: ${doc.name}`);
      });
      
      if (toKeep.length > 10) {
        console.log(`... and ${toKeep.length - 10} more documents`);
      }
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total documents: ${snapshot.size}`);
    console.log(`To delete: ${toDeleteCount}`);
    console.log(`To keep: ${toKeepCount}`);
    
    if (toDeleteCount > 0) {
      console.log('\nTo proceed with deletion, run: node cleanup-duplicate-items.js');
    }
    
  } catch (error) {
    console.error('Error during preview:', error);
  } finally {
    // Close the connection
    process.exit(0);
  }
}

// Run the preview
previewCleanup(); 