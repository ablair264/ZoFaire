#!/usr/bin/env python3
"""
Zoho-Faire Integrated Image Processor
Processes product images for seamless integration between Zoho Inventory and Faire
"""

import os
import sys
import json
import shutil
from pathlib import Path
from PIL import Image, ImageOps
import requests
import argparse
import logging
from typing import Dict, List, Optional, Tuple
import re
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

class ZohoFaireImageProcessor:
    def __init__(self, padding=50, quality=85, max_size=(1200, 1200)):
        self.padding = padding
        self.quality = quality
        self.max_size = max_size
        self.processed_images = []
        
    def download_image(self, url: str, filename: str, output_dir: Path) -> Optional[Path]:
        """Download image from URL."""
        try:
            logger.info(f"📥 Downloading: {url}")
            response = requests.get(url, stream=True, timeout=30)
            response.raise_for_status()
            
            file_path = output_dir / filename
            with open(file_path, 'wb') as f:
                shutil.copyfileobj(response.raw, f)
            
            logger.info(f"✅ Downloaded: {filename}")
            return file_path
            
        except Exception as e:
            logger.error(f"❌ Download failed for {url}: {str(e)}")
            return None
    
    def process_image(self, image_path: Path, sku: str, image_index: int, output_dir: Path) -> Dict:
        """Process a single product image."""
        try:
            logger.info(f"🖼️  Processing: {image_path.name} for SKU: {sku}")
            
            # Open and convert to RGBA
            image = Image.open(image_path)
            if image.mode != 'RGBA':
                image = image.convert('RGBA')
            
            # Resize if too large
            if image.size[0] > self.max_size[0] or image.size[1] > self.max_size[1]:
                image.thumbnail(self.max_size, Image.Resampling.LANCZOS)
                logger.info(f"📏 Resized to: {image.size}")
            
            # Add padding
            image = self.add_padding(image)
            
            # Generate output filenames
            base_filename = f"{sku.lower()}_{image_index}"
            webp_filename = f"{base_filename}.webp"
            thumb_filename = f"{base_filename}_400x400.webp"
            
            # Save main image
            main_path = output_dir / webp_filename
            image.save(main_path, 'WEBP', quality=self.quality)
            
            # Create 400x400 thumbnail
            thumb = self.create_thumbnail(image, (400, 400))
            thumb_path = output_dir / thumb_filename
            thumb.save(thumb_path, 'WEBP', quality=self.quality)
            
            result = {
                'sku': sku,
                'index': image_index,
                'main_image': str(main_path),
                'thumbnail': str(thumb_path),
                'size': image.size,
                'success': True
            }
            
            self.processed_images.append(result)
            logger.info(f"✅ Processed: {webp_filename} + thumbnail")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Processing failed: {str(e)}")
            return {
                'sku': sku,
                'index': image_index,
                'error': str(e),
                'success': False
            }
    
    def add_padding(self, image: Image.Image) -> Image.Image:
        """Add transparent padding around image."""
        width, height = image.size
        new_size = (width + 2 * self.padding, height + 2 * self.padding)
        
        padded = Image.new('RGBA', new_size, (0, 0, 0, 0))
        padded.paste(image, (self.padding, self.padding), image)
        
        return padded
    
    def create_thumbnail(self, image: Image.Image, size: Tuple[int, int]) -> Image.Image:
        """Create centered thumbnail."""
        thumb = image.copy()
        thumb.thumbnail(size, Image.Resampling.LANCZOS)
        
        # Center in canvas
        canvas = Image.new('RGBA', size, (0, 0, 0, 0))
        x = (size[0] - thumb.width) // 2
        y = (size[1] - thumb.height) // 2
        canvas.paste(thumb, (x, y), thumb)
        
        return canvas
    
    def process_zoho_products(self, zoho_data: List[Dict], output_dir: Path, download_images: bool = True) -> Dict:
        """Process images for Zoho products."""
        logger.info(f"🚀 Processing {len(zoho_data)} products...")
        
        output_dir.mkdir(parents=True, exist_ok=True)
        results = {
            'total_products': len(zoho_data),
            'processed_products': 0,
            'total_images': 0,
            'processed_images': 0,
            'failed_images': 0,
            'products': []
        }
        
        for product in zoho_data:
            sku = product.get('sku', '').lower()
            if not sku:
                logger.warning(f"⚠️  No SKU found for product: {product.get('name', 'Unknown')}")
                continue
            
            logger.info(f"\n📦 Processing product: {product.get('name', 'Unknown')} (SKU: {sku})")
            
            # Get image URLs
            image_urls = []
            if 'image_url' in product and product['image_url']:
                image_urls.append(product['image_url'])
            
            if 'images' in product and isinstance(product['images'], list):
                image_urls.extend(product['images'])
            
            if not image_urls:
                logger.warning(f"⚠️  No images found for SKU: {sku}")
                continue
            
            results['total_images'] += len(image_urls)
            product_result = {
                'sku': sku,
                'name': product.get('name', ''),
                'images': [],
                'success': True
            }
            
            # Process each image
            for idx, image_url in enumerate(image_urls, 1):
                if download_images and image_url.startswith('http'):
                    # Download from URL
                    parsed_url = urlparse(image_url)
                    ext = Path(parsed_url.path).suffix or '.jpg'
                    temp_filename = f"temp_{sku}_{idx}{ext}"
                    temp_path = download_dir / temp_filename
                    
                    downloaded_path = self.download_image(image_url, temp_filename, output_dir)
                    if downloaded_path:
                        image_result = self.process_image(downloaded_path, sku, idx, output_dir)
                        downloaded_path.unlink()  # Clean up temp file
                    else:
                        continue
                else:
                    # Process local file
                    image_path = Path(image_url)
                    if image_path.exists():
                        image_result = self.process_image(image_path, sku, idx, output_dir)
                    else:
                        logger.error(f"❌ Image file not found: {image_url}")
                        continue
                
                if image_result['success']:
                    results['processed_images'] += 1
                    product_result['images'].append(image_result)
                else:
                    results['failed_images'] += 1
                    product_result['success'] = False
            
            if product_result['images']:
                results['processed_products'] += 1
            
            results['products'].append(product_result)
        
        return results
    
    def create_faire_image_manifest(self, results: Dict, output_dir: Path) -> Path:
        """Create manifest file for Faire upload."""
        manifest = {
            'processing_summary': {
                'total_products': results['total_products'],
                'processed_products': results['processed_products'],
                'total_images': results['processed_images']
            },
            'products': []
        }
        
        for product in results['products']:
            if product['success'] and product['images']:
                faire_product = {
                    'sku': product['sku'],
                    'name': product['name'],
                    'images': [
                        {
                            'url': f"brand-images/{Path(img['main_image']).name}",
                            'thumbnail_url': f"brand-images/{Path(img['thumbnail']).name}",
                            'index': img['index']
                        }
                        for img in product['images']
                    ]
                }
                manifest['products'].append(faire_product)
        
        manifest_path = output_dir / 'faire_image_manifest.json'
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)
        
        logger.info(f"📋 Created manifest: {manifest_path}")
        return manifest_path


def main():
    parser = argparse.ArgumentParser(description='Zoho-Faire Image Processor')
    parser.add_argument('--input', required=True, help='Input JSON file with Zoho product data')
    parser.add_argument('--output', default='processed-images', help='Output directory')
    parser.add_argument('--padding', type=int, default=50, help='Padding in pixels')
    parser.add_argument('--quality', type=int, default=85, help='WebP quality')
    parser.add_argument('--no-download', action='store_true', help='Skip downloading images from URLs')
    
    args = parser.parse_args()
    
    # Load Zoho product data
    input_path = Path(args.input)
    if not input_path.exists():
        logger.error(f"❌ Input file not found: {args.input}")
        sys.exit(1)
    
    with open(input_path, 'r') as f:
        zoho_data = json.load(f)
    
    if not isinstance(zoho_data, list):
        logger.error("❌ Input file must contain a JSON array of products")
        sys.exit(1)
    
    # Process images
    processor = ZohoFaireImageProcessor(
        padding=args.padding,
        quality=args.quality
    )
    
    output_dir = Path(args.output)
    results = processor.process_zoho_products(
        zoho_data, 
        output_dir, 
        download_images=not args.no_download
    )
    
    # Create manifest
    manifest_path = processor.create_faire_image_manifest(results, output_dir)
    
    # Summary
    logger.info("\n" + "="*60)
    logger.info("🎉 PROCESSING COMPLETE")
    logger.info(f"✅ Products processed: {results['processed_products']}/{results['total_products']}")
    logger.info(f"✅ Images processed: {results['processed_images']}")
    logger.info(f"❌ Images failed: {results['failed_images']}")
    logger.info(f"📁 Output directory: {output_dir}")
    logger.info(f"📋 Manifest file: {manifest_path}")
    logger.info("="*60)
    
    # Return results for Node.js integration
    if len(sys.argv) == 1:  # Called from Node.js
        print(json.dumps(results))


if __name__ == "__main__":
    main()