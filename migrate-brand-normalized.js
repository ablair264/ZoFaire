// migrate-brand-normalized.js
// Run this once to add brand_normalized field to all existing items
// Usage: node migrate-brand-normalized.js

const { initializeFirebase } = require('./firebase-integration');
const admin = require('firebase-admin');

// Normalize brand names (same logic as in server.js)
function normalizeBrandName(brand) {
    if (!brand) return 'unknown';
    
    const brandStr = String(brand).trim();
    if (!brandStr) return 'unknown';
    
    // Special cases
    if (brandStr.toLowerCase() === 'my flame lifestyle') return 'myflame';
    if (brandStr.toLowerCase() === 'räder') return 'rader';
    
    let normalized = brandStr.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ä/g, 'a')
        .replace(/ö/g, 'o')
        .replace(/ü/g, 'u')
        .replace(/ß/g, 'ss')
        .replace(/æ/g, 'ae')
        .replace(/ø/g, 'o')
        .replace(/å/g, 'a')
        .replace(/[^a-z0-9]/g, '')
        .trim();
    
    return normalized || 'unknown';
}

async function migrateBrandNormalized() {
    try {
        console.log('🔄 Starting brand_normalized migration...\n');
        
        const { db } = initializeFirebase();
        if (!db) {
            throw new Error('Firebase not initialized');
        }
        
        // Get all items
        const snapshot = await db.collection('items_data').get();
        console.log(`📊 Found ${snapshot.size} items to process\n`);
        
        let updated = 0;
        let skipped = 0;
        let failed = 0;
        
        // Process in batches
        const batch = db.batch();
        let batchCount = 0;
        
        for (const doc of snapshot.docs) {
            try {
                const data = doc.data();
                
                // Skip if already has brand_normalized
                if (data.brand_normalized) {
                    skipped++;
                    continue;
                }
                
                // Extract brand/manufacturer
                let brandSource = data.manufacturer || data.brand || '';
                
                // Handle object manufacturer field
                if (brandSource && typeof brandSource === 'object' && brandSource.manufacturer_name) {
                    brandSource = brandSource.manufacturer_name;
                }
                
                const brandNormalized = normalizeBrandName(brandSource);
                
                // Update document
                batch.update(doc.ref, {
                    brand_normalized: brandNormalized,
                    lastMigration: admin.firestore.FieldValue.serverTimestamp()
                });
                
                batchCount++;
                updated++;
                
                // Commit batch every 500 documents
                if (batchCount >= 500) {
                    await batch.commit();
                    console.log(`✅ Updated ${updated} documents so far...`);
                    batchCount = 0;
                }
                
            } catch (error) {
                console.error(`❌ Error processing ${doc.id}:`, error.message);
                failed++;
            }
        }
        
        // Commit remaining batch
        if (batchCount > 0) {
            await batch.commit();
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('📊 MIGRATION COMPLETE');
        console.log(`✅ Updated: ${updated} items`);
        console.log(`⏭️  Skipped: ${skipped} items (already had brand_normalized)`);
        console.log(`❌ Failed: ${failed} items`);
        console.log('='.repeat(50));
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
migrateBrandNormalized()
    .then(() => {
        console.log('\n✨ Migration completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    });
