const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const multer = require('multer');
require('dotenv').config();

// Import Firebase integration
const {
    initializeFirebase,
    getProductImages,
    downloadImage,
    getAvailableBrands,
    matchProductsWithImages,
    uploadProcessedImage
} = require('./firebase-integration');

const app = express();
const PORT = process.env.PORT || 3001;

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 10 // Max 10 files per request
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
        }
    }
});

// Helper function to run Python image processor
const runImageProcessor = (inputData, outputDir, options = {}) => {
    return new Promise((resolve, reject) => {
        const args = [
            path.join(__dirname, 'image-processing/zoho_faire_processor.py'),
            '--input-data', JSON.stringify(inputData),
            '--output-dir', outputDir,
            ...(options.resize ? ['--resize', options.resize.width, options.resize.height] : []),
            ...(options.padding ? ['--padding', options.padding] : []),
            ...(options.quality ? ['--quality', options.quality] : []),
            ...(options.addWatermark ? ['--add-watermark'] : []),
            ...(options.removeBackground ? ['--remove-background'] : []),
            ...(options.format ? ['--format', options.format] : []),
            ...(options.aspectRatio ? ['--aspect-ratio', options.aspectRatio] : []),
            ...(options.outputPrefix ? ['--output-prefix', options.outputPrefix] : [])
        ];
        console.log(`Running Python processor with args: ${args.join(' ')}`);

        const pythonProcess = spawn('python3', args);

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(stdout);
                    resolve(result);
                } catch (jsonError) {
                    reject(new Error(`Python script output not valid JSON: ${stdout}. Error: ${jsonError.message}`));
                }
            } else {
                reject(new Error(`Python script exited with code ${code}. Error: ${stderr}`));
            }
        });

        pythonProcess.on('error', (err) => {
            reject(new Error(`Failed to start Python process: ${err.message}`));
        });
    });
};

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'build'))); // Serve static files from React build

// Environment Check Endpoint
app.get('/env-status', (req, res) => {
    const status = {
        ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID ? 'Set' : 'Missing',
        ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET ? 'Set' : 'Missing',
        ZOHO_ORGANIZATION_ID: process.env.ZOHO_ORGANIZATION_ID ? 'Set' : 'Missing',
        FAIRE_ACCESS_TOKEN: process.env.FAIRE_ACCESS_TOKEN ? 'Set' : 'Missing',
        ZOHO_REFRESH_TOKEN: process.env.ZOHO_REFRESH_TOKEN ? 'Set' : 'Not Set',
        FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? 'Set' : 'Missing',
        FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET ? 'Set' : 'Using default',
    };
    res.json(status);
});

// Firebase Initialization
let firebaseStorage;
let firebaseDb;

try {
    const { storage, db } = initializeFirebase();
    firebaseStorage = storage;
    firebaseDb = db;
    console.log('Firebase initialized successfully.');
} catch (error) {
    console.error('Failed to initialize Firebase:', error.message);
    // Continue running, but Firebase-dependent features will not work
}

// Zoho OAuth related constants and functions
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_ORGANIZATION_ID = process.env.ZOHO_ORGANIZATION_ID;
const ZOHO_REDIRECT_URI = process.env.ZOHO_REDIRECT_URI || 'https://zofaire.onrender.com/oauth/callback';
const ZOHO_AUTH_URL = process.env.ZOHO_AUTH_URL || 'https://accounts.zoho.eu/oauth/v2/auth';
const ZOHO_TOKEN_URL = process.env.ZOHO_TOKEN_URL || 'https://accounts.zoho.eu/oauth/v2/token';
const ZOHO_BASE_URL = process.env.ZOHO_BASE_URL || 'https://www.zohoapis.eu/inventory/v1';

let zohoAccessToken = null;
let zohoRefreshToken = process.env.ZOHO_REFRESH_TOKEN;

// Function to refresh Zoho access token
const refreshAccessToken = async () => {
    if (!zohoRefreshToken) {
        console.error('No Zoho refresh token available. Cannot refresh access token.');
        return null;
    }

    try {
        console.log('Attempting to refresh Zoho access token...');
        const response = await axios.post(ZOHO_TOKEN_URL, new URLSearchParams({
            refresh_token: zohoRefreshToken,
            client_id: ZOHO_CLIENT_ID,
            client_secret: ZOHO_CLIENT_SECRET,
            grant_type: 'refresh_token'
        }).toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        zohoAccessToken = response.data.access_token;
        console.log('Zoho access token refreshed successfully.');
        return zohoAccessToken;
    } catch (error) {
        console.error('Error refreshing Zoho access token:', error.response ? error.response.data : error.message);
        throw new Error('Failed to refresh Zoho access token.');
    }
};

// Middleware to ensure Zoho access token is available
app.use('/api', async (req, res, next) => {
    if (!zohoAccessToken) {
        if (zohoRefreshToken) {
            try {
                await refreshAccessToken();
            } catch (error) {
                return res.status(500).json({ message: 'Failed to obtain Zoho access token. Please re-authenticate.', error: error.message });
            }
        } else {
            // No access token and no refresh token
            return res.status(401).json({ message: 'Zoho authentication required.' });
        }
    }
    next();
});

// Generic Zoho API request function with token refresh
const makeRequest = async (method, url, data = null, params = {}) => {
    let currentAccessToken = zohoAccessToken;

    for (let i = 0; i < 2; i++) { // Try twice: once with current token, once with refreshed token
        try {
            const headers = {
                'Authorization': `Zoho-oauthtoken ${currentAccessToken}`,
                'X-com-zoho-inventory-organizationid': ZOHO_ORGANIZATION_ID,
                'Content-Type': 'application/json'
            };

            const config = {
                method: method,
                url: `${ZOHO_BASE_URL}${url}`,
                headers: headers,
                params: params,
                data: data,
                timeout: 5000 // 5 seconds timeout
            };
            console.log(`Making Zoho API request: ${config.method} ${config.url} with params: ${JSON.stringify(config.params)}`);
            const response = await axios(config);
            return response.data;
        } catch (error) {
            if (error.response && error.response.status === 401 && i === 0) {
                console.warn('Zoho access token expired, attempting to refresh...');
                try {
                    currentAccessToken = await refreshAccessToken();
                    if (!currentAccessToken) {
                        throw new Error('Failed to refresh token, aborting request.');
                    }
                } catch (refreshError) {
                    throw new Error(`Authentication failed: ${refreshError.message}`);
                }
            } else {
                console.error('Zoho API Error:', error.response ? error.response.data : error.message);
                throw error;
            }
        }
    }
};

// Zoho OAuth Callback
app.get('/oauth/callback', async (req, res) => {
    const { code, 'accounts-server': accountsServer, location } = req.query;

    if (!code) {
        return res.status(400).send('Authorization code not provided.');
    }

    try {
        const response = await axios.post(ZOHO_TOKEN_URL, new URLSearchParams({
            code: code,
            client_id: ZOHO_CLIENT_ID,
            client_secret: ZOHO_CLIENT_SECRET,
            redirect_uri: ZOHO_REDIRECT_URI,
            grant_type: 'authorization_code'
        }).toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        zohoAccessToken = response.data.access_token;
        zohoRefreshToken = response.data.refresh_token; // Store refresh token for future use
        console.log('Zoho tokens obtained and stored.');
        res.send('Authorization successful! You can close this window.');
    } catch (error) {
        console.error('Error during Zoho OAuth callback:', error.response ? error.response.data : error.message);
        res.status(500).send('Authentication failed.');
    }
});

// Authentication Status Check
app.get('/auth/status', (req, res) => {
    res.json({ isAuthenticated: zohoAccessToken !== null });
});


// API to fetch Zoho items with pagination and filtering
app.get('/api/zoho/items', async (req, res) => {
    try {
        const { page = 1, per_page = 200, search_text, sort_column, sort_order, filterInactive } = req.query;

        const params = {
            page: parseInt(page),
            per_page: parseInt(per_page),
            // Use 'item_status' for filtering active items, as 'filter_by' with 'Status.StartsWith(Active)' is invalid.
            ...(filterInactive !== 'true' && { item_status: 'active' }),
            ...(search_text && { search_text }),
            ...(sort_column && { sort_column }),
            ...(sort_order && { sort_order }),
        };

        console.log(`📥 Fetching Zoho items with params: ${JSON.stringify(params)}`);
        const data = await makeRequest('GET', '/items', null, params);
        res.json(data);
    } catch (error) {
        console.error('Error fetching Zoho items:', error.response ? error.response.data : error.message);
        res.status(error.response ? error.response.status : 500).json({
            message: 'Failed to fetch Zoho items.',
            error: error.response ? error.response.data : error.message
        });
    }
});

// API to fetch ALL Zoho items with pagination and filtering for workflow
const fetchAllZohoItems = async (filterActive = true) => {
    console.log('🔄 Starting to fetch all Zoho items...');
    const allItems = [];
    let page = 1;
    const perPage = 200; // Max items per page allowed by Zoho
    const delayBetweenRequests = 300; // milliseconds
    const maxPages = 100; // To prevent infinite loops in case of API issues or huge datasets

    console.log(`   Settings: ${perPage} items/page, ${delayBetweenRequests}ms delay, max ${maxPages} pages`);
    if (filterActive) {
        console.log('   Filtering: Active items only');
    }

    while (page <= maxPages) {
        const params = {
            page: page,
            per_page: perPage,
            // Use 'item_status' for filtering active items, as 'filter_by' with 'Status.StartsWith(Active)' is invalid.
            ...(filterActive && { item_status: 'active' }) // Corrected filter
        };

        try {
            console.log(`   Requesting page ${page} with params: ${JSON.stringify(params)}`);
            const data = await makeRequest('GET', '/items', null, params);
            if (data.items && data.items.length > 0) {
                allItems.push(...data.items);
                console.log(`   Fetched page ${page}, total items so far: ${allItems.length}`);
                if (data.items.length < perPage) {
                    // Less items than per_page means it's the last page
                    break;
                }
                page++;
                await new Promise(resolve => setTimeout(resolve, delayBetweenRequests)); // Add a small delay
            } else {
                console.log(`   No items returned on page ${page}. Ending fetch.`);
                break;
            }
        } catch (error) {
            console.error(`❌ Failed to fetch page ${page}:`, error.response ? error.response.data : error.message);
            // Propagate the specific Zoho error if it's an invalid filter
            if (error.response && error.response.data && error.response.data.message === 'Invalid value passed for filter_by') {
                throw new Error(`Zoho API Error: ${JSON.stringify(error.response.data)}`);
            }
            throw error; // Re-throw other errors
        }
    }
    console.log(`✅ Finished fetching all Zoho items. Total: ${allItems.length}`);
    return allItems;
};


// API endpoint for syncing data with Faire
app.post('/api/sync-with-faire', async (req, res) => {
    // This is a placeholder for the actual sync logic
    // In a real scenario, this would involve fetching data from Zoho,
    // transforming it, and pushing it to Faire.
    console.log('Initiating sync with Faire...');
    res.json({ message: 'Sync with Faire initiated (placeholder).' });
});


// API to get image URLs from Firebase Storage for a given brand and product name
app.get('/api/firebase/images', async (req, res) => {
    const { brand, product } = req.query;
    if (!brand || !product) {
        return res.status(400).json({ message: 'Brand and product parameters are required.' });
    }

    try {
        if (!firebaseStorage) {
            throw new Error('Firebase Storage not initialized.');
        }
        const images = await getProductImages(firebaseStorage, brand, product);
        res.json(images);
    } catch (error) {
        console.error('Error fetching images from Firebase:', error.message);
        res.status(500).json({ message: 'Failed to fetch images from Firebase.', error: error.message });
    }
});

// API to download a specific image from Firebase Storage
app.get('/api/firebase/download-image', async (req, res) => {
    const { imageUrl } = req.query;
    if (!imageUrl) {
        return res.status(400).json({ message: 'Image URL parameter is required.' });
    }

    try {
        if (!firebaseStorage) {
            throw new Error('Firebase Storage not initialized.');
        }
        const imageBuffer = await downloadImage(firebaseStorage, imageUrl);
        const fileName = path.basename(new URL(imageUrl).pathname);
        const mimeType = 'image/jpeg'; // Assuming JPEG, could infer from URL or add more logic

        res.writeHead(200, {
            'Content-Type': mimeType,
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': imageBuffer.length
        });
        res.end(imageBuffer);

    } catch (error) {
        console.error('Error downloading image from Firebase:', error.message);
        res.status(500).json({ message: 'Failed to download image from Firebase.', error: error.message });
    }
});

// API to get available brands from Firebase
app.get('/api/firebase/brands', async (req, res) => {
    try {
        if (!firebaseDb) {
            throw new Error('Firebase Firestore not initialized.');
        }
        const brands = await getAvailableBrands(firebaseDb);
        res.json(brands);
    } catch (error) {
        console.error('Error fetching brands from Firebase:', error.message);
        res.status(500).json({ message: 'Failed to fetch brands from Firebase.', error: error.message });
    }
});


// API to upload and process image
app.post('/api/image-upload-process', upload.array('images', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded or invalid file types.' });
        }

        const { zohoItemId, product_name, brand_name, resize, padding, quality, addWatermark, removeBackground, format, aspectRatio, outputPrefix } = req.body;

        if (!zohoItemId || !product_name || !brand_name) {
            return res.status(400).json({ message: 'Zoho Item ID, Product Name, and Brand Name are required.' });
        }

        const processedImagesInfo = [];

        for (const file of req.files) {
            const inputPath = file.path;
            const outputDir = path.join(__dirname, 'processed_uploads');
            await fs.mkdir(outputDir, { recursive: true });

            const options = {
                resize: resize ? JSON.parse(resize) : null,
                padding: padding ? parseInt(padding) : null,
                quality: quality ? parseInt(quality) : null,
                addWatermark: addWatermark === 'true',
                removeBackground: removeBackground === 'true',
                format: format || null,
                aspectRatio: aspectRatio || null,
                outputPrefix: outputPrefix || null,
            };

            // Run the Python image processor
            const pythonInput = {
                image_path: inputPath,
                output_dir: outputDir,
                options: options
            };

            try {
                console.log(`Processing image: ${file.originalname}`);
                const pythonOutput = await runImageProcessor(pythonInput, outputDir, options);

                const processedImagePath = pythonOutput.processed_image_path;
                const uploadFileName = pythonOutput.uploaded_file_name;

                if (!processedImagePath || !uploadFileName) {
                    throw new Error('Python processor did not return expected output paths.');
                }

                // Upload processed image to Firebase Storage
                const firebaseFilePath = `product_images/${brand_name}/${product_name}/${uploadFileName}`;
                const publicUrl = await uploadProcessedImage(firebaseStorage, processedImagePath, firebaseFilePath);

                processedImagesInfo.push({
                    originalName: file.originalname,
                    processedPath: processedImagePath,
                    publicUrl: publicUrl
                });

                // Clean up the local processed file
                await fs.unlink(processedImagePath);
                // Clean up the original uploaded file
                await fs.unlink(inputPath);

            } catch (pythonError) {
                console.error(`Error processing or uploading image ${file.originalname}:`, pythonError.message);
                // Clean up the original uploaded file even if processing fails
                await fs.unlink(inputPath).catch(err => console.error('Error cleaning up original uploaded file:', err.message));
                throw pythonError; // Re-throw to be caught by the outer catch block
            }
        }

        // Optionally update Zoho with image links if needed
        // await updateZohoItemWithImages(zohoItemId, processedImagesInfo.map(info => info.publicUrl));

        res.json({ message: 'Images processed and uploaded successfully.', details: processedImagesInfo });

    } catch (error) {
        console.error('Error in image-upload-process:', error.message);
        res.status(500).json({ message: 'Failed to process and upload images.', error: error.message });
    }
});


// API to update Zoho item with images - placeholder
const updateZohoItemWithImages = async (itemId, imageUrls) => {
    // This function would call Zoho Inventory API to update an item with new image URLs
    console.log(`Updating Zoho item ${itemId} with images: ${imageUrls.join(', ')}`);
    // Example: makeRequest('PUT', `/items/${itemId}`, { image_urls: imageUrls });
    return { success: true, message: 'Zoho item update placeholder executed.' };
};


// API endpoint to match products with images
app.get('/api/match-products-with-images', async (req, res) => {
    try {
        if (!firebaseDb || !firebaseStorage) {
            throw new Error('Firebase not initialized.');
        }

        // Fetch all items without applying an 'active' filter here, as per previous logic.
        // The `fetchAllZohoItems` function handles the `filterActive` parameter.
        const zohoItems = await fetchAllZohoItems(false);
        const matchedItems = await matchProductsWithImages(firebaseDb, firebaseStorage, zohoItems);

        res.json(matchedItems);
    } catch (error) {
        console.error('Error matching products with images:', error.message);
        res.status(500).json({ message: 'Failed to match products with images.', error: error.message });
    }
});


// New API for the complete sync workflow
app.post('/api/workflow/complete-sync', async (req, res) => {
    console.log('Starting complete sync workflow...');
    try {
        // Step 1: Fetch all items from Zoho Inventory
        console.log('📥 Step 1: Fetching all items from Zoho...');
        const zohoItems = await fetchAllZohoItems(true); // Filter for active items during sync
        console.log(`✅ Step 1: Fetched ${zohoItems.length} Zoho items.`);

        // Step 2: Fetch all product images from Firebase Storage
        console.log('🖼️ Step 2: Fetching all product images from Firebase...');
        // Assuming getFirebaseImages can fetch all, or it needs to be iteratively called
        // For simplicity, let's assume `matchProductsWithImages` handles internal Firebase fetching
        console.log('This step is implicitly handled by `matchProductsWithImages`.');
        // No direct call here, as matchProductsWithImages will do it.

        // Step 3: Match Zoho items with Firebase images
        console.log('🤝 Step 3: Matching Zoho items with Firebase images...');
        if (!firebaseDb || !firebaseStorage) {
            throw new Error('Firebase not initialized for matching products.');
        }
        const matchedItems = await matchProductsWithImages(firebaseDb, firebaseStorage, zohoItems);
        console.log(`✅ Step 3: Matched ${matchedItems.length} items with images.`);

        // Step 4: Identify items to be uploaded/updated on Faire
        console.log('⬆️ Step 4: Identifying items for Faire upload/update...');
        // This logic would depend on what Faire considers "uploaded"
        // For now, let's assume all matched items are candidates for upload/update
        const itemsToUpload = matchedItems;
        console.log(`✅ Step 4: Identified ${itemsToUpload.length} items for Faire.`);

        // Step 5: Upload/Update items to Faire (Placeholder)
        console.log('🚀 Step 5: Uploading/Updating items to Faire (Placeholder)...');
        // This would involve calling the Faire API
        // For demonstration, let's simulate a success or failure
        const faireUploadResults = itemsToUpload.map(item => ({
            itemId: item.item_id,
            itemName: item.name,
            status: 'simulated_success', // In a real app, this would be actual Faire API response
            faireId: `faire_${item.item_id}` // Simulated Faire ID
        }));
        console.log(`✅ Step 5: Completed simulated Faire upload for ${faireUploadResults.length} items.`);

        res.json({
            message: 'Complete sync workflow finished successfully (simulated Faire upload).',
            summary: {
                zohoItemsFetched: zohoItems.length,
                matchedItems: matchedItems.length,
                itemsUploadedToFaire: faireUploadResults.length
            },
            details: faireUploadResults
        });

    } catch (error) {
        console.error('Workflow error:', error.message);
        res.status(500).json({ message: 'Complete sync workflow failed.', error: error.message });
    }
});


// Serve React App
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API Base: ${ZOHO_BASE_URL}`);
    console.log(`Callback URL: ${ZOHO_REDIRECT_URI}`);
    console.log(`\n📋 Environment Status:`);
    console.log(`- ZOHO_CLIENT_ID: ${process.env.ZOHO_CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
    console.log(`- ZOHO_CLIENT_SECRET: ${process.env.ZOHO_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}`);
    console.log(`- ZOHO_ORGANIZATION_ID: ${process.env.ZOHO_ORGANIZATION_ID ? '✅ Set' : '❌ Missing'}`);
    console.log(`- FAIRE_ACCESS_TOKEN: ${process.env.FAIRE_ACCESS_TOKEN ? '✅ Set' : '❌ Missing'}`);
    console.log(`- ZOHO_REFRESH_TOKEN: ${process.env.ZOHO_REFRESH_TOKEN ? '✅ Set' : '❌ Not Set'}`);
    console.log(`- FIREBASE_SERVICE_ACCOUNT_JSON: ${process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? '✅ Set' : '❌ Missing'}`);
    console.log(`- FIREBASE_STORAGE_BUCKET: ${process.env.FIREBASE_STORAGE_BUCKET ? '✅ Set' : '🔶 Using default'}`);

    // Initialize Firebase
    try {
        const { storage, db } = initializeFirebase();
        if (storage && db) {
            console.log('\n🔥 Firebase Status: ✅ Initialized');
        } else {
            console.log('\n🔥 Firebase Status: ⚠️  Not configured...');
        }
    } catch (firebaseInitError) {
        console.error('\n🔥 Firebase Status: ❌ Failed to initialize!', firebaseInitError.message);
    }
});