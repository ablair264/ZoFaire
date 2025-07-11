#!/usr/bin/env python3
"""
Product Image Verifier
Checks if processed images match ProductCard expectations
"""

import os
from pathlib import Path
from PIL import Image
import re

def verify_images(folder_path):
    """Verify images are correctly formatted for ProductCard."""
    folder = Path(folder_path)
    
    if not folder.exists():
        print(f"❌ Folder not found: {folder_path}")
        return
    
    print("🔍 Product Image Verification Report")
    print("=" * 50)
    
    issues = []
    stats = {
        'total_images': 0,
        'webp_images': 0,
        'correct_naming': 0,
        'has_padding': 0,
        'brands': set(),
        'skus': set()
    }
    
    # Check each brand folder
    for brand_folder in folder.iterdir():
        if not brand_folder.is_dir():
            continue
            
        brand_name = brand_folder.name
        stats['brands'].add(brand_name)
        
        print(f"\n📁 Brand: {brand_name}")
        
        sku_images = {}
        
        # Check each image
        for img_file in brand_folder.iterdir():
            if img_file.is_file():
                stats['total_images'] += 1
                
                # Check WebP format
                if img_file.suffix.lower() == '.webp':
                    stats['webp_images'] += 1
                else:
                    issues.append(f"❌ Non-WebP file: {brand_name}/{img_file.name}")
                    continue
                
                # Check naming convention (sku_number.webp or sku_number_size.webp)
                filename = img_file.stem.lower()
                
                # Pattern: sku_1 or sku_1_400x400
                match = re.match(r'^([a-z0-9\-]+)_(\d+)(?:_\d+x\d+)?$', filename)
                
                if match:
                    sku = match.group(1)
                    number = int(match.group(2))
                    stats['correct_naming'] += 1
                    stats['skus'].add(sku)
                    
                    if sku not in sku_images:
                        sku_images[sku] = []
                    sku_images[sku].append((number, img_file.name))
                else:
                    issues.append(f"❌ Invalid naming: {brand_name}/{img_file.name}")
                
                # Check image properties
                try:
                    with Image.open(img_file) as img:
                        # Check if it has transparency (RGBA)
                        if img.mode != 'RGBA':
                            issues.append(f"⚠️  No alpha channel: {brand_name}/{img_file.name}")
                        
                        # Check for padding (simple check - transparent edges)
                        data = img.getdata()
                        # Check corners for transparency
                        corners = [
                            data[0],  # top-left
                            data[img.width - 1],  # top-right
                            data[img.width * (img.height - 1)],  # bottom-left
                            data[-1]  # bottom-right
                        ]
                        
                        if all(pixel[3] == 0 for pixel in corners if len(pixel) > 3):
                            stats['has_padding'] += 1
                        
                except Exception as e:
                    issues.append(f"❌ Cannot read image: {brand_name}/{img_file.name} - {str(e)}")
        
        # Report SKUs for this brand
        for sku, images in sorted(sku_images.items()):
            images.sort()  # Sort by number
            numbers = [num for num, _ in images]
            
            print(f"  ✅ SKU: {sku} - Images: {numbers}")
            
            # Check for gaps in numbering
            expected = list(range(1, max(numbers) + 1))
            missing = set(expected) - set(numbers)
            if missing:
                issues.append(f"⚠️  Missing images for {brand_name}/{sku}: {sorted(missing)}")
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 SUMMARY")
    print(f"Total images: {stats['total_images']}")
    print(f"WebP format: {stats['webp_images']}/{stats['total_images']}")
    print(f"Correct naming: {stats['correct_naming']}/{stats['total_images']}")
    print(f"Has padding: {stats['has_padding']}/{stats['total_images']}")
    print(f"Brands: {len(stats['brands'])} - {', '.join(sorted(stats['brands']))}")
    print(f"Unique SKUs: {len(stats['skus'])}")
    
    if issues:
        print("\n⚠️  ISSUES FOUND:")
        for issue in issues[:20]:  # Show first 20 issues
            print(f"  {issue}")
        if len(issues) > 20:
            print(f"  ... and {len(issues) - 20} more issues")
    else:
        print("\n✅ All images properly formatted!")
    
    # ProductCard compatibility check
    print("\n🎯 ProductCard Compatibility:")
    if stats['webp_images'] == stats['total_images']:
        print("  ✅ All images in WebP format")
    else:
        print(f"  ❌ {stats['total_images'] - stats['webp_images']} non-WebP images")
    
    if stats['correct_naming'] == stats['total_images']:
        print("  ✅ All images correctly named")
    else:
        print(f"  ❌ {stats['total_images'] - stats['correct_naming']} incorrectly named")
    
    print("\n📝 Expected structure for ProductCard:")
    print("  brand-images/")
    print("  ├── blomus/")
    print("  │   ├── abc123_1.webp")
    print("  │   ├── abc123_2.webp")
    print("  │   └── abc123_1_400x400.webp")
    print("  └── elvang/")
    print("      └── def456_1.webp")

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Verify images for ProductCard')
    parser.add_argument('folder', help='Folder to verify (e.g., brand-images)')
    
    args = parser.parse_args()
    
    verify_images(args.folder)

if __name__ == "__main__":
    main()