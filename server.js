const express = require('express');
const cors = require('cors');
const axios = require('axios'); // Ensure axios is imported
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const multer = require('multer');
require('dotenv').config();

// Import Firebase integration (assuming these functions are exported)
const {
    initializeFirebase,
    getProductImages,
    // downloadImage, // Uncomment if used directly in server.js
    getAvailableBrands,
    matchProductsWithImages,
    uploadProcessedImage,
    saveItemToFirestore
    // getZohoAccessToken, // Function to get current access token (REMOVE from here)
    // refreshZohoTokens // Function to refresh token (REMOVE from here)
} = require('./firebase-integration'); // Adjust path as needed for your project structure

// Import Zoho token management from zoho-auth.js
const { getZohoAccessToken, refreshZohoTokens } = require('./zoho-auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Normalize brand names for Firebase paths (remove special characters, umlauts, etc.)
const normalizeBrandName = (brand) => {
    if (!brand) return 'unknown';
    
    // Convert to lowercase and normalize unicode characters
    let normalized = brand.toLowerCase()
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
};

// Environment variables (read once at startup)
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_ORGANIZATION_ID = process.env.ZOHO_ORGANIZATION_ID;
const ZOHO_REDIRECT_URI = process.env.REACT_APP_ZOHO_REDIRECT_URI || 'https://zofaire.onrender.com/oauth/callback';
const ZOHO_BASE_URL = process.env.ZOHO_BASE_URL || 'https://www.zohoapis.eu/inventory/v1';
const FAIRE_ACCESS_TOKEN = process.env.FAIRE_ACCESS_TOKEN;

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
const runImageProcessor = (inputPath, outputDir, options = {}) => {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, 'image-processing', 'zoho_faire_processor.py');
        const args = [scriptPath, '--input', inputPath, '--output_dir', outputDir];

        if (options.outputFormat) args.push('--output_format', options.outputFormat);
        if (options.padding) args.push('--padding', options.padding.toString());
        if (options.quality) args.push('--quality', options.quality.toString());
        if (options.trim) args.push('--trim');
        if (options.whiteBackground) args.push('--white_background');

        console.log(`Running Python script: python ${args.join(' ')}`);
        const pythonProcess = spawn('python', args);

        let scriptOutput = '';
        pythonProcess.stdout.on('data', (data) => {
            scriptOutput += data.toString();
            console.log(`Python stdout: ${data}`);
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python stderr: ${data}`);
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    // Assuming the Python script prints the processed file path in a specific way
                    // e.g., "Processed image path: /path/to/output.webp"
                    const match = scriptOutput.match(/Processed image path:\s*(.*)/);
                    if (match && match[1]) {
                        resolve({ processedPath: match[1].trim() });
                    } else {
                        // Fallback if script doesn't print path clearly, try to guess
                        const outputFileName = path.basename(inputPath).split('.')[0] + '.' + (options.outputFormat || 'webp');
                        const guessedProcessedPath = path.join(outputDir, outputFileName);
                        console.warn(`Could not parse processed path from script output. Guessing: ${guessedProcessedPath}`);
                        resolve({ processedPath: guessedProcessedPath });
                    }
                } catch (parseError) {
                    reject(new Error(`Python script succeeded, but output parsing failed: ${parseError.message}. Script output: ${scriptOutput}`));
                }
            } else {
                reject(new Error(`Python script exited with code ${code}. Output: ${scriptOutput}`));
            }
        });

        pythonProcess.on('error', (err) => {
            console.error(`Failed to start python process: ${err.message}`);
            reject(new Error(`Failed to start python process: ${err.message}`));
        });
    });
};


// Middleware
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the React app's build directory
app.use(express.static(path.join(__dirname, 'build')));

// Initialize Firebase (assuming this is handled in firebase-integration)
let firebaseStorage, firebaseDb; // Declare variables for potential future use if needed
try {
    const { storage, db } = initializeFirebase();
    firebaseStorage = storage;
    firebaseDb = db;
    console.log('\n🔥 Firebase Status: ✅ Initialized');
} catch (e) {
    console.error('🔥 Firebase Status: ❌ Initialization failed:', e.message);
}


// Zoho OAuth Callback Route
app.get('/oauth/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).send('Authorization code not provided.');
    }

    try {
        const tokenResponse = await axios.post('https://accounts.zoho.eu/oauth/v2/token', null, {
            params: {
                code,
                client_id: ZOHO_CLIENT_ID,
                client_secret: ZOHO_CLIENT_SECRET,
                redirect_uri: ZOHO_REDIRECT_URI,
                grant_type: 'authorization_code'
            }
        });

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        // Store refresh token securely (e.g., in a database, or update .env for dev)
        const envPath = path.resolve(__dirname, '.env');
        let envContent = await fs.readFile(envPath, 'utf8');
        // Replace or add ZOHO_REFRESH_TOKEN
        if (envContent.includes('ZOHO_REFRESH_TOKEN')) {
            envContent = envContent.replace(/^ZOHO_REFRESH_TOKEN=.*$/m, `ZOHO_REFRESH_TOKEN=${refresh_token}`);
        } else {
            envContent += `\nZOHO_REFRESH_TOKEN=${refresh_token}`;
        }
        await fs.writeFile(envPath, envContent);

        console.log('Zoho Access Token obtained. Refresh Token saved.');

        res.status(200).send('Authorization successful! You can close this window.');
    } catch (error) {
        console.error('Error during Zoho OAuth callback:', error.response ? error.response.data : error.message);
        res.status(500).send('Authorization failed.');
    }
});

// NEW: Route to check Zoho authentication status
app.get('/api/auth/status', (req, res) => {
    // A simple check: if a refresh token exists, we assume we can re-authenticate
    const isAuthenticated = !!process.env.ZOHO_REFRESH_TOKEN;
    res.json({ isAuthenticated });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Middleware to ensure Zoho token is available before making Zoho API calls
// This will attempt to refresh the token if it's expired or not present
app.use(async (req, res, next) => {
    // Skip auth check for auth-related routes, health check, or static files
    if (req.path.startsWith('/oauth') || req.path.startsWith('/api/auth/status') || req.path.startsWith('/health') || req.path.startsWith('/static')) {
        return next();
    }
    try {
        const accessToken = await getZohoAccessToken(); // Get current access token (handles refresh internally)
        if (!accessToken) {
            // If getZohoAccessToken couldn't provide a token (e.g., no refresh token available)
            console.warn("Zoho Access Token not available after refresh attempt.");
            return res.status(401).json({ message: 'Zoho authentication required. Please re-authorize.' });
        }
        // If token is available, proceed
        next();
    } catch (error) {
        console.error("Error in Zoho token middleware:", error);
        res.status(500).json({ message: 'Server error during Zoho token validation. Please check server logs.' });
    }
});


// NEW: Zoho Items API Endpoint
app.get('/api/zoho/items', async (req, res) => {
    try {
        const accessToken = await getZohoAccessToken(); // Get the valid access token
        if (!accessToken) {
            return res.status(401).json({ message: 'Zoho access token not available for fetching items.' });
        }

        const { page, per_page, sort_column, sort_order, search_text, filterInactive } = req.query;

        // Map sort_order from frontend to Zoho API ('A' or 'D')
        let zohoSortOrder = 'A'; // default
        if (sort_order === 'desc') zohoSortOrder = 'D';
        else if (sort_order === 'asc') zohoSortOrder = 'A';

        const params = {
            organization_id: ZOHO_ORGANIZATION_ID,
            page: page || 1,
            per_page: per_page || 200, // Increased default to 200 (Zoho's max)
            sort_column: sort_column || 'name',
            sort_order: zohoSortOrder
        };

        if (search_text) {
            params.search_text = search_text;
        }

        // Correctly map frontend 'filterInactive' (boolean string) to Zoho API 'status'
        if (filterInactive === 'true') {
            params.status = 'active'; // Only fetch active items
        }
        // If filterInactive is 'false' or not provided, we omit the status parameter
        // to fetch all items (active and inactive) from Zoho.

        const response = await axios.get(`${ZOHO_BASE_URL}/items`, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`
            },
            params: params
        });

        res.json(response.data); // Zoho API typically returns { items: [], page_context: {} }
    } catch (error) {
        console.error('Error fetching Zoho items:', error.response ? error.response.data : error.message);
        let errorMessage = 'Failed to fetch Zoho items.';
        if (error.response && error.response.data && error.response.data.message) {
            errorMessage = error.response.data.message;
        } else if (error.message.includes('status code 401')) {
            errorMessage = 'Unauthorized. Please re-authorize Zoho.';
        }
        res.status(error.response ? error.response.status : 500).json({ message: errorMessage });
    }
});

// NEW: Complete Sync Workflow Endpoint
app.post('/api/workflow/complete-sync', async (req, res) => {
    let zohoItemsFetched = 0;
    let matchedItems = 0;
    let itemsUploadedToFaire = 0;

    try {
        console.log('Starting sync: Fetching all Zoho items for full sync...');
        const accessToken = await getZohoAccessToken();
        if (!accessToken) {
            throw new Error('Zoho access token not available for complete sync workflow.');
        }

        // Fetch ALL ACTIVE Zoho items for the sync process (with pagination)
        let allZohoItems = [];
        let page = 1;
        const perPage = 200;
        let totalPages = 1;
        do {
            const response = await axios.get(`${ZOHO_BASE_URL}/items`, {
                headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` },
                params: { 
                    organization_id: ZOHO_ORGANIZATION_ID, 
                    per_page: perPage, 
                    page,
                    status: 'active' // Only fetch active items
                }
            });
            const items = response.data.items || [];
            allZohoItems = allZohoItems.concat(items);
            if (response.data.page_context && response.data.page_context.has_more_page) {
                page++;
                totalPages++;
                await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay to avoid rate limits
            } else {
                break;
            }
        } while (true);
        zohoItemsFetched = allZohoItems.length;
        console.log(`Fetched ${zohoItemsFetched} Zoho items for sync.`);

        // Step 2: Match and Process Images (calls firebase-integration's logic)
        console.log('Matching and processing images with product data...');
        // The `matchProductsWithImages` function in firebase-integration.js should
        // handle iterating through `allZohoItems`, checking for existing images in Firebase,
        // triggering processing if needed, and updating product records (e.g., in Firebase DB).
        const matchResult = await matchProductsWithImages(allZohoItems);
        matchedItems = matchResult ? matchResult.matchedCount || 0 : 0;
        console.log(`Matched and/or processed images for ${matchedItems} items.`);


        // Step 3: Upload to Faire (PLACEHOLDER - **YOU NEED TO IMPLEMENT THIS**)
        console.log('Attempting to upload/update items on Faire...');
        if (!FAIRE_ACCESS_TOKEN) {
            console.warn('FAIRE_ACCESS_TOKEN is not set in environment variables. Skipping Faire upload step.');
        } else {
            // Iterate through `allZohoItems` (or a subset that has processed images)
            // and make API calls to Faire.
            for (const item of allZohoItems) {
                // Example: Check if item has a processed image URL stored in Firebase/Zoho metadata
                // This logic depends on how `matchProductsWithImages` stores the processed image URLs.
                // For demonstration, let's assume `item.faire_image_url` would be set after matching.
                // if (item.faire_image_url && item.uploaded_to_faire !== true) {
                try {
                    // **REPLACE THIS WITH ACTUAL FAIRE API CALLS**
                    // Example Faire Product Upload (pseudo-code):
                    /*
                    await axios.post('https://api.faire.com/pe/v1/products', {
                        id: item.item_id, // Or a Faire-specific product ID
                        brand_id: "your_faire_brand_id", // Replace with your actual Faire Brand ID
                        name: item.name,
                        short_description: item.description || item.name,
                        product_type: item.item_type || "General",
                        wholesale_price_cents: Math.round(item.purchase_rate * 100),
                        retail_price_cents: Math.round(item.rate * 100),
                        currency_code: "GBP", // Or appropriate currency
                        images: [{ url: item.faire_image_url }] // Assuming you have this URL
                        // ... other Faire product fields
                    }, {
                        headers: {
                            'X-FAIRE-ACCESS-TOKEN': FAIRE_ACCESS_TOKEN,
                            'Content-Type': 'application/json'
                        }
                    });
                    */
                    itemsUploadedToFaire++; // Increment on successful *simulated* upload
                    // In a real scenario, you'd update Zoho/Firebase with Faire upload status
                    // e.g., mark item.uploaded_to_faire = true;
                } catch (faireError) {
                    console.error(`Failed to upload/update item ${item.sku} on Faire:`, faireError.response ? faireError.response.data : faireError.message);
                    // Log error but continue
                }
                // }
            }
            console.log(`Simulated Faire upload for ${itemsUploadedToFaire} items.`);
        }

        res.json({
            success: true,
            message: 'Complete sync workflow executed successfully.',
            summary: {
                zohoItemsFetched,
                matchedItems,
                itemsUploadedToFaire
            }
        });

    } catch (error) {
        console.error('Error during complete sync workflow:', error.response ? error.response.data : error.message);
        res.status(500).json({
            success: false,
            message: 'Complete sync workflow failed.',
            error: error.message
        });
    }
});

// Upload selected items to Faire
app.post('/api/faire/upload', async (req, res) => {
    try {
        if (!FAIRE_ACCESS_TOKEN) {
            return res.status(400).json({ success: false, message: 'FAIRE_ACCESS_TOKEN is not set in environment variables.' });
        }
        const items = req.body.items;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'No items provided for upload.' });
        }
        // Simulate upload to Faire (replace with real API call as needed)
        let uploaded = 0;
        for (const item of items) {
            // TODO: Replace this with actual Faire API call
            // Example:
            // await axios.post('https://api.faire.com/pe/v1/products', { ... }, { headers: { 'X-FAIRE-ACCESS-TOKEN': FAIRE_ACCESS_TOKEN } });
            uploaded++;
        }
        console.log(`Uploaded ${uploaded} items to Faire (simulated).`);
        res.json({ success: true, uploaded });
    } catch (error) {
        console.error('Error uploading to Faire:', error);
        res.status(500).json({ success: false, message: 'Failed to upload to Faire', error: error.message });
    }
});

// Existing Firebase image fetching endpoint (provided by user)
app.get('/api/firebase/images/:manufacturer/:sku', async (req, res) => {
    try {
        let { manufacturer, sku } = req.params;
        
        // Normalize the manufacturer name for Firebase path
        manufacturer = normalizeBrandName(manufacturer);

        if (!manufacturer || !sku) {
            return res.status(400).json({
                success: false,
                message: 'Manufacturer and SKU are required'
            });
        }

        const images = await getProductImages(manufacturer, sku);

        res.json({
            success: true,
            images: images,
            count: images.length
        });
    } catch (error) {
        console.error(`Error fetching images for ${req.params.manufacturer}/${req.params.sku}:`, error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch product images',
            error: error.message,
            images: []
        });
    }
});

// NEW: Firebase Brands API Endpoint (for ImageManagement component)
app.get('/api/firebase/brands', async (req, res) => {
    try {
        const brands = await getAvailableBrands();
        res.json({ success: true, brands });
    } catch (error) {
        console.error('Error fetching available brands:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch available brands', error: error.message });
    }
});

// NEW: Endpoint to handle image upload and processing (for ImageManagement component)
app.post('/api/firebase/upload-processed-image', upload.array('images'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files uploaded.' });
        }

        let { manufacturer, sku, padding, quality } = req.body;

        if (!manufacturer || !sku) {
            return res.status(400).json({ success: false, message: 'Manufacturer and SKU are required for image processing.' });
        }
        
        // Normalize manufacturer name for Firebase path
        manufacturer = normalizeBrandName(manufacturer);

        const uploadedFilePaths = req.files.map(file => file.path);
        const processedImageUrls = [];

        // Create a directory for processed images if it doesn't exist
        const processedOutputDir = path.join(__dirname, 'processed_images');
        await fs.mkdir(processedOutputDir, { recursive: true });

        for (const filePath of uploadedFilePaths) {
            try {
                // Run the Python script for processing
                const processResult = await runImageProcessor(filePath, processedOutputDir, {
                    outputFormat: 'webp', // Assuming WEBP is desired for Faire
                    padding: parseInt(padding) || 50,
                    quality: parseInt(quality) || 85
                });
                const processedImagePath = processResult.processedPath;

                if (!processedImagePath || !await fs.access(processedImagePath).then(() => true).catch(() => false)) {
                     throw new Error(`Processed image file not found at: ${processedImagePath}`);
                }

                // Read the processed image file
                const processedImageBuffer = await fs.readFile(processedImagePath);
                
                // Construct the destination path for Firebase Storage
                const destinationPath = `brand-images/${manufacturer}/${sku}_${Date.now()}.webp`;
                
                // Upload the processed image to Firebase Storage
                const { publicUrl } = await uploadProcessedImage(processedImageBuffer, destinationPath);
                processedImageUrls.push(publicUrl);

                // Clean up the locally stored processed file
                await fs.unlink(processedImagePath);

            } catch (processingError) {
                console.error(`Error processing or uploading image ${filePath}:`, processingError);
                // Log and continue to next file even if one fails
            } finally {
                // Clean up original uploaded file
                if (await fs.access(filePath).then(() => true).catch(() => false)) {
                    await fs.unlink(filePath);
                }
            }
        }

        if (processedImageUrls.length > 0) {
            res.json({
                success: true,
                message: `${processedImageUrls.length} images processed and uploaded successfully.`,
                imageUrls: processedImageUrls
            });
        } else {
            res.status(500).json({ success: false, message: 'No images were successfully processed and uploaded.' });
        }

    } catch (error) {
        console.error('Error in image upload/processing endpoint:', error);
        res.status(500).json({ success: false, message: 'Failed to process and upload images.', error: error.message });
    }
});

// NEW: Batch match images for products (for ImageManagement component)
app.post('/api/firebase/match-images', async (req, res) => {
    try {
        const items = req.body.items;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'No items provided for image matching.' });
        }
        const result = await matchProductsWithImages(items);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Error in /api/firebase/match-images:', error);
        res.status(500).json({ success: false, message: 'Failed to match images.', error: error.message });
    }
});

// NEW: Batch Image Upload Endpoint
app.post('/api/firebase/batch-upload-images', upload.array('images', 50), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files uploaded.' });
        }

        let { brand } = req.body;

        if (!brand) {
            return res.status(400).json({ success: false, message: 'Brand is required for batch upload.' });
        }
        
        // Normalize brand name for Firebase path
        const normalizedBrand = normalizeBrandName(brand);
        
        console.log(`Batch upload: Processing ${req.files.length} images for brand: ${brand} (normalized: ${normalizedBrand})`);

        // Create temp directories
        const tempInputDir = path.join(__dirname, 'uploads', 'batch-input', Date.now().toString());
        const tempOutputDir = path.join(__dirname, 'uploads', 'batch-output', Date.now().toString());
        await fs.mkdir(tempInputDir, { recursive: true });
        await fs.mkdir(tempOutputDir, { recursive: true });

        const processedResults = [];
        const failedUploads = [];

        try {
            // Move uploaded files to temp input directory with proper extensions
            for (const file of req.files) {
                const ext = path.extname(file.originalname) || '.jpg';
                const newPath = path.join(tempInputDir, `${path.basename(file.filename)}${ext}`);
                await fs.rename(file.path, newPath);
            }

            // Run all-in-one-processor.py on the batch
            const scriptPath = path.join(__dirname, 'all-in-one-processor.py');
            const args = [
                scriptPath,
                '--input', tempInputDir,
                '--output', tempOutputDir,
                '--brand', normalizedBrand, // Use normalized brand name
                '--padding', '50',
                '--quality', '85'
            ];

            console.log(`Running batch processor: python ${args.join(' ')}`);
            
            const pythonProcess = spawn('python', args);
            let scriptOutput = '';
            let scriptError = '';

            pythonProcess.stdout.on('data', (data) => {
                scriptOutput += data.toString();
                console.log(`Batch processor: ${data}`);
            });

            pythonProcess.stderr.on('data', (data) => {
                scriptError += data.toString();
                console.error(`Batch processor error: ${data}`);
            });

            await new Promise((resolve, reject) => {
                pythonProcess.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Python script exited with code ${code}. Error: ${scriptError}`));
                    }
                });

                pythonProcess.on('error', (err) => {
                    reject(err);
                });
            });

            // Upload processed images to Firebase
            const processedFiles = await fs.readdir(tempOutputDir);
            
            for (const filename of processedFiles) {
                try {
                    const filePath = path.join(tempOutputDir, filename);
                    
                    // Extract SKU from filename (assuming format: SKU_variant.ext or SKU.ext)
                    const baseName = path.basename(filename, path.extname(filename));
                    const sku = baseName.split('_')[0];
                    
                    // Read the processed image file
                    const processedImageBuffer = await fs.readFile(filePath);
                    
                    // Construct the destination path for Firebase Storage
                    const destinationPath = `brand-images/${normalizedBrand}/${filename}`;
                    
                    // Upload to Firebase
                    const { publicUrl } = await uploadProcessedImage(processedImageBuffer, destinationPath);
                    
                    processedResults.push({
                        filename: filename,
                        sku: sku,
                        url: publicUrl,
                        success: true
                    });
                } catch (uploadError) {
                    console.error(`Failed to upload ${filename}:`, uploadError);
                    failedUploads.push({
                        filename: filename,
                        error: uploadError.message
                    });
                }
            }

        } finally {
            // Cleanup temp directories
            try {
                await fs.rm(tempInputDir, { recursive: true, force: true });
                await fs.rm(tempOutputDir, { recursive: true, force: true });
            } catch (cleanupError) {
                console.error('Error cleaning up temp directories:', cleanupError);
            }
        }

        res.json({
            success: true,
            message: `Batch upload completed. ${processedResults.length} images processed successfully.`,
            processed: processedResults,
            failed: failedUploads,
            summary: {
                total: req.files.length,
                successful: processedResults.length,
                failed: failedUploads.length
            }
        });

    } catch (error) {
        console.error('Error in batch image upload:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Batch image upload failed.', 
            error: error.message 
        });
    }
});

// NEW: Get Faire status
app.get('/api/faire/status', (req, res) => {
    const connected = !!FAIRE_ACCESS_TOKEN;
    res.json({ connected });
});

// NEW: Get Firebase status
app.get('/api/firebase/status', (req, res) => {
    const connected = firebaseStorage !== undefined;
    res.json({ connected });
});

// NEW: Get items from Firestore (for future use)
app.get('/api/firebase/items', async (req, res) => {
    try {
        const { db } = initializeFirebase();
        if (!db) {
            return res.status(503).json({ success: false, message: 'Firestore not initialized' });
        }
        
        const { limit = 100, hasImages, manufacturer } = req.query;
        
        let query = db.collection('zofaire_items');
        
        if (hasImages === 'true') {
            query = query.where('hasImages', '==', true);
        } else if (hasImages === 'false') {
            query = query.where('hasImages', '==', false);
        }
        
        if (manufacturer && manufacturer !== 'all') {
            query = query.where('normalizedManufacturer', '==', normalizeBrandName(manufacturer));
        }
        
        query = query.orderBy('lastUpdated', 'desc').limit(parseInt(limit));
        
        const snapshot = await query.get();
        const items = [];
        
        snapshot.forEach(doc => {
            items.push({ id: doc.id, ...doc.data() });
        });
        
        res.json({ success: true, items, count: items.length });
        
    } catch (error) {
        console.error('Error fetching items from Firestore:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch items from Firestore', error: error.message });
    }
});


// Fallback for any other request (API only backend)
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API Base: ${ZOHO_BASE_URL}`);
    console.log(`Callback URL: ${ZOHO_REDIRECT_URI}`);

    console.log(`\n📋 Environment Status:`);
    console.log(`- ZOHO_CLIENT_ID: ${ZOHO_CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
    console.log(`- ZOHO_CLIENT_SECRET: ${ZOHO_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}`);
    console.log(`- ZOHO_ORGANIZATION_ID: ${ZOHO_ORGANIZATION_ID ? '✅ Set' : '❌ Missing'}`);
    console.log(`- FAIRE_ACCESS_TOKEN: ${FAIRE_ACCESS_TOKEN ? '✅ Set' : '❌ Missing'}`);
    // ZOHO_REFRESH_TOKEN is set dynamically by OAuth flow now, no need to check here.
    console.log(`- FIREBASE_SERVICE_ACCOUNT_JSON: ${process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? '✅ Set' : '❌ Missing'}`);
    console.log(`- FIREBASE_STORAGE_BUCKET: ${process.env.FIREBASE_STORAGE_BUCKET ? '✅ Set' : '🔶 Using default'}`);
});