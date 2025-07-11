#!/usr/bin/env python3
"""
Product Image Processor
Processes product images by:
1. Adding padding
2. Converting to WebP format
3. Optionally resizing to standard dimensions
"""

import os
import sys
from pathlib import Path
from PIL import Image, ImageOps
import numpy as np
from typing import Tuple, Optional
import argparse
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ImageProcessor:
    def __init__(self,
                 padding: int = 50,
                 output_size: Optional[Tuple[int, int]] = None,
                 quality: int = 85):
        """
        Initialize the image processor.
        
        Args:
            padding: Pixels of padding to add around the image
            output_size: Optional (width, height) to resize images to
            quality: WebP quality (1-100)
        """
        self.padding = padding
        self.output_size = output_size
        self.quality = quality
    
    def add_padding(self, image: Image.Image) -> Image.Image:
        """
        Add transparent padding around the image.
        
        Args:
            image: PIL Image object
            
        Returns:
            Image with padding
        """
        # Ensure image has alpha channel
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
        
        # Calculate new dimensions
        width, height = image.size
        new_width = width + (2 * self.padding)
        new_height = height + (2 * self.padding)
        
        # Create new image with transparent background
        padded_image = Image.new('RGBA', (new_width, new_height), (0, 0, 0, 0))
        
        # Paste original image in center
        padded_image.paste(image, (self.padding, self.padding), image)
        
        return padded_image
    
    def resize_image(self, image: Image.Image, size: Tuple[int, int]) -> Image.Image:
        """
        Resize image while maintaining aspect ratio.
        
        Args:
            image: PIL Image object
            size: Target (width, height)
            
        Returns:
            Resized image
        """
        # Use LANCZOS resampling for best quality
        image.thumbnail(size, Image.Resampling.LANCZOS)
        
        # Create new image with exact dimensions and transparent background
        new_image = Image.new('RGBA', size, (0, 0, 0, 0))
        
        # Center the resized image
        x = (size[0] - image.width) // 2
        y = (size[1] - image.height) // 2
        new_image.paste(image, (x, y), image)
        
        return new_image
    
    def process_image(self, input_path: Path, output_path: Path) -> bool:
        """
        Process a single image.
        
        Args:
            input_path: Path to input image
            output_path: Path to save processed image
            
        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info(f"Processing: {input_path.name}")
            
            # Open image
            image = Image.open(input_path)
            
            # Convert to RGBA if needed
            if image.mode != 'RGBA':
                image = image.convert('RGBA')
            
            # Add padding
            image = self.add_padding(image)
            
            # Resize if needed
            if self.output_size:
                image = self.resize_image(image, self.output_size)
            
            # Ensure output directory exists
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Save as WebP
            image.save(output_path, 'WEBP', quality=self.quality, lossless=False)
            
            logger.info(f"Saved: {output_path.name}")
            return True
            
        except Exception as e:
            logger.error(f"Error processing {input_path.name}: {str(e)}")
            return False
    
    def process_folder(self,
                      input_folder: Path,
                      output_folder: Path,
                      pattern: str = "*",
                      maintain_structure: bool = True) -> Tuple[int, int]:
        """
        Process all images in a folder.
        
        Args:
            input_folder: Path to input folder
            output_folder: Path to output folder
            pattern: File pattern to match (e.g., "*.jpg", "*.png")
            maintain_structure: Whether to maintain folder structure
            
        Returns:
            Tuple of (successful_count, failed_count)
        """
        success_count = 0
        failed_count = 0
        
        # Find all matching files
        if maintain_structure:
            # Process recursively maintaining structure
            for image_path in input_folder.rglob(pattern):
                if image_path.is_file():
                    # Calculate relative path
                    relative_path = image_path.relative_to(input_folder)
                    
                    # Create output path with .webp extension
                    output_path = output_folder / relative_path.with_suffix('.webp')
                    
                    if self.process_image(image_path, output_path):
                        success_count += 1
                    else:
                        failed_count += 1
        else:
            # Process all files into single output folder
            for image_path in input_folder.rglob(pattern):
                if image_path.is_file():
                    # Create output filename
                    output_filename = image_path.stem + '.webp'
                    output_path = output_folder / output_filename
                    
                    if self.process_image(image_path, output_path):
                        success_count += 1
                    else:
                        failed_count += 1
        
        return success_count, failed_count


def main():
    """Main function to handle command line arguments."""
    parser = argparse.ArgumentParser(
        description='Process product images: add padding, convert to WebP'
    )
    
    parser.add_argument('input_folder', type=str, help='Input folder containing images')
    parser.add_argument('output_folder', type=str, help='Output folder for processed images')
    
    parser.add_argument('--padding', type=int, default=50, help='Padding in pixels (default: 50)')
    parser.add_argument('--size', type=str, help='Output size as WIDTHxHEIGHT (e.g., 400x400)')
    parser.add_argument('--pattern', type=str, default='*', help='File pattern (default: *)')
    parser.add_argument('--quality', type=int, default=85, help='WebP quality 1-100 (default: 85)')
    parser.add_argument('--flatten-structure', action='store_true', help='Put all output files in single folder')
    
    args = parser.parse_args()
    
    # Parse size if provided
    output_size = None
    if args.size:
        try:
            width, height = map(int, args.size.split('x'))
            output_size = (width, height)
        except ValueError:
            logger.error(f"Invalid size format: {args.size}. Use WIDTHxHEIGHT (e.g., 400x400)")
            sys.exit(1)
    
    # Create processor
    processor = ImageProcessor(
        padding=args.padding,
        output_size=output_size,
        quality=args.quality
    )
    
    # Process folder
    input_path = Path(args.input_folder)
    output_path = Path(args.output_folder)
    
    if not input_path.exists():
        logger.error(f"Input folder does not exist: {input_path}")
        sys.exit(1)
    
    logger.info(f"Processing images from: {input_path}")
    logger.info(f"Output folder: {output_path}")
    logger.info(f"Settings: padding={args.padding}px, quality={args.quality}")
    
    if output_size:
        logger.info(f"Resizing to: {output_size[0]}x{output_size[1]}")
    
    success, failed = processor.process_folder(
        input_path,
        output_path,
        pattern=args.pattern,
        maintain_structure=not args.flatten_structure
    )
    
    logger.info(f"\nProcessing complete!")
    logger.info(f"Successful: {success}")
    logger.info(f"Failed: {failed}")


if __name__ == "__main__":
    main()
