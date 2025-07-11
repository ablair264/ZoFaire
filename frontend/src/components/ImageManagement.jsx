import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Paper,
  Chip,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Alert,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Tooltip,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Fab,
  Badge
} from '@mui/material';
import {
  Image as ImageIcon,
  CloudUpload as CloudUploadIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  PhotoCamera as PhotoCameraIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  AddPhotoAlternate as AddPhotoIcon,
  CloudSync as CloudSyncIcon
} from '@mui/icons-material';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://zofaire.onrender.com/api';

const ImageManagement = ({ zohoItems, onAlert }) => {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [imageDialog, setImageDialog] = useState(false);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [firebaseBrands, setFirebaseBrands] = useState([]);
  const [productImages, setProductImages] = useState({});
  const [imageStats, setImageStats] = useState({
    total: 0,
    matched: 0,
    missing: 0
  });
  const [processOptions, setProcessOptions] = useState({
    padding: 50,
    quality: 85,
    createVariants: true
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Load Firebase brands on mount
  useEffect(() => {
    loadFirebaseBrands();
  }, []);

  // Load Firebase brands
  const loadFirebaseBrands = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/firebase/brands`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setFirebaseBrands(data.brands);
        }
      }
    } catch (error) {
      console.error('Error loading Firebase brands:', error);
      onAlert('error', 'Failed to load brands from Firebase');
    }
  };

  // Match all products with Firebase images
  const matchAllImages = async () => {
    if (zohoItems.length === 0) {
      onAlert('warning', 'No products loaded');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/firebase/match-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: zohoItems })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Store image data for each product
          const imageMap = {};
          data.products.forEach(item => {
            imageMap[item.product.sku] = {
              matched: item.matched,
              images: item.images,
              error: item.error
            };
          });
          setProductImages(imageMap);

          // Update stats
          setImageStats({
            total: data.products.length,
            matched: data.matched,
            missing: data.notMatched
          });

          onAlert('success', `Image matching complete: ${data.matched} matched, ${data.notMatched} missing`);
        }
      }
    } catch (error) {
      console.error('Error matching images:', error);
      onAlert('error', 'Failed to match images with Firebase');
    } finally {
      setLoading(false);
    }
  };

  // Get images for a specific product
  const getProductImages = async (product) => {
    const manufacturer = product.manufacturer || product.brand || 'unknown';
    const sku = product.sku;

    if (!sku) {
      onAlert('warning', 'Product has no SKU');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/firebase/images/${manufacturer}/${sku}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProductImages(prev => ({
            ...prev,
            [sku]: {
              matched: data.images.length > 0,
              images: data.images,
              error: null
            }
          }));
          return data.images;
        }
      }
    } catch (error) {
      console.error('Error fetching product images:', error);
      onAlert('error', 'Failed to fetch product images');
    } finally {
      setLoading(false);
    }
  };

  // Process and upload images
  const processAndUploadImages = async () => {
    if (selectedFiles.length === 0) {
      onAlert('warning', 'Please select images to upload');
      return;
    }

    if (!selectedProduct) {
      onAlert('warning', 'Please select a product');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('sku', selectedProduct.sku);
      formData.append('name', selectedProduct.name);
      formData.append('manufacturer', selectedProduct.manufacturer || selectedProduct.brand || 'unknown');
      
      // Add options
      formData.append('options', JSON.stringify(processOptions));

      // Add files
      selectedFiles.forEach(file => {
        formData.append('images', file);
      });

      const response = await fetch(`${API_BASE_URL}/images/upload`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          onAlert('success', 'Images processed and uploaded successfully');
          setUploadDialog(false);
          setSelectedFiles([]);
          
          // Refresh images for this product
          await getProductImages(selectedProduct);
        }
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      onAlert('error', 'Failed to upload and process images');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Process images from Zoho URLs
  const processZohoImages = async (products) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/images/process-and-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: products,
          options: processOptions
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          onAlert('success', `Processed ${data.results.uploaded} images successfully`);
          // Refresh image status
          await matchAllImages();
        }
      }
    } catch (error) {
      console.error('Error processing Zoho images:', error);
      onAlert('error', 'Failed to process images');
    } finally {
      setLoading(false);
    }
  };

  // Complete sync workflow
  const runCompleteSync = async () => {
    setLoading(true);
    try {
      onAlert('info', 'Starting complete sync workflow...');
      
      const response = await fetch(`${API_BASE_URL}/workflow/complete-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fetchAllItems: true,
          matchImages: true,
          processImages: false,
          options: {
            maxPages: 100,
            delayMs: 300
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const summary = data.summary;
          onAlert('success', 
            `Sync complete: ${summary.zohoItems} items, ${summary.matchedImages} with images, ${summary.unmatchedImages} missing`
          );
          
          // Update local state with the results
          if (data.data && data.data.items) {
            const imageMap = {};
            data.data.items.forEach(item => {
              if (item.product && item.product.sku) {
                imageMap[item.product.sku] = {
                  matched: item.matched,
                  images: item.images || [],
                  error: item.error
                };
              }
            });
            setProductImages(imageMap);
          }
        }
      }
    } catch (error) {
      console.error('Error in complete sync:', error);
      onAlert('error', 'Complete sync failed');
    } finally {
      setLoading(false);
    }
  };

  // Get image status for a product
  const getImageStatus = (product) => {
    const imageData = productImages[product.sku];
    if (!imageData) return { status: 'unknown', count: 0 };
    
    if (imageData.matched && imageData.images.length > 0) {
      return { 
        status: 'matched', 
        count: imageData.images.filter(img => !img.isVariant).length 
      };
    }
    
    return { status: 'missing', count: 0 };
  };

  // File selection handler
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(files);
  };

  return (
    <Box>
      {/* Image Statistics Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📸 Image Management
          </Typography>
          
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <Box display="flex" gap={2}>
                <Chip 
                  icon={<CheckCircleIcon />}
                  label={`${imageStats.matched} Products with Images`}
                  color="success"
                  variant="outlined"
                />
                <Chip 
                  icon={<WarningIcon />}
                  label={`${imageStats.missing} Missing Images`}
                  color="warning"
                  variant="outlined"
                />
                <Chip 
                  label={`${firebaseBrands.length} Brands in Firebase`}
                  color="info"
                  variant="outlined"
                />
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6} textAlign="right">
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadFirebaseBrands}
                sx={{ mr: 1 }}
                disabled={loading}
              >
                Refresh Brands
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<ImageIcon />}
                onClick={matchAllImages}
                sx={{ mr: 1 }}
                disabled={loading || zohoItems.length === 0}
              >
                Match Images
              </Button>
              
              <Button
                variant="contained"
                startIcon={<CloudSyncIcon />}
                onClick={runCompleteSync}
                disabled={loading}
              >
                Complete Sync
              </Button>
            </Grid>
          </Grid>
          
          {loading && <LinearProgress sx={{ mt: 2 }} />}
        </CardContent>
      </Card>

      {/* Products with Image Status */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Product Image Status
        </Typography>
        
        <Grid container spacing={2}>
          {zohoItems.slice(0, 12).map((product) => {
            const imageStatus = getImageStatus(product);
            
            return (
              <Grid item xs={12} sm={6} md={4} key={product.item_id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Box flex={1}>
                        <Typography variant="subtitle2" noWrap>
                          {product.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          SKU: {product.sku}
                        </Typography>
                      </Box>
                      
                      <Box>
                        {imageStatus.status === 'matched' ? (
                          <Chip
                            size="small"
                            icon={<CheckCircleIcon />}
                            label={`${imageStatus.count} imgs`}
                            color="success"
                          />
                        ) : imageStatus.status === 'missing' ? (
                          <Chip
                            size="small"
                            icon={<WarningIcon />}
                            label="No imgs"
                            color="warning"
                          />
                        ) : (
                          <Chip
                            size="small"
                            label="Unknown"
                            color="default"
                          />
                        )}
                      </Box>
                    </Box>
                    
                    <Box mt={1} display="flex" gap={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setSelectedProduct(product);
                          setImageDialog(true);
                          if (!productImages[product.sku]) {
                            getProductImages(product);
                          }
                        }}
                      >
                        View
                      </Button>
                      
                      {imageStatus.status === 'missing' && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => {
                            setSelectedProduct(product);
                            setUploadDialog(true);
                          }}
                        >
                          Upload
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
        
        {zohoItems.length > 12 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            Showing first 12 products. Use the main table to see all products.
          </Typography>
        )}
      </Paper>

      {/* Image View Dialog */}
      <Dialog
        open={imageDialog}
        onClose={() => setImageDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedProduct?.name} - Images
          <Typography variant="caption" display="block">
            SKU: {selectedProduct?.sku}
          </Typography>
        </DialogTitle>
        
        <DialogContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : productImages[selectedProduct?.sku]?.images?.length > 0 ? (
            <ImageList cols={3} gap={8}>
              {productImages[selectedProduct.sku].images
                .filter(img => !img.isVariant)
                .map((image, index) => (
                  <ImageListItem key={index}>
                    <img
                      src={image.url}
                      alt={image.name}
                      loading="lazy"
                      style={{ objectFit: 'contain', backgroundColor: '#f5f5f5' }}
                    />
                    <ImageListItemBar
                      title={image.name}
                      subtitle={`${(image.size / 1024).toFixed(1)} KB`}
                      actionIcon={
                        <IconButton
                          sx={{ color: 'rgba(255, 255, 255, 0.54)' }}
                          onClick={() => window.open(image.url, '_blank')}
                        >
                          <DownloadIcon />
                        </IconButton>
                      }
                    />
                  </ImageListItem>
                ))}
            </ImageList>
          ) : (
            <Alert severity="warning">
              No images found for this product
            </Alert>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setImageDialog(false)}>Close</Button>
          {productImages[selectedProduct?.sku]?.images?.length === 0 && (
            <Button
              variant="contained"
              onClick={() => {
                setImageDialog(false);
                setUploadDialog(true);
              }}
            >
              Upload Images
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialog}
        onClose={() => setUploadDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Upload Images - {selectedProduct?.name}
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="image-file-input"
              multiple
              type="file"
              onChange={handleFileSelect}
            />
            <label htmlFor="image-file-input">
              <Button
                variant="outlined"
                component="span"
                startIcon={<AddPhotoIcon />}
                fullWidth
              >
                Select Images ({selectedFiles.length} selected)
              </Button>
            </label>
            
            {selectedFiles.length > 0 && (
              <List dense sx={{ mt: 2 }}>
                {selectedFiles.map((file, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <ImageIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={file.name}
                      secondary={`${(file.size / 1024).toFixed(1)} KB`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle2" gutterBottom>
              Processing Options
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Padding (px)"
                  type="number"
                  value={processOptions.padding}
                  onChange={(e) => setProcessOptions(prev => ({
                    ...prev,
                    padding: parseInt(e.target.value) || 50
                  }))}
                />
              </Grid>
              
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Quality (%)"
                  type="number"
                  value={processOptions.quality}
                  onChange={(e) => setProcessOptions(prev => ({
                    ...prev,
                    quality: parseInt(e.target.value) || 85
                  }))}
                />
              </Grid>
            </Grid>
          </Box>
          
          {uploading && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress variant="determinate" value={uploadProgress} />
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setUploadDialog(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={processAndUploadImages}
            disabled={selectedFiles.length === 0 || uploading}
            startIcon={uploading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
          >
            {uploading ? 'Processing...' : 'Process & Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ImageManagement;