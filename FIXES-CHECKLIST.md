# ZoFaire Fixes Checklist

## Pre-Implementation Checklist
- [ ] Backup current code
- [ ] Ensure Python environment has all dependencies
- [ ] Verify Firebase credentials are set

## Implementation Checklist

### Issue 1: Caching Fix
- [ ] Update `fetchItems` function in ZohoFaireIntegration.jsx
- [ ] Add new state variables (items, totalCount, selectedBrand, availableBrands)
- [ ] Test: Navigate between pages - should load instantly
- [ ] Test: Search should filter cached results without API call

### Issue 2: Image Matching Update
- [ ] Update `matchAllImages` function to force refresh after completion
- [ ] Update `/api/workflow/match-images` endpoint in server.js
- [ ] Test: Run "Match Images" - status should update immediately
- [ ] Test: Check image count shows in table after matching

### Issue 3: Brand Filter Fix
- [ ] Update `/api/items` endpoint to use brand_normalized
- [ ] Update frontend filter to use selectedBrand instead of selectedManufacturer
- [ ] Update FormControl from "Manufacturer" to "Brand"
- [ ] Test: Brand filter dropdown should work correctly

### Issue 4: UID Filter (310)
- [ ] Add UID filtering logic in `/api/items` endpoint
- [ ] Test: No items with UID starting with "310" should appear
- [ ] Check server logs for skip messages

### Issue 5: Batch Upload Fix
- [ ] Update `/api/firebase/batch-upload-images` endpoint
- [ ] Ensure proper directory structure creation
- [ ] Test: Upload images for a brand
- [ ] Verify images appear in Firebase Storage under correct path

## Post-Implementation Verification

### Frontend Tests
- [ ] Page loads quickly with cached data
- [ ] Search filters work without clearing cache
- [ ] Brand filter shows all unique brands
- [ ] Image status updates after matching
- [ ] No console errors in browser

### Backend Tests
- [ ] Run `node test-fixes.js` - all tests should pass
- [ ] Check server logs - no error messages
- [ ] Verify Firebase Storage structure is correct
- [ ] Check Firestore documents have images_matched field

### Performance Tests
- [ ] Initial page load: < 2 seconds
- [ ] Cached page load: < 500ms
- [ ] Image matching: processes 50 items/batch
- [ ] Batch upload: handles 10+ images smoothly

## Troubleshooting Commands

```bash
# Clear all Firebase cache
curl -X GET http://localhost:3001/api/firebase/preview-cleanup

# Test image matching for single SKU
curl -X POST http://localhost:3001/api/workflow/match-images \
  -H "Content-Type: application/json" \
  -d '{"products": [{"sku": "TEST123", "brand": "blomus"}]}'

# Check Firebase status
curl -X GET http://localhost:3001/api/firebase/status
```

## Success Indicators
✅ No items with UID starting with "310" in the list
✅ Brand filter works correctly
✅ Image status updates immediately after matching
✅ Batch upload creates correct folder structure
✅ Pages load from cache when navigating back
