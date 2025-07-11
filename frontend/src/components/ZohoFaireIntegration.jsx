import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  LinearProgress,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  useTheme,
  alpha,
  Avatar,
  Fade,
  FormControlLabel // <--- ADDED THIS IMPORT
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Upload as UploadIcon,
  Inventory as InventoryIcon,
  CloudUpload as CloudUploadIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Image as ImageIcon,
  FilterList as FilterListIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon // <--- ADDED THIS IMPORT
} from '@mui/icons-material';
import ImageManagement from './ImageManagement';
import ProgressLoader from './ProgressLoader';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://zofaire.onrender.com/api';

const ZohoFaireIntegration = () => {
  const theme = useTheme();
  // State management
  const [zohoItems, setZohoItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'fetchingZoho', 'matchingImages', 'uploadingToFaire', 'complete', 'error'
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [alerts, setAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState(0); // 0 for Zoho Items, 1 for Image Management
  const [authStatus, setAuthStatus] = useState(false);
  const [sortColumn, setSortColumn] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [filterInactive, setFilterInactive] = useState(false);


  const addAlert = useCallback((message, severity = 'info') => {
    const id = Date.now();
    setAlerts((prevAlerts) => [...prevAlerts, { id, message, severity }]);
    setTimeout(() => {
      removeAlert(id);
    }, 6000); // Alerts disappear after 6 seconds
  }, []);

  const removeAlert = useCallback((id) => {
    setAlerts((prevAlerts) => prevAlerts.filter((alert) => alert.id !== id));
  }, []);

  // Check authentication status on component mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/status`);
        const data = await response.json();
        setAuthStatus(data.isAuthenticated);
        if (!data.isAuthenticated) {
          addAlert('Zoho authentication is required. Please authorize the application.', 'warning');
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        addAlert('Failed to check authentication status. Please try again.', 'error');
      }
    };
    checkAuthStatus();
  }, [addAlert]);

  // Fetch Zoho Items
  const fetchZohoItems = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page + 1,
        per_page: rowsPerPage,
        sort_column: sortColumn,
        sort_order: sortOrder,
        filterInactive: filterInactive
      });
      if (searchTerm) {
        params.append('search_text', searchTerm);
      }

      const response = await fetch(`${API_BASE_URL}/zoho/items?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch Zoho items');
      }
      const data = await response.json();
      setZohoItems(data.items || []);
      addAlert('Zoho items fetched successfully!', 'success');
    } catch (error) {
      console.error('Error fetching Zoho items:', error);
      addAlert(`Error fetching Zoho items: ${error.message}`, 'error');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [page, rowsPerPage, searchTerm, sortColumn, sortOrder, filterInactive, addAlert]);

  useEffect(() => {
    if (authStatus && activeTab === 0) { // Only fetch if authenticated and on the Zoho Items tab
      fetchZohoItems();
    }
  }, [authStatus, fetchZohoItems, activeTab]);

  const handleAuthZoho = () => {
    const redirectUri = process.env.REACT_APP_ZOHO_REDIRECT_URI || 'https://zofaire.onrender.com/oauth/callback';
    const zohoAuthUrl = process.env.REACT_APP_ZOHO_AUTH_URL || 'https://accounts.zoho.eu/oauth/v2/auth';
    const clientId = process.env.REACT_APP_ZOHO_CLIENT_ID;

    const scope = 'ZohoInventory.items.READ,ZohoInventory.items.CREATE,ZohoInventory.items.UPDATE,ZohoInventory.CompositeItems.READ,ZohoInventory.CompositeItems.CREATE,ZohoInventory.CompositeItems.UPDATE,ZohoInventory.settings.READ,ZohoInventory.settings.CREATE,ZohoInventory.settings.UPDATE,ZohoInventory.organizations.READ,aaaserver.profile.READ';

    const authUrl = `${zohoAuthUrl}?scope=${scope}&client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&access_type=offline&prompt=consent`;

    // Open in a new tab/window
    window.open(authUrl, '_blank', 'noopener,noreferrer');
  };

  const handleToggleSelectAll = (event) => {
    if (event.target.checked) {
      const newSelected = new Set(zohoItems.map((n) => n.item_id));
      setSelectedItems(newSelected);
      addAlert(`Selected all ${newSelected.size} items.`, 'info');
    } else {
      setSelectedItems(new Set());
      addAlert('Cleared all selections.', 'info');
    }
  };

  const handleSelectItem = (event, itemId) => {
    const newSelected = new Set(selectedItems);
    if (event.target.checked) {
      newSelected.add(itemId);
      addAlert(`Item selected: ${itemId}`, 'info');
    } else {
      newSelected.delete(itemId);
      addAlert(`Item deselected: ${itemId}`, 'info');
    }
    setSelectedItems(newSelected);
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0); // Reset to first page when rows per page changes
  };

  const handleSort = (columnId) => {
    const isAsc = sortColumn === columnId && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortColumn(columnId);
  };

  const handleFilterInactiveChange = (event) => {
    setFilterInactive(event.target.checked);
  };

  const isSelected = (itemId) => selectedItems.has(itemId);

  const filteredItems = useMemo(() => {
    return zohoItems.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [zohoItems, searchTerm]);


  const handleCompleteSync = async () => {
    setLoading(true);
    setSyncStatus('fetchingZoho'); // Set initial status
    addAlert('Starting complete sync workflow...', 'info');

    try {
      // Simulate/track steps. In a real scenario, the backend might send progress updates
      // For now, we'll assume the backend sends a final message with details.
      const response = await fetch(`${API_BASE_URL}/workflow/complete-sync`, { method: 'POST' });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Complete sync failed on backend.');
      }

      const data = await response.json();

      if (data.summary) {
          const { zohoItemsFetched, matchedItems, itemsUploadedToFaire } = data.summary;
          addAlert(
              `Sync completed successfully! Fetched ${zohoItemsFetched} Zoho items, matched ${matchedItems} with images, and completed Faire upload for ${itemsUploadedToFaire} items.`,
              'success'
          );
      } else {
          addAlert(data.message, 'success');
      }

      setSyncStatus('complete'); // Set final status
      fetchZohoItems(true); // Refresh items after successful sync
    } catch (error) {
      console.error('Complete sync failed:', error);
      let errorMessage = 'Complete sync failed.';
      if (error.message.includes('Invalid value passed for filter_by')) {
          errorMessage = 'Sync failed: Unable to fetch items from Zoho due to an invalid status filter. Please ensure the backend is configured correctly.';
      } else {
          errorMessage = `Complete sync failed: ${error.message}`;
      }
      addAlert(errorMessage, 'error');
      setSyncStatus('error'); // Set error status
    } finally {
      setLoading(false);
    }
  };

  const getSyncButtonText = () => {
    if (loading) {
      switch (syncStatus) {
        case 'fetchingZoho':
          return 'Fetching Zoho Items...';
        case 'matchingImages':
          return 'Matching Images...';
        case 'uploadingToFaire':
          return 'Uploading to Faire...';
        case 'complete':
          return 'Sync Complete!';
        case 'error':
          return 'Sync Failed';
        default:
          return 'Processing...';
      }
    }
    return 'Complete Sync';
  };


  return (
    <Box sx={{ p: 3, maxWidth: '100%', mx: 'auto', mt: 4, mb: 4 }}>
      {/* Alerts display */}
      <Box sx={{ position: 'fixed', top: 100, right: 20, zIndex: 9999 }}>
        <Fade in={alerts.length > 0}>
          <Box>
            {alerts.map((alert) => (
              <Alert
                key={alert.id}
                severity={alert.severity}
                onClose={() => removeAlert(alert.id)}
                sx={{ mb: 1, boxShadow: 3 }}
              >
                {alert.message}
              </Alert>
            ))}
          </Box>
        </Fade>
      </Box>

      {/* Progress Loader Overlay */}
      {loading && <ProgressLoader message={getSyncButtonText()} />}

      <Paper
        elevation={theme.palette.mode === 'dark' ? 5 : 3}
        sx={{
          p: 3,
          borderRadius: 2,
          backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.7) : alpha(theme.palette.background.paper, 0.9),
          backdropFilter: 'blur(10px)',
          border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 700,
            color: theme.palette.text.primary,
            mb: 3,
            pb: 1,
            borderBottom: `2px solid ${theme.palette.primary.main}`
          }}
        >
          Zoho-Faire Integration Dashboard
        </Typography>

        {/* Authentication Section */}
        <Card variant="outlined" sx={{ mb: 3, p: 2, borderColor: theme.palette.divider }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item>
                <Avatar sx={{ bgcolor: authStatus ? theme.palette.success.main : theme.palette.error.main }}>
                  {authStatus ? <CheckCircleIcon /> : <WarningIcon />}
                </Avatar>
              </Grid>
              <Grid item xs>
                <Typography variant="h6" color="text.secondary">
                  Zoho Authentication Status:
                </Typography>
                <Chip
                  label={authStatus ? 'Authenticated' : 'Not Authenticated'}
                  color={authStatus ? 'success' : 'error'}
                  sx={{ mt: 1, fontWeight: 'bold' }}
                />
              </Grid>
              <Grid item>
                {!authStatus && (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleAuthZoho}
                    startIcon={<ScheduleIcon />}
                  >
                    Authorize Zoho
                  </Button>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Tabs for Navigation */}
        <Tabs
          value={activeTab}
          onChange={(event, newValue) => setActiveTab(newValue)}
          aria-label="integration tabs"
          sx={{ mb: 3, borderBottom: `1px solid ${theme.palette.divider}` }}
        >
          <Tab label="Zoho Items" icon={<InventoryIcon />} iconPosition="start" />
          <Tab label="Image Management" icon={<ImageIcon />} iconPosition="start" />
        </Tabs>

        {/* Zoho Items Tab */}
        {activeTab === 0 && (
          <TableContainer component={Paper} elevation={1} sx={{ mt: 3, borderRadius: 2 }}>
            <Toolbar
              sx={{
                pl: { sm: 2 },
                pr: { xs: 1, sm: 1 },
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                borderBottom: `1px solid ${theme.palette.divider}`
              }}
            >
              <Typography
                sx={{ flex: '1 1 100%', color: theme.palette.primary.main, fontWeight: 'bold' }}
                variant="h6"
                id="tableTitle"
                component="div"
              >
                Zoho Inventory Items
              </Typography>
              <TextField
                label="Search Items"
                variant="outlined"
                size="small"
                value={searchTerm}
                onChange={handleSearchChange}
                sx={{ mr: 2, flexShrink: 0 }}
              />
              <FormControlLabel // <--- COMPONENT NOW DEFINED
                control={
                  <Checkbox
                    checked={!filterInactive} // Checkbox is for 'Active Items Only'
                    onChange={(e) => setFilterInactive(!e.target.checked)} // Invert logic for the 'filterInactive' state
                    color="primary"
                  />
                }
                label="Active Items Only"
                sx={{ mr: 2 }}
              />
              <Tooltip title="Refresh Zoho Items">
                <IconButton onClick={() => fetchZohoItems(true)} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Button
                variant="contained"
                color="primary"
                onClick={handleCompleteSync}
                disabled={loading} // Keep disabled while any loading is happening
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
                sx={{ ml: 2 }}
              >
                {getSyncButtonText()}
              </Button>
            </Toolbar>

            <Table aria-label="zoho items table">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      onChange={handleToggleSelectAll}
                      checked={selectedItems.size === zohoItems.length && zohoItems.length > 0}
                      indeterminate={selectedItems.size > 0 && selectedItems.size < zohoItems.length}
                    />
                  </TableCell>
                  <TableCell onClick={() => handleSort('name')} sx={{ cursor: 'pointer' }}>
                    Item Name {sortColumn === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </TableCell>
                  <TableCell onClick={() => handleSort('sku')} sx={{ cursor: 'pointer' }}>
                    SKU {sortColumn === 'sku' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Stock</TableCell>
                  <TableCell>Price</TableCell>
                  <TableCell>Actions</TableCell>
                  <TableCell>Faire Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ textAlign: 'center', py: 5 }}>
                      <CircularProgress />
                      <Typography sx={{ mt: 2 }}>Loading Zoho Items...</Typography>
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ textAlign: 'center', py: 5 }}>
                      <Typography>No Zoho items found.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((item) => (
                      <TableRow
                        key={item.item_id}
                        hover
                        role="checkbox"
                        tabIndex={-1}
                        selected={isSelected(item.item_id)}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={isSelected(item.item_id)}
                            onChange={(event) => handleSelectItem(event, item.item_id)}
                          />
                        </TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.sku}</TableCell>
                        <TableCell>
                          <Chip
                            label={item.status}
                            color={item.status === 'Active' ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{item.stock_on_hand}</TableCell>
                        <TableCell>${parseFloat(item.rate).toFixed(2)}</TableCell>
                        <TableCell>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setActiveTab(1)} // Switch to Image Management
                            startIcon={<ImageIcon />}
                          >
                            Manage Images
                          </Button>
                          <Button
                            sx={{ml:1}}
                            variant="outlined"
                            label="View"
                            size="small"
                            onClick={() => setActiveTab(1)}
                          >
                            View
                          </Button>
                        </TableCell>
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
        )}

        {/* Image Management Tab */}
        {activeTab === 1 && (
          <ImageManagement
            zohoItems={zohoItems}
            onAlert={addAlert}
            onRefreshItems={() => fetchZohoItems(true)}
          />
        )}
      </Paper>
    </Box>
  );
};

export default ZohoFaireIntegration;