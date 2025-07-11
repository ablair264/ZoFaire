import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Chip,
  Box,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  Download as DownloadIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

const ItemDetail = ({ open, onClose, item }) => {
  const theme = useTheme();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && item) {
      fetchItemImages();
    }
  }, [open, item]);

  const fetchItemImages = async () => {
    if (!item || !item.sku || !item.manufacturer) {
      setError('Item missing required information (SKU or manufacturer)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/firebase/images/${encodeURIComponent(item.manufacturer)}/${encodeURIComponent(item.sku)}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch images');
      }

      const data = await response.json();
      setImages(data.images || []);
    } catch (err) {
      console.error('Error fetching images:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadImage = (imageUrl, fileName) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!item) return null;

  // Debug: Log the item to see what we're working with
  console.log('ItemDetail received item:', item);
  
  // Check for any problematic object fields that might cause rendering issues
  const problematicFields = ['manufacturer_contact', 'manufacturer_part_number', 'manufacturer_name', 'manufacturer_website'];
  const hasProblematicFields = problematicFields.some(field => 
    item[field] && typeof item[field] === 'object'
  );
  
  if (hasProblematicFields) {
    console.warn('ItemDetail: Item contains problematic object fields:', 
      problematicFields.filter(field => item[field] && typeof item[field] === 'object')
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          backgroundColor: alpha(theme.palette.background.paper, 0.95),
          backdropFilter: 'blur(10px)',
          border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1
      }}>
        <Box>
                            <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                    {typeof item.name === 'string' ? item.name : 'No Name'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    SKU: {typeof item.sku === 'string' ? item.sku : 'No SKU'}
                  </Typography>
        </Box>
        <IconButton onClick={onClose} size="large">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Grid container spacing={3}>
          {/* Item Details */}
          <Grid item xs={12} md={6}>
            <Card sx={{ 
              height: 'fit-content',
              backgroundColor: alpha(theme.palette.background.paper, 0.7),
              border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
            }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Item Information
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Description
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 0.5 }}>
                    {typeof item.description === 'string' ? item.description : 'No description available'}
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Manufacturer
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {typeof item.manufacturer === 'string' ? item.manufacturer : 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Brand
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {typeof item.brand === 'string' ? item.brand : 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    <Chip 
                      label={typeof item.status === 'string' ? item.status : 'Unknown'} 
                      color={typeof item.status === 'string' && item.status === 'active' ? 'success' : 'default'}
                      size="small"
                      sx={{ mt: 0.5 }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Product Type
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {typeof item.product_type === 'string' ? item.product_type : 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Purchase Rate
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {formatCurrency(item.purchase_rate)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Selling Rate
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {formatCurrency(item.rate)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Stock Available
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {item.available_stock || item.stock_on_hand || 0}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Stock on Hand
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {item.stock_on_hand || 0}
                    </Typography>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Created
                  </Typography>
                  <Typography variant="body2">
                    {formatDate(item.created_time)}
                  </Typography>
                </Box>

                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Last Modified
                  </Typography>
                  <Typography variant="body2">
                    {formatDate(item.last_modified_time)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Images Section */}
          <Grid item xs={12} md={6}>
            <Card sx={{ 
              backgroundColor: alpha(theme.palette.background.paper, 0.7),
              border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <ImageIcon sx={{ mr: 1 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Product Images ({images.length})
                  </Typography>
                </Box>

                {loading && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                )}

                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}

                {!loading && !error && images.length === 0 && (
                  <Box sx={{ 
                    textAlign: 'center', 
                    py: 4,
                    color: theme.palette.text.secondary 
                  }}>
                    <ImageIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                    <Typography variant="body1">
                      No images found for this product
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Images will appear here once they are processed and matched
                    </Typography>
                  </Box>
                )}

                {!loading && !error && images.length > 0 && (
                  <Grid container spacing={2}>
                    {images.map((image, index) => (
                      <Grid item xs={6} key={index}>
                        <Card sx={{ 
                          position: 'relative',
                          border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
                        }}>
                          <CardMedia
                            component="img"
                            height="140"
                            image={image.url}
                            alt={`Product image ${index + 1}`}
                            sx={{ objectFit: 'cover' }}
                          />
                          <CardContent sx={{ p: 1 }}>
                            <Typography variant="caption" display="block">
                              {image.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {image.variant && `${image.variant} variant`}
                            </Typography>
                            
                            <Box sx={{ mt: 1, display: 'flex', gap: 0.5 }}>
                              <Tooltip title="Download image">
                                <IconButton 
                                  size="small"
                                  onClick={() => handleDownloadImage(image.url, image.name)}
                                >
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Copy image URL">
                                <IconButton 
                                  size="small"
                                  onClick={() => navigator.clipboard.writeText(image.url)}
                                >
                                  <LinkIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
        <Button 
          onClick={fetchItemImages} 
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : <InfoIcon />}
        >
          {loading ? 'Refreshing...' : 'Refresh Images'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ItemDetail; 