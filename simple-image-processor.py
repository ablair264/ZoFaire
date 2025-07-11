#!/usr/bin/env python3
"""
Simple Product Image Processor
Quick script for basic image processing without background removal
"""

import os
from pathlib import Path
from PIL import Image

def process_image(input_path, output_path, padding=50):
    """Process a single image with padding only."""
    print(f"Processing: {input_path}")
    
    # Open and convert to RGBA
    img = Image.open(input_path).convert('RGBA')
    
    # Add padding
    width, height = img.size
    new_img = Image.new('RGBA', (width + 2*padding, height + 2*padding), (0,0,0,0))
    new_img.paste(img, (padding, padding), img)
    
    # Save as WebP
    output_path.parent.mkdir(parents=True, exist_ok=True)
    new_img.save(output_path, 'WEBP', quality=85)
    print(f"Saved: {output_path}")

def main():
    # Simple configuration
    INPUT_FOLDER = "input_images"
    OUTPUT_FOLDER = "brand-images"
    PADDING = 50
    
    input_path = Path(INPUT_FOLDER)
    output_path = Path(OUTPUT_FOLDER)
    
    # Process all images
    for img_file in input_path.rglob("*"):
        if img_file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']:
            # Create output path
            relative = img_file.relative_to(input_path)
            out_file = output_path / relative.with_suffix('.webp')
            
            # Make filename lowercase for SKU matching
            out_file = out_file.parent / out_file.name.lower()
            
            try:
                process_image(img_file, out_file, PADDING)
            except Exception as e:
                print(f"Error processing {img_file}: {e}")

if __name__ == "__main__":
    main()  
