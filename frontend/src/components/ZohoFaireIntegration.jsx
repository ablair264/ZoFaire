import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  TablePagination,
  Toolbar,
  IconButton,
  Tooltip,
  LinearProgress
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Upload as UploadIcon,
  Inventory as InventoryIcon,
  CloudUpload as CloudUploadIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://zofaire.onrender.com/api';

const ZohoFaireIntegration = () => {
  // State management
  const [zohoItems, setZohoItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [metrics, setMetrics] = useState({
    zohoItems: 0,
    faireUploaded: 0,
    lastUpdate: null
  });
  const [alerts, setAlerts] = useState([]);
  const [uploadedItems, setUploadedItems] = useState(new Set());
  const [authStatus, setAuthStatus] = useState(null);

  // Check authentication status
  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL.replace('/api', '')}/auth/status`);
      const data = await response.json();
      setAuthStatus(data);
      return data.authenticated;
    } catch (error) {
      console.error('Error checking auth status:', error);
      return false;
    }
  };

  // Fetch data from Zoho Inventory API
  const fetchZohoItems = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/zoho/items`);
      
      if (response.status === 401) {
        // Authentication required
        const data = await response.json();
        addAlert('warning', 'Please authenticate with Zoho first');
        window.open(data.auth_url || '/auth/zoho', '_blank');
        return;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Transform Zoho API response to our format
        const items = data.items.map(item => ({
          item_id: item.item_id,
          name: item.name,
          description: item.description || '',
          rate: parseFloat(item.rate) || 0,
          sku: item.sku || '',
          status: item.status,
          category_name: item.category_name || 'Uncategorized',
          stock_on_hand: parseInt(item.stock_on_hand) || 0,
          created_time: item.created_time,
          item_type: item.item_type,
          unit: item.unit,
          brand: item.brand,
          manufacturer: item.manufacturer,
          uploaded_to_faire: false // We'll check this separately
        }));
        
        setZohoItems(items);
        updateMetrics(items);
        addAlert('success', `Successfully fetched ${items.length} items from Zoho Inventory`);
      } else {
        throw new Error(data.message || 'Failed to fetch items');
      }
      
    } catch (error) {
      console.error('Error fetching Zoho items:', error);
      addAlert('error', `Failed to fetch items from Zoho: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Check which items are already uploaded to Faire
  const checkFaireStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/faire/products`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const faireSKUs = new Set(data.products.map(p => p.sku));
          setUploadedItems(faireSKUs);
          
          // Update zoho items with Faire status
          setZohoItems(prev => prev.map(item => ({
            ...item,
            uploaded_to_faire: faireSKUs.has(item.sku)
          })));
        }
      }
    } catch (error) {
      console.error('Error checking Faire status:', error);
    }
  };

  // Upload selected items to Faire
  const uploadToFaire = async () => {
    if (selectedItems.size === 0) {
      addAlert('warning', 'Please select items to upload');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    const itemsToUpload = zohoItems.filter(item => 
      selectedItems.has(item.item_id) && !item.uploaded_to_faire
    );
    
    if (itemsToUpload.length === 0) {
      addAlert('warning', 'Selected items are already uploaded to Faire');
      setUploading(false);
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    
    try {
      for (let i = 0; i < itemsToUpload.length; i++) {
        const item = itemsToUpload[i];
        
        // Transform Zoho item to Faire product format
        const faireProduct = {
          name: item.name,
          description: item.description,
          sku: item.sku,
          wholesale_price_cents: Math.round(item.rate * 100),
          retail_price_cents: Math.round(item.rate * 2 * 100), // 2x markup
          category: mapZohoToFaireCategory(item.category_name),
          inventory_quantity: item.stock_on_hand,
          unit_multiplier: 1,
          minimum_order_quantity: 1,
          brand_name: item.brand || 'Default Brand',
          options: [{
            name: "Default",
            sku: item.sku,
            wholesale_price_cents: Math.round(item.rate * 100),
            retail_price_cents: Math.round(item.rate * 2 * 100),
            inventory_quantity: item.stock_on_hand,
            minimum_order_quantity: 1,
            unit_multiplier: 1
          }]
        };

        try {
          const response = await fetch(`${API_BASE_URL}/faire/products`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(faireProduct)
          });

          const result = await response.json();
          
          if (result.success) {
            successCount++;
            // Update the item status
            setZohoItems(prev => prev.map(prevItem => 
              prevItem.item_id === item.item_id 
                ? { ...prevItem, uploaded_to_faire: true }
                : prevItem
            ));
          } else {
            errorCount++;
            console.error(`Failed to upload ${item.sku}:`, result.message);
          }
          
        } catch (itemError) {
          errorCount++;
          console.error(`Error uploading item ${item.sku}:`, itemError);
        }
        
        // Update progress
        setUploadProgress(((i + 1) / itemsToUpload.length) * 100);
      }

      // Show results
      if (successCount > 0) {
        addAlert('success', `Successfully uploaded ${successCount} items to Faire`);
      }
      if (errorCount > 0) {
        addAlert('error', `Failed to upload ${errorCount} items to Faire`);
      }
      
      setSelectedItems(new Set());
      updateMetrics(zohoItems);

    } catch (error) {
      console.error('Error uploading to Faire:', error);
      addAlert('error', `Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Map Zoho categories to Faire categories
  const mapZohoToFaireCategory = (zohoCategory) => {
    const categoryMap = {
      'Accessories': 'accessories',
      'Clothing': 'apparel',
      'Home & Kitchen': 'home_and_living',
      'Electronics': 'electronics',
      'Beauty': 'beauty_and_wellness',
      'Jewelry': 'jewelry',
      'Bags': 'bags_and_luggage',
      'Shoes': 'shoes'
    };
    
    return categoryMap[zohoCategory] || 'other';
  };

  // Update metrics
  const updateMetrics = (items) => {
    setMetrics({
      zohoItems: items.length,
      faireUploaded: items.filter(item => item.uploaded_to_faire).length,
      lastUpdate: new Date().toLocaleString()
    });
  };

  // Add alert message
  const addAlert = (severity, message) => {
    const alert = { id: Date.now(), severity, message };
    setAlerts(prev => [...prev, alert]);
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== alert.id));
    }, 6000);
  };

  // Filter items based on search term
  const filteredItems = useMemo(() => {
    return zohoItems.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [zohoItems, searchTerm]);

  // Handle checkbox selection
  const handleSelectItem = (itemId) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const selectableIds = filteredItems
        .filter(item => !item.uploaded_to_faire)
        .map(item => item.item_id);
      setSelectedItems(new Set(selectableIds));
    } else {
      setSelectedItems(new Set());
    }
  };

  // Initialize data on component mount
  useEffect(() => {
    checkAuthStatus().then(isAuthenticated => {
      if (isAuthenticated) {
        fetchZohoItems();
      } else {
        addAlert('warning', 'Authentication required. Please authenticate with Zoho.');
      }
    });
  }, []);

  // Check Faire status after fetching Zoho items
  useEffect(() => {
    if (zohoItems.length > 0) {
      checkFaireStatus();
    }
  }, [zohoItems.length]);

  // Paginated items
  const paginatedItems = filteredItems.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box sx={{ padding: 3 }}>
      {/* Alerts */}
      <Box sx={{ position: 'fixed', top: 20, right: 20, zIndex: 1000, maxWidth: 400 }}>
        {alerts.map((alert) => (
          <Alert 
            key={alert.id} 
            severity={alert.severity} 
            sx={{ mb: 1 }}
            onClose={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}
          >
            {alert.message}
          </Alert>
        ))}
      </Box>

      {/* Header */}
      <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
        Zoho to Faire Integration Dashboard
      </Typography>

      {/* Authentication Status */}
      {authStatus && !authStatus.authenticated && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6">Authentication Required</Typography>
          <Typography>Please authenticate with Zoho to continue.</Typography>
          <Button 
            variant="contained" 
            color="primary" 
            sx={{ mt: 2 }}
            onClick={() => window.open('/auth/zoho', '_blank')}
          >
            Authenticate with Zoho
          </Button>
        </Alert>
      )}

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <InventoryIcon color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Items on Zoho
                  </Typography>
                  <Typography variant="h5">
                    {metrics.zohoItems}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <CloudUploadIcon color="success" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Items Uploaded to Faire
                  </Typography>
                  <Typography variant="h5">
                    {metrics.faireUploaded}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <ScheduleIcon color="info" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Last Update
                  </Typography>
                  <Typography variant="h6" fontSize="1rem">
                    {metrics.lastUpdate || 'Never'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Toolbar disableGutters>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search by name, SKU, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ mr: 2 }}
            />
            
            <Tooltip title="Refresh from Zoho">
              <IconButton 
                onClick={fetchZohoItems} 
                disabled={loading}
                color="primary"
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            
            <Button
              variant="contained"
              startIcon={uploading ? <CircularProgress size={20} /> : <UploadIcon />}
              onClick={uploadToFaire}
              disabled={selectedItems.size === 0 || uploading}
              sx={{ ml: 1 }}
            >
              {uploading ? 'Uploading...' : `Upload Selected (${selectedItems.size})`}
            </Button>
          </Toolbar>
          
          {uploading && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress variant="determinate" value={uploadProgress} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Upload progress: {Math.round(uploadProgress)}%
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Items Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedItems.size > 0 && selectedItems.size < filteredItems.filter(item => !item.uploaded_to_faire).length}
                  checked={filteredItems.filter(item => !item.uploaded_to_faire).length > 0 && selectedItems.size === filteredItems.filter(item => !item.uploaded_to_faire).length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>Category</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell align="right">Stock</TableCell>
              <TableCell>Faire Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography color="text.secondary">
                    No items found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((item) => (
                <TableRow key={item.item_id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedItems.has(item.item_id)}
                      onChange={() => handleSelectItem(item.item_id)}
                      disabled={item.uploaded_to_faire}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={item.status} 
                      color={item.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {item.name}
                    </Typography>
                    {item.description && (
                      <Typography variant="body2" color="text.secondary">
                        {item.description.substring(0, 60)}...
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {item.sku}
                    </Typography>
                  </TableCell>
                  <TableCell>{item.category_name}</TableCell>
                  <TableCell align="right">
                    ${item.rate.toFixed(2)}
                  </TableCell>
                  <TableCell align="right">{item.stock_on_hand}</TableCell>
                  <TableCell>
                    {item.uploaded_to_faire ? (
                      <Chip 
                        icon={<CheckCircleIcon />}
                        label="Uploaded" 
                        color="success" 
                        size="small"
                      />
                    ) : (
                      <Chip 
                        label="Not Uploaded" 
                        color="default" 
                        size="small"
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={filteredItems.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>
    </Box>
  );
};

export default ZohoFaireIntegration;