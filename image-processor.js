// image-processor.js - JavaScript-based image processing for ZoFaire
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');

class ImageProcessor {
  constructor(options = {}) {
    this.padding = options.padding || 50;
    this.quality = options.quality || 85;
    this.maxSize = options.maxSize || { width: 1200, height: 1200 };
    this.variants = options.variants || [
      { suffix: '_400x400', width: 400, height: 400 },
      { suffix: '_150x150', width: 150, height: 150 }
    ];
  }

  /**
   * Download image from URL
   */
  async downloadImage(url, outputPath) {
    try {
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 30000
      });

      const writer = require('fs').createWriteStream(outputPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(outputPath));
        writer.on('error', reject);
      });
    } catch (error) {
      console.error(`Failed to download ${url}:`, error.message);
      throw error;
    }
  }

  /**
   * Process a single image
   */
  async processImage(inputPath, options = {}) {
    try {
      // Read image metadata
      const metadata = await sharp(inputPath).metadata();
      console.log(`Processing image: ${path.basename(inputPath)} (${metadata.width}x${metadata.height})`);

      // Create sharp instance
      let image = sharp(inputPath);

      // Ensure RGBA
      if (metadata.channels < 4) {
        image = image.ensureAlpha();
      }

      // Resize if too large
      if (metadata.width > this.maxSize.width || metadata.height > this.maxSize.height) {
        image = image.resize(this.maxSize.width, this.maxSize.height, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Add padding
      const paddedImage = await this.addPadding(image, metadata);

      // Generate main WebP
      const mainBuffer = await paddedImage
        .webp({ quality: this.quality })
        .toBuffer();

      // Generate variants
      const variants = await this.createVariants(paddedImage, options);

      return {
        main: mainBuffer,
        variants: variants,
        metadata: {
          originalSize: { width: metadata.width, height: metadata.height },
          format: metadata.format,
          hasAlpha: metadata.hasAlpha || metadata.channels === 4
        }
      };

    } catch (error) {
      console.error('Image processing error:', error.message);
      throw error;
    }
  }

  /**
   * Add padding to image
   */
  async addPadding(image, metadata) {
    // Get current dimensions
    const processedMetadata = await image.metadata();
    const width = processedMetadata.width || metadata.width;
    const height = processedMetadata.height || metadata.height;

    // Calculate new dimensions with padding
    const paddedWidth = width + (2 * this.padding);
    const paddedHeight = height + (2 * this.padding);

    // Extend the image with transparent padding
    return image.extend({
      top: this.padding,
      bottom: this.padding,
      left: this.padding,
      right: this.padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    });
  }

  /**
   * Create size variants
   */
  async createVariants(image, options = {}) {
    const variants = {};
    const variantsToCreate = options.variants || this.variants;

    for (const variant of variantsToCreate) {
      try {
        // Clone the image for each variant
        const variantBuffer = await image
          .clone()
          .resize(variant.width, variant.height, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .webp({ quality: this.quality })
          .toBuffer();

        variants[variant.suffix] = variantBuffer;
        console.log(`Created variant: ${variant.suffix} (${variant.width}x${variant.height})`);

      } catch (error) {
        console.error(`Failed to create variant ${variant.suffix}:`, error.message);
      }
    }

    return variants;
  }

  /**
   * Process multiple images for a product
   */
  async processProductImages(sku, imagePaths, outputDir) {
    const results = {
      sku: sku,
      success: true,
      processed: [],
      failed: []
    };

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      const imageIndex = i + 1;

      try {
        console.log(`\nProcessing image ${imageIndex}/${imagePaths.length} for SKU: ${sku}`);

        // Process the image
        const processed = await this.processImage(imagePath);

        // Save main image
        const mainFilename = `${sku.toLowerCase()}_${imageIndex}.webp`;
        const mainPath = path.join(outputDir, mainFilename);
        await fs.writeFile(mainPath, processed.main);

        const savedFiles = {
          main: mainFilename,
          variants: {}
        };

        // Save variants
        for (const [suffix, buffer] of Object.entries(processed.variants)) {
          const variantFilename = `${sku.toLowerCase()}_${imageIndex}${suffix}.webp`;
          const variantPath = path.join(outputDir, variantFilename);
          await fs.writeFile(variantPath, buffer);
          savedFiles.variants[suffix] = variantFilename;
        }

        results.processed.push({
          index: imageIndex,
          originalPath: imagePath,
          files: savedFiles,
          metadata: processed.metadata
        });

        console.log(`✅ Saved: ${mainFilename} + ${Object.keys(processed.variants).length} variants`);

      } catch (error) {
        console.error(`❌ Failed to process image ${imageIndex}:`, error.message);
        results.failed.push({
          index: imageIndex,
          originalPath: imagePath,
          error: error.message
        });
        results.success = false;
      }
    }

    return results;
  }

  /**
   * Process images from URLs (for Zoho image URLs)
   */
  async processFromUrls(sku, imageUrls, outputDir) {
    const tempDir = path.join(outputDir, 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    const downloadedPaths = [];

    try {
      // Download all images first
      for (let i = 0; i < imageUrls.length; i++) {
        const url = imageUrls[i];
        const ext = path.extname(new URL(url).pathname) || '.jpg';
        const tempPath = path.join(tempDir, `temp_${sku}_${i + 1}${ext}`);

        console.log(`Downloading image ${i + 1}/${imageUrls.length}...`);
        await this.downloadImage(url, tempPath);
        downloadedPaths.push(tempPath);
      }

      // Process downloaded images
      const results = await this.processProductImages(sku, downloadedPaths, outputDir);

      // Cleanup temp files
      for (const tempPath of downloadedPaths) {
        try {
          await fs.unlink(tempPath);
        } catch (error) {
          console.warn(`Failed to delete temp file: ${tempPath}`);
        }
      }

      // Remove temp directory
      try {
        await fs.rmdir(tempDir);
      } catch (error) {
        console.warn(`Failed to remove temp directory: ${tempDir}`);
      }

      return results;

    } catch (error) {
      // Cleanup on error
      for (const tempPath of downloadedPaths) {
        try {
          await fs.unlink(tempPath);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      throw error;
    }
  }

  /**
   * Batch process multiple products
   */
  async batchProcess(products, outputBaseDir, options = {}) {
    const results = {
      total: products.length,
      processed: 0,
      failed: 0,
      products: []
    };

    const batchSize = options.batchSize || 5;
    const delayMs = options.delayMs || 1000;

    console.log(`\n🚀 Starting batch processing of ${products.length} products...`);

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const batchPromises = [];

      for (const product of batch) {
        if (!product.sku) {
          console.warn(`⚠️  Skipping product without SKU: ${product.name}`);
          results.failed++;
          continue;
        }

        const manufacturer = product.manufacturer || product.brand || 'unknown';
        const outputDir = path.join(outputBaseDir, manufacturer.toLowerCase());

        const processPromise = (async () => {
          try {
            let productResult;

            if (product.images && product.images.length > 0) {
              // Process from URLs
              productResult = await this.processFromUrls(product.sku, product.images, outputDir);
            } else if (product.localImages && product.localImages.length > 0) {
              // Process from local paths
              productResult = await this.processProductImages(product.sku, product.localImages, outputDir);
            } else {
              console.warn(`⚠️  No images for product: ${product.sku}`);
              return {
                sku: product.sku,
                success: false,
                error: 'No images provided'
              };
            }

            results.processed++;
            return productResult;

          } catch (error) {
            console.error(`❌ Failed to process product ${product.sku}:`, error.message);
            results.failed++;
            return {
              sku: product.sku,
              success: false,
              error: error.message
            };
          }
        })();

        batchPromises.push(processPromise);
      }

      const batchResults = await Promise.all(batchPromises);
      results.products.push(...batchResults);

      console.log(`\nBatch ${Math.floor(i / batchSize) + 1} complete. Progress: ${results.processed + results.failed}/${products.length}`);

      // Add delay between batches
      if (i + batchSize < products.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 BATCH PROCESSING COMPLETE');
    console.log(`✅ Successfully processed: ${results.processed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log('='.repeat(60));

    return results;
  }

  /**
   * Create processing manifest
   */
  async createManifest(results, outputPath) {
    const manifest = {
      timestamp: new Date().toISOString(),
      summary: {
        total: results.total || results.products.length,
        processed: results.processed || results.products.filter(p => p.success).length,
        failed: results.failed || results.products.filter(p => !p.success).length
      },
      products: results.products.map(product => ({
        sku: product.sku,
        success: product.success,
        images: product.processed || [],
        errors: product.failed || [],
        error: product.error
      }))
    };

    await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2));
    console.log(`📋 Created manifest: ${outputPath}`);

    return manifest;
  }
}

module.exports = ImageProcessor;