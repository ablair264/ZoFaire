# Image and Price Display Fixes

## Changes Made:

### 1. ItemDetail Component (Image Display Fix)
- **Updated image fetching**: Now uses `/firebase/product-images/{sku}` endpoint instead of the old `/firebase/images/{manufacturer}/{sku}`
- **Checks item's images first**: If the item already has images in its data, it uses those instead of fetching
- **Better error handling**: More graceful handling when images aren't found

### 2. Price Display Fixes
- **Main Table**: 
  - Changed header from "Price" to "Purchase Price"
  - Now displays `item.purchase_price` (or fallback to `purchase_rate`)
  - Changed currency from $ to £
  
- **ItemDetail Modal**:
  - Shows "Purchase Price" and "Selling Price" with appropriate colors
  - Uses £ currency symbol
  - Fallbacks to alternative field names if needed

### 3. Server Updates
- Added `purchase_price` and `selling_price` fields to the item transformation in `/api/items`
- Ensures all price fields are properly passed through

### 4. UI Improvements
- Fixed brand display to properly show `item.brand` or fallback to `item.manufacturer`
- Removed misplaced visibility icon tooltip
- Better handling of image thumbnails in the main table

## How It Works Now:

1. **Images**: The ItemDetail modal first checks if the item has an `images` array. If not, it fetches from the API using just the SKU.

2. **Prices**: All prices now display in GBP (£) and show the purchase_price field as requested.

3. **Brand Display**: Properly shows the brand field with manufacturer as a fallback.

The modal should now correctly display images and prices for your items!
