const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanupDuplicateItems() {
  try {
    console.log('Starting cleanup of duplicate items...');
    
    // Get all documents from items_data collection
    const snapshot = await db.collection('items_data').get();
    
    if (snapshot.empty) {
      console.log('No documents found in items_data collection.');
      return;
    }
    
    console.log(`Found ${snapshot.size} total documents in items_data collection.`);
    
    let deletedCount = 0;
    let skippedCount = 0;
    
    // Process each document
    for (const doc of snapshot.docs) {
      const docId = doc.id;
      const data = doc.data();
      
      // Check if document ID is a numeric ID (like 310656000000263000) - these are the duplicates to delete
      if (/^\d+$/.test(docId)) {
        try {
          await doc.ref.delete();
          console.log(`Deleted document: ${docId}`);
          deletedCount++;
        } catch (error) {
          console.error(`Error deleting document ${docId}:`, error);
        }
      } else {
        skippedCount++;
      }
    }
    
    console.log('\n=== Cleanup Summary ===');
    console.log(`Total documents processed: ${snapshot.size}`);
    console.log(`Documents deleted: ${deletedCount}`);
    console.log(`Documents skipped: ${skippedCount}`);
    console.log('Cleanup completed successfully!');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    // Close the connection
    process.exit(0);
  }
}

// Run the cleanup
cleanupDuplicateItems(); 