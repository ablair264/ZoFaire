#!/usr/bin/env python3
"""
Image Renamer for ProductCard
Renames images to match the expected format: sku_1.webp, sku_2.webp, etc.
"""

import os
import shutil
from pathlib import Path
import re

def rename_images_for_brand(brand_folder):
    """
    Rename images in a brand folder to match ProductCard expectations.
    Groups images by SKU and numbers them.
    """
    brand_path = Path(brand_folder)
    if not brand_path.exists():
        print(f"Folder not found: {brand_folder}")
        return
    
    print(f"\nProcessing brand: {brand_path.name}")
    
    # Group files by SKU
    sku_groups = {}
    
    for img_file in brand_path.glob("*"):
        if img_file.suffix.lower() in ['.webp', '.jpg', '.jpeg', '.png']:
            # Extract SKU from filename (everything before first underscore or number)
            filename = img_file.stem.lower()
            
            # Try to extract SKU (assumes SKU is at the start)
            # Matches: ABC123, ABC-123, etc.
            match = re.match(r'^([a-zA-Z0-9\-]+?)(?:_|$)', filename)
            if match:
                sku = match.group(1).lower()
            else:
                sku = filename.split('_')[0].lower()
            
            if sku not in sku_groups:
                sku_groups[sku] = []
            sku_groups[sku].append(img_file)
    
    # Rename files
    for sku, files in sku_groups.items():
        print(f"  SKU: {sku} - {len(files)} images")
        
        # Sort files to ensure consistent ordering
        files.sort()
        
        for i, img_file in enumerate(files, 1):
            # Create new filename
            new_name = f"{sku}_{i}{img_file.suffix.lower()}"
            new_path = brand_path / new_name
            
            # Skip if already correctly named
            if img_file.name.lower() == new_name:
                continue
            
            # Rename (handle conflicts)
            if new_path.exists():
                temp_name = f"{sku}_{i}_temp{img_file.suffix.lower()}"
                temp_path = brand_path / temp_name
                shutil.move(str(img_file), str(temp_path))
                print(f"    {img_file.name} -> {temp_name} (temp)")
            else:
                shutil.move(str(img_file), str(new_path))
                print(f"    {img_file.name} -> {new_name}")

def create_size_variants(brand_folder):
    """
    Create size variants (e.g., sku_1_400x400.webp) from base images.
    """
    from PIL import Image
    
    brand_path = Path(brand_folder)
    sizes = [(400, 400), (150, 150)]  # Add more sizes as needed
    
    print(f"\nCreating size variants for: {brand_path.name}")
    
    for img_file in brand_path.glob("*_[0-9].webp"):
        base_name = img_file.stem
        
        for width, height in sizes:
            variant_name = f"{base_name}_{width}x{height}.webp"
            variant_path = brand_path / variant_name
            
            if variant_path.exists():
                continue
            
            try:
                # Open and resize
                img = Image.open(img_file)
                img.thumbnail((width, height), Image.Resampling.LANCZOS)
                
                # Create new image with exact dimensions
                new_img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
                
                # Center the resized image
                x = (width - img.width) // 2
                y = (height - img.height) // 2
                new_img.paste(img, (x, y), img if img.mode == 'RGBA' else None)
                
                # Save
                new_img.save(variant_path, 'WEBP', quality=85)
                print(f"  Created: {variant_name}")
                
            except Exception as e:
                print(f"  Error creating variant {variant_name}: {e}")

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Rename images for ProductCard format')
    parser.add_argument('folder', help='Brand folder or parent folder containing brand folders')
    parser.add_argument('--create-sizes', action='store_true', help='Also create size variants')
    
    args = parser.parse_args()
    
    folder_path = Path(args.folder)
    
    if not folder_path.exists():
        print(f"Error: Folder not found: {folder_path}")
        return
    
    # Check if this is a brand folder or parent folder
    if any(folder_path.glob("*.webp")) or any(folder_path.glob("*.jpg")):
        # This is a brand folder
        rename_images_for_brand(folder_path)
        if args.create_sizes:
            create_size_variants(folder_path)
    else:
        # This is a parent folder containing brand folders
        for brand_folder in folder_path.iterdir():
            if brand_folder.is_dir():
                rename_images_for_brand(brand_folder)
                if args.create_sizes:
                    create_size_variants(brand_folder)
    
    print("\nDone!")

if __name__ == "__main__":
    main()