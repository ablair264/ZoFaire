// firebase-integration.js - Firebase Admin SDK integration for ZoFaire
const admin = require('firebase-admin');

// Normalize brand names for Firebase paths (remove special characters, umlauts, etc.)
function normalizeBrandName(brand) {
  if (!brand) return 'unknown';
  
  // Convert to string if it's not already
  const brandStr = String(brand).trim();
  
  // Early return for empty string after trimming
  if (!brandStr) {
    return 'unknown';
  }
  
  // Special case: My Flame Lifestyle → myflame
  if (brandStr.toLowerCase() === 'my flame lifestyle') {
    return 'myflame';
  }
  // Special case: räder → rader
  if (brandStr.toLowerCase() === 'räder') {
    return 'rader';
  }
  
  // Convert to lowercase and normalize unicode characters
  let normalized = brandStr.toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric characters
    .trim();
  
  return normalized || 'unknown';
}

// Initialize Firebase Admin SDK
let initialized = false;
let storage = null;
let db = null;

function initializeFirebase() {
  if (initialized) {
    return { storage, db };
  }

  try {
    // Check if we have the service account JSON
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set');
    }
    
    // Parse the service account from the environment variable
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    
    // Validate required fields
    const requiredFields = ['project_id', 'private_key', 'client_email'];
    for (const field of requiredFields) {
      if (!serviceAccount[field]) {
        throw new Error(`Missing required field in service account: ${field}`);
      }
    }
    
    // Get storage bucket from service account or environment
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`;
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: storageBucket
    });
    
    console.log('✅ Firebase Admin SDK initialized successfully.');
    console.log(`📁 Connected to project: ${serviceAccount.project_id}`);
    console.log(`🪣 Storage bucket: ${storageBucket}`);
    
    // Get references to services
    storage = admin.storage();
    db = admin.firestore();
    
    // Configure Firestore settings
    db.settings({
      ignoreUndefinedProperties: true
    });
    console.log('✅ Firestore configured to ignore undefined properties.');
    
    initialized = true;
    return { storage, db };
    
  } catch (error) {
    console.error('❌ Firebase Admin SDK initialization failed:', error.message);
    
    // In production, we want to know immediately if Firebase fails
    if (process.env.NODE_ENV === 'production') {
      console.error('🚨 Critical: Firebase initialization failed in production');
      throw error;
    } else {
      console.warn('⚠️  Running in development mode without Firebase');
      return { storage: null, db: null };
    }
  }
}

// Get list of images for a product
async function getProductImages(manufacturer, sku) {
  try {
    const { storage } = initializeFirebase();
    if (!storage) {
      throw new Error('Firebase Storage not initialized');
    }

    const bucket = storage.bucket();
    const normalizedManufacturer = normalizeBrandName(manufacturer);
    const prefix = `brand-images/${normalizedManufacturer}/${String(sku || '').toLowerCase()}`;
    
    console.log(`🔍 Searching for images with prefix: ${prefix}`);
    
    // List all files with the given prefix
    const [files] = await bucket.getFiles({ prefix });
    
    // Filter for webp images matching our pattern
    const imageFiles = files.filter(file => {
      const fileName = file.name.split('/').pop();
      const pattern = new RegExp(`^${String(sku || '').toLowerCase()}_\\d+(_\\d+x\\d+)?\\.webp$`);
      return pattern.test(fileName);
    });
    
    // Sort by image index
    imageFiles.sort((a, b) => {
      const aMatch = a.name.match(/_(\d+)(?:_|\.)/) || [0, 999];
      const bMatch = b.name.match(/_(\d+)(?:_|\.)/) || [0, 999];
      return parseInt(aMatch[1]) - parseInt(bMatch[1]);
    });
    
    // Return image URLs and metadata
    const images = await Promise.all(imageFiles.map(async (file, index) => {
      // Make file public if it isn't already
      try {
        await file.makePublic();
      } catch (error) {
        console.warn(`Could not make file public: ${file.name}`);
      }
      
      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
      
      // Get metadata
      const [metadata] = await file.getMetadata();
      const fileName = file.name.split('/').pop();
      const isVariant = fileName.includes('_400x400') || fileName.includes('_150x150');
      
      return {
        name: fileName,
        path: file.name,
        url: publicUrl,
        publicUrl: publicUrl,
        size: parseInt(metadata.size),
        contentType: metadata.contentType,
        updated: metadata.updated,
        index: index + 1,
        isVariant,
        variant: isVariant ? fileName.match(/_(\d+x\d+)\./)?.[1] : null
      };
    }));
    
    console.log(`✅ Found ${images.length} images for ${manufacturer}/${sku}`);
    return images;
    
  } catch (error) {
    console.error(`❌ Error fetching images for ${manufacturer}/${sku}:`, error.message);
    throw error;
  }
}

// Download image from Firebase Storage
async function downloadImage(imagePath) {
  try {
    const { storage } = initializeFirebase();
    if (!storage) {
      throw new Error('Firebase Storage not initialized');
    }

    const bucket = storage.bucket();
    const file = bucket.file(imagePath);
    
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File not found: ${imagePath}`);
    }
    
    // Download the file
    const [buffer] = await file.download();
    
    return buffer;
    
  } catch (error) {
    console.error(`❌ Error downloading image ${imagePath}:`, error.message);
    throw error;
  }
}

// Get all available brands
async function getAvailableBrands() {
  try {
    const { storage } = initializeFirebase();
    if (!storage) {
      throw new Error('Firebase Storage not initialized');
    }

    const bucket = storage.bucket();
    const [files] = await bucket.getFiles({ 
      prefix: 'brand-images/',
      delimiter: '/'
    });
    
    // Extract unique brand names from prefixes
    const brands = new Set();
    
    // Get prefixes (folders) under brand-images/
    const [, , prefixes] = await bucket.getFiles({
      prefix: 'brand-images/',
      delimiter: '/',
      autoPaginate: false
    });
    
    if (prefixes && prefixes.prefixes) {
      prefixes.prefixes.forEach(prefix => {
        const brand = prefix.replace('brand-images/', '').replace('/', '');
        if (brand) {
          brands.add(String(brand).toLowerCase());
        }
      });
    }
    
    console.log(`✅ Found ${brands.size} brands in Firebase Storage`);
    return Array.from(brands).sort();
    
  } catch (error) {
    console.error('❌ Error fetching brands:', error.message);
    throw error;
  }
}

// Save or update item in Firestore
async function saveItemToFirestore(item, images) {
  try {
    const { db } = initializeFirebase();
    if (!db) {
      console.warn('Firestore not initialized, skipping save');
      return;
    }
    
    // Use items_data collection and find the document by SKU field
    const itemsDataQuery = await db.collection('items_data')
      .where('sku', '==', item.sku)
      .limit(1)
      .get();
    
    // Handle manufacturer field that might be a map/object
    let manufacturerName = item.manufacturer || item.brand;
    if (manufacturerName && typeof manufacturerName === 'object' && manufacturerName.manufacturer_name) {
      manufacturerName = manufacturerName.manufacturer_name;
    }
    
    const data = {
      ...item,
      images: images.map(img => ({
        url: img.publicUrl || img.url,
        path: img.path,
        name: img.name,
        size: img.size,
        variant: img.variant,
        isVariant: img.isVariant
      })),
      imageCount: images.filter(img => !img.isVariant).length,
      hasImages: images.length > 0,
      images_matched: images.length > 0,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      normalizedManufacturer: normalizeBrandName(manufacturerName)
    };
    
    if (!itemsDataQuery.empty) {
      const docRef = itemsDataQuery.docs[0].ref;
      await docRef.set(data, { merge: true });
      console.log(`✅ Updated item ${item.sku} in items_data with ${images.length} images`);
    } else {
      console.warn(`⚠️ Tried to update item ${item.sku} in items_data, but it was not found.`);
    }
    
  } catch (error) {
    console.error(`❌ Error saving item to Firestore:`, error.message);
    // Don't throw - this is a non-critical operation
  }
}

// Match Zoho products with Firebase images
async function matchProductsWithImages(products) {
  try {
    const { storage } = initializeFirebase();
    if (!storage) {
      throw new Error('Firebase Storage not initialized');
    }

    const results = {
      matched: 0,
      notMatched: 0,
      errors: 0,
      products: []
    };
    
    // Process in batches to avoid overwhelming Firebase
    const batchSize = 10;
    const batches = Math.ceil(products.length / batchSize);
    
    console.log(`🔄 Matching ${products.length} products with Firebase images (${batches} batches)...`);
    
    for (let i = 0; i < batches; i++) {
      const batch = products.slice(i * batchSize, (i + 1) * batchSize);
      
      const batchResults = await Promise.all(batch.map(async (product) => {
        try {
          // Handle manufacturer field that might be a map/object
          let manufacturerName = product.manufacturer || product.brand;
          
          // If manufacturer is an object/map, extract manufacturer_name
          if (manufacturerName && typeof manufacturerName === 'object' && manufacturerName.manufacturer_name) {
            manufacturerName = manufacturerName.manufacturer_name;
            console.log(`📝 Extracted manufacturer_name "${manufacturerName}" from manufacturer map for SKU ${product.sku}`);
          }
          
          const manufacturer = normalizeBrandName(manufacturerName);
          const sku = product.sku;
          
          if (!sku) {
            console.warn(`⚠️  No SKU for product: ${product.name}`);
            results.notMatched++;
            return {
              product,
              images: [],
              matched: false,
              error: 'No SKU'
            };
          }
          
          // Check if this product already has image data in items_data
          const { db } = initializeFirebase();
          let existingImages = [];
          let skipImageMatching = false;
          
          if (db && product.sku) {
            try {
              const itemsDataQuery = await db.collection('items_data')
                .where('sku', '==', product.sku)
                .limit(1)
                .get();
              
              if (!itemsDataQuery.empty) {
                const itemData = itemsDataQuery.docs[0].data();
                if (itemData.images && itemData.images.length > 0 && itemData.hasImages) {
                  existingImages = itemData.images;
                  skipImageMatching = true;
                  console.log(`📸 SKU ${product.sku} already has ${existingImages.length} images, skipping image matching`);
                }
              }
            } catch (err) {
              console.error(`❌ Error checking existing images for SKU ${product.sku}:`, err.message);
            }
          }
          
          let images = existingImages;
          if (!skipImageMatching) {
            images = await getProductImages(manufacturer, sku);
            // Save to items_data collection with image information
            await saveItemToFirestore(product, images);
          }
          
          if (images.length > 0) {
            results.matched++;
            return {
              product,
              images,
              matched: true
            };
          } else {
            results.notMatched++;
            return {
              product,
              images: [],
              matched: false,
              error: 'No images found'
            };
          }
          
        } catch (error) {
          console.error(`❌ Error matching ${product.sku}:`, error.message);
          results.errors++;
          return {
            product,
            images: [],
            matched: false,
            error: error.message
          };
        }
      }));
      
      results.products.push(...batchResults);
      
      console.log(`  Batch ${i + 1}/${batches} complete`);
      
      // Add delay between batches to avoid rate limiting
      if (i < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`✅ Matching complete: ${results.matched} matched, ${results.notMatched} not matched, ${results.errors} errors`);
    return results;
    
  } catch (error) {
    console.error('❌ Error in matchProductsWithImages:', error.message);
    throw error;
  }
}

// Upload processed image to Firebase Storage
async function uploadProcessedImage(buffer, destinationPath, metadata = {}) {
  try {
    const { storage } = initializeFirebase();
    if (!storage) {
      throw new Error('Firebase Storage not initialized');
    }

    const bucket = storage.bucket();
    const file = bucket.file(destinationPath);
    
    const stream = file.createWriteStream({
      metadata: {
        contentType: metadata.contentType || 'image/webp',
        ...metadata
      }
    });
    
    return new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('finish', async () => {
        // Make the file publicly accessible
        await file.makePublic();
        
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destinationPath}`;
        resolve({
          path: destinationPath,
          publicUrl,
          size: buffer.length
        });
      });
      
      stream.end(buffer);
    });
    
  } catch (error) {
    console.error(`❌ Error uploading image to ${destinationPath}:`, error.message);
    throw error;
  }
}

// Update item's image status in Firestore
async function updateItemImagesStatus(sku, hasImages, imageCount = 0) {
  try {
    const { db } = initializeFirebase();
    if (!db) {
      console.warn('Firestore not initialized, skipping update');
      return;
    }
    
    const itemsDataQuery = await db.collection('items_data')
      .where('sku', '==', sku)
      .limit(1)
      .get();
    
    if (!itemsDataQuery.empty) {
      const updateData = {
        images_matched: hasImages,
        lastImageUpdate: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (imageCount > 0) {
        updateData.imageCount = imageCount;
      }
      
      await itemsDataQuery.docs[0].ref.update(updateData);
      console.log(`✅ Updated image status for SKU ${sku}: matched=${hasImages}, count=${imageCount}`);
    } else {
      console.warn(`⚠️ Item with SKU ${sku} not found in items_data`);
    }
  } catch (error) {
    console.error(`❌ Error updating image status for SKU ${sku}:`, error.message);
    // Don't throw - this is a non-critical operation
  }
}

module.exports = {
  initializeFirebase,
  getProductImages,
  downloadImage,
  getAvailableBrands,
  matchProductsWithImages,
  uploadProcessedImage,
  saveItemToFirestore,
  updateItemImagesStatus
};
