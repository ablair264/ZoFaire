#!/usr/bin/env python3
"""
All-in-One Product Image Processor
Processes, renames, and organizes images without background removal
Perfect for ProductCard image preparation
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
    
    def process_and_organize(self, input_folder, output_folder):
        """Process images and organize by brand with correct naming."""
        input_path = Path(input_folder)
        output_path = Path(output_folder)
        
        # Track statistics
        stats = {'processed': 0, 'failed': 0, 'skipped': 0}
        
        # Process each brand folder
        for brand_folder in input_path.iterdir():
            if not brand_folder.is_dir():
                continue
                
            brand_name = brand_folder.name.lower()
            brand_output = output_path / brand_name
            brand_output.mkdir(parents=True, exist_ok=True)
            
            logger.info(f"\n📁 Processing brand: {brand_name}")
            
            # Group images by SKU
            sku_groups = {}
            
            # First pass: collect all images
            for img_file in brand_folder.iterdir():
                if img_file.suffix.lower() not in ['.jpg', '.jpeg', '.png', '.bmp', '.webp']:
                    continue
                
                # Extract SKU from filename
                filename = img_file.stem.lower()
                
                # Try to extract SKU (handles various formats)
                # Examples: ABC123_front.jpg -> abc123
                #          ABC-123-detail.png -> abc-123
                #          SKU123.jpg -> sku123
                sku_match = re.match(r'^([a-zA-Z0-9\-]+?)(?:[_\-]|$)', filename)
                if sku_match:
                    sku = sku_match.group(1).lower()
                else:
                    sku = filename.split('_')[0].split('-')[0].lower()
                
                if not sku:
                    logger.warning(f"  ⚠️  Couldn't extract SKU from: {img_file.name}")
                    stats['skipped'] += 1
                    continue
                
                if sku not in sku_groups:
                    sku_groups[sku] = []
                sku_groups[sku].append(img_file)
            
            # Second pass: process and rename
            for sku, files in sorted(sku_groups.items()):
                logger.info(f"  📦 SKU: {sku} ({len(files)} images)")
                
                # Sort files for consistent numbering
                files.sort(key=lambda x: x.name.lower())
                
                for idx, img_file in enumerate(files, 1):
                    try:
                        # Open and process image
                        logger.info(f"    🖼️  Processing: {img_file.name}")
                        
                        image = Image.open(img_file)
                        
                        # Convert to RGBA if needed (preserves original image)
                        if image.mode != 'RGBA':
                            image = image.convert('RGBA')
                        
                        # Add padding
                        image = self.add_padding(image)
                        
                        # Save with correct naming
                        output_filename = f"{sku}_{idx}.webp"
                        output_file = brand_output / output_filename
                        
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
                        thumb_file = brand_output / thumb_filename
                        canvas.save(thumb_file, 'WEBP', quality=self.quality)
                        logger.info(f"    ✅ Created variant: {thumb_filename}")
                        
                        stats['processed'] += 1
                        
                    except Exception as e:
                        logger.error(f"    ❌ Failed: {str(e)}")
                        stats['failed'] += 1
        
        # Summary
        logger.info("\n" + "="*50)
        logger.info("📊 PROCESSING COMPLETE")
        logger.info(f"✅ Processed: {stats['processed']} images")
        logger.info(f"❌ Failed: {stats['failed']} images")
        logger.info(f"⚠️  Skipped: {stats['skipped']} files")
        logger.info("="*50)
        
        return stats

def main():
    parser = argparse.ArgumentParser(
        description='All-in-one product image processor for Firebase/ProductCard'
    )
    
    parser.add_argument('input', help='Input folder containing brand subfolders')
    parser.add_argument('output', help='Output folder for processed images')
    parser.add_argument('--padding', type=int, default=50, help='Padding in pixels (default: 50)')
    parser.add_argument('--quality', type=int, default=85, help='WebP quality (default: 85)')
    
    args = parser.parse_args()
    
    # Example structure message
    logger.info("📌 Expected input structure:")
    logger.info("   input_folder/")
    logger.info("   ├── blomus/")
    logger.info("   │   ├── ABC123_front.jpg")
    logger.info("   │   ├── ABC123_back.jpg")
    logger.info("   │   └── DEF456.png")
    logger.info("   ├── elvang/")
    logger.info("   └── remember/")
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
    
    stats = processor.process_and_organize(args.input, args.output)
    
    if stats['processed'] > 0:
        logger.info(f"\n✨ Upload the '{args.output}' folder to Firebase Storage!")
        logger.info("   Your images are ready for ProductCard component")
    
    return 0 if stats['failed'] == 0 else 1

if __name__ == "__main__":
    exit(main())
