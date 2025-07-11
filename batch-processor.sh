#!/bin/bash
# batch_process.sh - Easy batch processing for product images

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Product Image Batch Processor${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python 3 is not installed${NC}"
    exit 1
fi

# Check if input folder is provided
if [ $# -eq 0 ]; then
    echo -e "${YELLOW}Usage: $0 <input_folder> [output_folder]${NC}"
    echo -e "${YELLOW}Example: $0 my_product_images${NC}"
    exit 1
fi

INPUT_FOLDER="$1"
OUTPUT_FOLDER="${2:-processed_images}"

# Check if input folder exists
if [ ! -d "$INPUT_FOLDER" ]; then
    echo -e "${RED}Error: Input folder '$INPUT_FOLDER' does not exist${NC}"
    exit 1
fi

# Install requirements if not already installed
echo -e "\n${YELLOW}Checking Python dependencies...${NC}"
pip install -q Pillow 2>/dev/null || {
    echo -e "${YELLOW}Installing required packages...${NC}"
    pip install Pillow
}

# Create the all-in-one processor if it doesn't exist
if [ ! -f "all_in_one_processor.py" ]; then
    echo -e "\n${YELLOW}Creating processor script...${NC}"
    echo -e "${RED}Note: all_in_one_processor.py not found!${NC}"
    echo -e "${RED}Please ensure the processor script is in the current directory.${NC}"
    exit 1
fi

# Run the processor
echo -e "\n${GREEN}Processing images...${NC}"
echo -e "${YELLOW}Input: $INPUT_FOLDER${NC}"
echo -e "${YELLOW}Output: $OUTPUT_FOLDER${NC}"
echo -e "${YELLOW}This will add padding and convert to WebP format${NC}"

python3 all_in_one_processor.py "$INPUT_FOLDER" "$OUTPUT_FOLDER"

# Check if processing was successful
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Processing complete!${NC}"
    echo -e "${GREEN}Your images are ready in: $OUTPUT_FOLDER${NC}"
    
    # Count processed images
    WEBP_COUNT=$(find "$OUTPUT_FOLDER" -name "*.webp" 2>/dev/null | wc -l)
    echo -e "${GREEN}Total WebP images created: $WEBP_COUNT${NC}"
    
    echo -e "\n${YELLOW}Next steps:${NC}"
    echo -e "1. Review the processed images in $OUTPUT_FOLDER"
    echo -e "2. Upload the entire folder to Firebase Storage"
    echo -e "3. Your ProductCard component will automatically find the images!"
else
    echo -e "\n${RED}❌ Processing failed. Check the error messages above.${NC}"
    exit 1
fi

# Optional: Create verification report
read -p $'\n'"Do you want to verify the processed images? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "image_verifier.py" ]; then
        python3 image_verifier.py "$OUTPUT_FOLDER"
    else
        echo -e "${YELLOW}Verification script not found. Skipping verification.${NC}"
    fi
fi

echo -e "\n${GREEN}Done! 🎉${NC}"
