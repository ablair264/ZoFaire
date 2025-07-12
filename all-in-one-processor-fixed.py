#!/usr/bin/env python3
"""
Fixed All-in-One Product Image Processor
Handles both flat and nested directory structures
"""

import os
import re
import shutil
from pathlib import Path
from PIL import Image, ImageOps
import numpy as np
import argparse
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

class ProductImageProcessor:
    def __init__(self, padding=50, quality=85):
        self.padding = padding
        self.quality = quality
    
    def add_padding(self, image):
        """Add transparent padding around image."""
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
            
        width, height = image.size
        new_size = (width + 2 * self.padding, height + 2 * self.padding)
        
        padded = Image.new('RGBA', new_size, (0, 0, 0, 0))
        padded.paste(image, (self.padding, self.padding), image)
        
        return padded
    
    def extract_sku_from_filename(self, filename):
        """Extract SKU from various filename formats."""
        # Remove extension
        name_without_ext = os.path.splitext(filename)[0].lower()
        
        # Try different patterns
        # Pattern 1: SKU_description.jpg -> SKU
        # Pattern 2: SKU-description.jpg -> SKU
        # Pattern 3: SKU.jpg -> SKU
        
        # Split by common delimiters
        for delimiter in ['_', '-', ' ']:
            parts = name_without_ext.split(delimiter)
            if parts and parts[0]:
                # Return the first part as SKU
                return parts[0]
        
        # If no delimiter found, return the whole name
        return name_without_ext
    
    def process_and_organize(self, input_folder, output_folder, brand=None):
        """Process images with flexible input structure."""
        input_path = Path(input_folder)
        output_path = Path(output_folder)
        
        # Track statistics
        stats = {'processed': 0, 'failed': 0, 'skipped': 0}
        
        # Check if input has brand subfolders or is flat
        has_brand_folders = False
        for item in input_path.iterdir():
            if item.is_dir() and not item.name.startswith('.'):
                has_brand_folders = True
                break
        
        if has_brand_folders:
            # Original structure: process each brand folder
            logger.info("📁 Detected brand folder structure")
            for brand_folder in input_path.iterdir():
                if not brand_folder.is_dir() or brand_folder.name.startswith('.'):
                    continue
                    
                brand_name = brand_folder.name.lower()
                self._process_brand_folder(brand_folder, output_path / brand_name, stats)
        else:
            # Flat structure: all images in one folder
            logger.info("📁 Detected flat file structure")
            if brand:
                # Use provided brand name
                brand_name = brand.lower()
                logger.info(f"📁 Processing as brand: {brand_name}")
            else:
                # Try to detect brand from first file or use 'unknown'
                brand_name = 'unknown'
                logger.info("⚠️  No brand specified, using 'unknown'")
            
            self._process_brand_folder(input_path, output_path / brand_name, stats)
        
        # Summary
        logger.info("\n" + "="*50)
        logger.info("📊 PROCESSING COMPLETE")
        logger.info(f"✅ Processed: {stats['processed']} images")
        logger.info(f"❌ Failed: {stats['failed']} images")
        logger.info(f"⚠️  Skipped: {stats['skipped']} files")
        logger.info("="*50)
        
        return stats
    
    def _process_brand_folder(self, input_folder, output_folder, stats):
        """Process all images in a folder."""
        output_folder.mkdir(parents=True, exist_ok=True)
        brand_name = output_folder.name
        
        logger.info(f"\n📁 Processing brand: {brand_name}")
        
        # Group images by SKU
        sku_groups = {}
        
        # Collect all image files
        for img_file in input_folder.iterdir():
            if img_file.is_dir():
                continue
                
            if img_file.suffix.lower() not in ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.gif']:
                continue
            
            # Extract SKU
            sku = self.extract_sku_from_filename(img_file.name)
            
            if not sku:
                logger.warning(f"  ⚠️  Couldn't extract SKU from: {img_file.name}")
                stats['skipped'] += 1
                continue
            
            if sku not in sku_groups:
                sku_groups[sku] = []
            sku_groups[sku].append(img_file)
        
        # Process each SKU group
        for sku, files in sorted(sku_groups.items()):
            logger.info(f"  📦 SKU: {sku} ({len(files)} images)")
            
            # Sort files for consistent numbering
            files.sort(key=lambda x: x.name.lower())
            
            for idx, img_file in enumerate(files, 1):
                try:
                    # Open and process image
                    logger.info(f"    🖼️  Processing: {img_file.name}")
                    
                    image = Image.open(img_file)
                    
                    # Convert to RGBA if needed
                    if image.mode != 'RGBA':
                        image = image.convert('RGBA')
                    
                    # Add padding
                    image = self.add_padding(image)
                    
                    # Save main image
                    output_filename = f"{sku}_{idx}.webp"
                    output_file = output_folder / output_filename
                    
                    image.save(output_file, 'WEBP', quality=self.quality)
                    logger.info(f"    ✅ Saved as: {output_filename}")
                    
                    # Create 400x400 variant
                    thumb = image.copy()
                    thumb.thumbnail((400, 400), Image.Resampling.LANCZOS)
                    
                    # Center in 400x400 canvas
                    canvas = Image.new('RGBA', (400, 400), (0, 0, 0, 0))
                    x = (400 - thumb.width) // 2
                    y = (400 - thumb.height) // 2
                    canvas.paste(thumb, (x, y), thumb)
                    
                    thumb_filename = f"{sku}_{idx}_400x400.webp"
                    thumb_file = output_folder / thumb_filename
                    canvas.save(thumb_file, 'WEBP', quality=self.quality)
                    logger.info(f"    ✅ Created variant: {thumb_filename}")
                    
                    stats['processed'] += 1
                    
                except Exception as e:
                    logger.error(f"    ❌ Failed: {str(e)}")
                    stats['failed'] += 1

def main():
    parser = argparse.ArgumentParser(
        description='All-in-one product image processor for Firebase/ProductCard'
    )
    
    parser.add_argument('--input', required=True, help='Input folder')
    parser.add_argument('--output', required=True, help='Output folder')
    parser.add_argument('--brand', help='Brand name (for flat folder structure)')
    parser.add_argument('--padding', type=int, default=50, help='Padding in pixels')
    parser.add_argument('--quality', type=int, default=85, help='WebP quality')
    
    args = parser.parse_args()
    
    # Example structure message
    logger.info("📌 This processor handles both structures:")
    logger.info("   1. Nested: input/brand_name/images")
    logger.info("   2. Flat: input/images (use --brand flag)")
    logger.info("")
    
    # Check input exists
    if not Path(args.input).exists():
        logger.error(f"❌ Input folder not found: {args.input}")
        return 1
    
    # Process
    processor = ProductImageProcessor(
        padding=args.padding,
        quality=args.quality
    )
    
    stats = processor.process_and_organize(args.input, args.output, args.brand)
    
    if stats['processed'] > 0:
        logger.info(f"\n✨ Processing complete! Check '{args.output}' folder")
    
    return 0 if stats['failed'] == 0 else 1

if __name__ == "__main__":
    exit(main())
