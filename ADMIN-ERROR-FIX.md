# Admin Not Defined Error Fix

## Error:
```
Failed to update images_matched for SKU 51557: ReferenceError: admin is not defined
at /opt/render/project/src/server.js:907:49
```

## Root Cause:
server.js was trying to use `admin.firestore.FieldValue.serverTimestamp()` without having the Firebase Admin SDK properly initialized.

## Solution:
Created a helper function `updateItemImagesStatus` in firebase-integration.js that properly handles Firestore updates with timestamps.

## Changes:

### 1. firebase-integration.js
Added new function:
```javascript
async function updateItemImagesStatus(sku, hasImages, imageCount = 0) {
  // Properly uses admin.firestore.FieldValue.serverTimestamp()
  // Handles all Firestore update logic
}
```

### 2. server.js
Updated endpoints to use the helper function:
- `/api/workflow/match-images`
- `/api/firebase/batch-upload-images`

Instead of:
```javascript
await itemsQuery.docs[0].ref.update({
    images_matched: true,
    lastImageUpdate: admin.firestore.FieldValue.serverTimestamp() // ERROR: admin not defined
});
```

Now using:
```javascript
await updateItemImagesStatus(sku, true, imageCount);
```

## Benefits:
1. Proper Firebase initialization
2. Consistent timestamp handling
3. Better error handling
4. Separation of concerns (Firebase logic stays in firebase-integration.js)
5. No need to import admin SDK in multiple files

## Testing:
Run image matching again - it should now properly update Firestore documents without errors.
