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
  FormControlLabel,
  keyframes // <--- ADDED THIS IMPORT
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

// Animated border keyframes
const pulseGreen = keyframes`
  0% { box-shadow: 0 0 0 0 #22c55e44; }
  70% { box-shadow: 0 0 0 8px #22c55e00; }
  100% { box-shadow: 0 0 0 0 #22c55e44; }
`;
const pulseRed = keyframes`
  0% { box-shadow: 0 0 0 0 #ef444444; }
  70% { box-shadow: 0 0 0 8px #ef444400; }
  100% { box-shadow: 0 0 0 0 #ef444444; }
`;
const flameAnim = keyframes`
  0% { filter: drop-shadow(0 0 8px #ff9800); }
  50% { filter: drop-shadow(0 0 24px #ff9800); }
  100% { filter: drop-shadow(0 0 8px #ff9800); }
`;

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
  const [filterInactive, setFilterInactive] = useState(true); // <--- Changed default to true (Active Items Only)
  const [zohoItemsFetchedCount, setZohoItemsFetchedCount] = useState(0); // <--- NEW State for item count


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
        filterInactive: filterInactive // Send boolean as string 'true' or 'false'
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
      // Zoho API returns page_context.total_count for all items, not just current page.
      // Use current page items length if total_count is not available or appropriate.
      setZohoItemsFetchedCount(data.page_context ? data.page_context.total_count : (data.items ? data.items.length : 0)); // <--- Update count
      addAlert('Zoho items fetched successfully!', 'success');
    } catch (error) {
      console.error('Error fetching Zoho items:', error);
      addAlert(`Error fetching Zoho items: ${error.message}`, 'error');
      setZohoItemsFetchedCount(0); // Reset count on error
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [page, rowsPerPage, searchTerm, sortColumn, sortOrder, filterInactive, addAlert]); // Added filterInactive dependency

  useEffect(() => {
    if (authStatus && activeTab === 0) { // Only fetch if authenticated and on the Zoho Items tab
      fetchZohoItems();
    }
  }, [authStatus, fetchZohoItems, activeTab]);

  const handleAuthZoho = () => {
    const redirectUri = process.env.REACT_APP_ZOHO_REDIRECT_URI || 'https://zofaire.onrender.com/oauth/callback';
    const zohoAuthUrl = process.env.REACT_APP_ZOHO_AUTH_URL || 'https://accounts.zoho.eu/oauth/v2/auth';
    const clientId = process.env.REACT_APP_ZOHO_CLIENT_ID;

    // Confirmed scopes are correct as per user's last provided file and previous statement
    const scope = 'ZohoInventory.FullAccess.all';

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

  // FIX: Corrected logic for filterInactive checkbox
  const handleFilterInactiveChange = (event) => {
    setFilterInactive(event.target.checked); // Set filterInactive to true if checked (meaning, filter for active items)
  };


  const isSelected = (itemId) => selectedItems.has(itemId);

  const filteredItems = useMemo(() => {
    // Note: Filtering by searchTerm is done on current page data.
    // Full filtering should ideally happen via backend search_text param.
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
          setZohoItemsFetchedCount(zohoItemsFetched); // Update count after successful sync
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
      setZohoItemsFetchedCount(0); // Reset count on error
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

  const handleUploadToFaire = async () => {
    setLoading(true);
    addAlert(`Uploading ${selectedItems.size} items to Faire...`, 'info');
    try {
      const selected = zohoItems.filter(item => selectedItems.has(item.item_id));
      const response = await fetch(`${API_BASE_URL}/faire/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selected })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload to Faire');
      }
      const data = await response.json();
      addAlert(`Successfully uploaded ${data.uploaded || selected.length} items to Faire!`, 'success');
      // Optionally refresh items or update UI
      fetchZohoItems(true);
    } catch (error) {
      addAlert(`Upload to Faire failed: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Status for badges
  const faireStatus = Boolean(process.env.REACT_APP_FAIRE_API_KEY || FAIRE_ACCESS_TOKEN); // You may need to fetch this from backend
  const firebaseStatus = true; // Assume true if Firebase initialized, or fetch from backend if needed

  // Helper for badge
  const StatusBadge = ({ connected, logo, alt, tooltip, onClick, flame }) => (
    <Tooltip title={tooltip} arrow>
      <Box
        sx={{
          width: 72, height: 72, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: connected
            ? (flame ? '0 0 0 0 #ff9800' : '0 0 0 4px #22c55e44, 0 0 8px 2px #22c55e')
            : '0 0 0 4px #ef444444, 0 0 8px 2px #ef4444',
          animation: flame
            ? `${flameAnim} 1.2s infinite`
            : (connected ? `${pulseGreen} 1.5s infinite` : `${pulseRed} 1.5s infinite`),
          cursor: !connected && onClick ? 'pointer' : 'default',
          background: 'rgba(255,255,255,0.7)',
          transition: 'box-shadow 0.3s',
          m: 1
        }}
        onClick={(!connected && onClick) ? onClick : undefined}
      >
        <Avatar src={logo} alt={alt} sx={{ width: 40, height: 40, bgcolor: 'transparent' }} />
      </Box>
    </Tooltip>
  );


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

        {/* Authentication Section - Enhanced Layout & Logo */}
        {/* Placed in a Grid to easily align with other future cards */}
        <Grid container spacing={2} alignItems="center" justifyContent="flex-start" sx={{ mb: 3 }}>
          <Grid item>
            <StatusBadge
              connected={authStatus}
              logo="/logos/zoho-inventory.png"
              alt="Zoho Inventory"
              tooltip={authStatus ? 'Connected to Zoho Inventory' : 'Not connected. Click to reconnect.'}
              onClick={!authStatus ? handleAuthZoho : undefined}
            />
          </Grid>
          <Grid item>
            <StatusBadge
              connected={faireStatus}
              logo="/logos/faire.png"
              alt="Faire"
              tooltip={faireStatus ? 'Faire API Key Set' : 'No Faire API Key. Click to set.'}
              onClick={!faireStatus ? () => window.open('https://www.faire.com/', '_blank') : undefined}
            />
          </Grid>
          <Grid item>
            <StatusBadge
              connected={firebaseStatus}
              logo="/logos/firebase.png"
              alt="Firebase"
              tooltip={firebaseStatus ? 'Connected to Firebase' : 'Firebase not connected'}
              flame={firebaseStatus}
            />
          </Grid>
        </Grid>

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
              <FormControlLabel
                control={
                  <Checkbox
                    checked={filterInactive} // <--- Corrected logic for filterInactive
                    onChange={handleFilterInactiveChange} // <--- Corrected handler
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
              {selectedItems.size > 0 && (
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<UploadIcon />}
                  sx={{ ml: 2 }}
                  onClick={handleUploadToFaire}
                  disabled={loading}
                >
                  Upload to Faire ({selectedItems.size})
                </Button>
              )}
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