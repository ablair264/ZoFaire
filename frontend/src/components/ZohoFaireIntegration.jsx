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
  styled,
  keyframes,
  Snackbar,
  Slide
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
  Warning as WarningIcon,
  Close as CloseIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import ImageManagement from './ImageManagement';
import ProgressLoader from './ProgressLoader';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://zofaire.onrender.com/api';

// Animated pulse keyframes
const pulseGreen = keyframes`
  0% { 
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4),
                0 0 0 0 rgba(34, 197, 94, 0.2) inset;
    transform: scale(1);
  }
  70% { 
    box-shadow: 0 0 0 10px rgba(34, 197, 94, 0),
                0 0 0 0 rgba(34, 197, 94, 0.2) inset;
    transform: scale(1.05);
  }
  100% { 
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0),
                0 0 0 0 rgba(34, 197, 94, 0.2) inset;
    transform: scale(1);
  }
`;

const pulseRed = keyframes`
  0% { 
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4),
                0 0 0 0 rgba(239, 68, 68, 0.2) inset;
    transform: scale(1);
  }
  70% { 
    box-shadow: 0 0 0 10px rgba(239, 68, 68, 0),
                0 0 0 0 rgba(239, 68, 68, 0.2) inset;
    transform: scale(1.05);
  }
  100% { 
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0),
                0 0 0 0 rgba(239, 68, 68, 0.2) inset;
    transform: scale(1);
  }
`;

// Firebase flame animation
const flameWobble = keyframes`
  0%, 100% { 
    transform: scale(1) translateY(0); 
    filter: hue-rotate(0deg) brightness(1);
  }
  25% { 
    transform: scale(1.1) translateY(-2px); 
    filter: hue-rotate(10deg) brightness(1.1);
  }
  50% { 
    transform: scale(0.95) translateY(1px); 
    filter: hue-rotate(-5deg) brightness(0.95);
  }
  75% { 
    transform: scale(1.05) translateY(-1px); 
    filter: hue-rotate(5deg) brightness(1.05);
  }
`;

const StatusBadge = styled(Box)(({ theme, connected }) => ({
  width: 80,
  height: 80,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: connected 
    ? `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.light, 0.2)} 100%)`
    : `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.1)} 0%, ${alpha(theme.palette.error.light, 0.2)} 100%)`,
  border: `3px solid ${connected ? theme.palette.success.main : theme.palette.error.main}`,
  boxShadow: connected
    ? `0 0 20px ${alpha(theme.palette.success.main, 0.4)}, 
       inset 0 0 20px ${alpha(theme.palette.success.main, 0.1)}`
    : `0 0 20px ${alpha(theme.palette.error.main, 0.4)}, 
       inset 0 0 20px ${alpha(theme.palette.error.main, 0.1)}`,
  animation: `${connected ? pulseGreen : pulseRed} 2s ease-in-out infinite`,
  cursor: connected ? 'default' : 'pointer',
  transition: 'all 0.3s ease',
  position: 'relative',
  '&:hover': {
    transform: connected ? 'none' : 'scale(1.1)',
    boxShadow: connected
      ? `0 0 20px ${alpha(theme.palette.success.main, 0.4)}, 
         inset 0 0 20px ${alpha(theme.palette.success.main, 0.1)}`
      : `0 0 30px ${alpha(theme.palette.error.main, 0.6)}, 
         inset 0 0 25px ${alpha(theme.palette.error.main, 0.2)}`,
  },
  '& .status-icon': {
    width: 48,
    height: 48,
    transition: 'transform 0.3s ease',
  },
  '&:hover .status-icon': {
    transform: connected ? 'none' : 'scale(1.2)  rotate(5deg)',
  }
}));

// Slide transition for Snackbar
function SlideTransition(props) {
  return <Slide {...props} direction="left" />;
}

// Brand avatar component
const BrandAvatar = ({ brand, size = 24 }) => {
  const theme = useTheme();
  const [imageError, setImageError] = useState(false);
  
  const brandName = brand || 'Unknown';
  const brandLower = brandName.toLowerCase().replace(/\s+/g, '');
  const logoPath = `/logos/${brandLower}.png`;
  
  // Generate color based on brand name
  const stringToColor = (string) => {
    let hash = 0;
    for (let i = 0; i < string.length; i += 1) {
      hash = string.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i += 1) {
      const value = (hash >> (i * 8)) & 0xff;
      color += `00${value.toString(16)}`.slice(-2);
    }
    return color;
  };
  
  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  
  if (imageError || !brand) {
    return (
      <Avatar
        sx={{
          width: size,
          height: size,
          bgcolor: stringToColor(brandName),
          fontSize: size * 0.4,
          fontWeight: 600
        }}
      >
        {getInitials(brandName)}
      </Avatar>
    );
  }
  
  return (
    <Avatar
      src={logoPath}
      alt={brandName}
      sx={{ width: size, height: size, bgcolor: 'white' }}
      onError={() => setImageError(true)}
    >
      {getInitials(brandName)}
    </Avatar>
  );
};

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
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [activeTab, setActiveTab] = useState(0); // 0 for Zoho Items, 1 for Image Management
  const [authStatus, setAuthStatus] = useState(false);
  const [sortColumn, setSortColumn] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [filterInactive, setFilterInactive] = useState(true); // <--- Changed default to true (Active Items Only)
  const [zohoItemsFetchedCount, setZohoItemsFetchedCount] = useState(0); // <--- NEW State for item count

  // Add state for Faire and Firebase status
  const [faireStatus, setFaireStatus] = useState(false); // true if API key present
  const [firebaseStatus, setFirebaseStatus] = useState(false); // true if Firebase connected

  const showSnackbar = useCallback((message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar({ ...snackbar, open: false });
  };

  // Check authentication status on component mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/status`);
        const data = await response.json();
        setAuthStatus(data.isAuthenticated);
        if (!data.isAuthenticated) {
          showSnackbar('Zoho authentication is required. Please authorize the application.', 'warning');
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        showSnackbar('Failed to check authentication status. Please try again.', 'error');
      }
    };
    checkAuthStatus();
  }, [showSnackbar]);

  // Check Faire and Firebase status on mount
  useEffect(() => {
    // Check Faire API key (simulate by checking env or API call)
    fetch(`${API_BASE_URL}/faire/status`).then(res => res.json()).then(data => setFaireStatus(data.connected)).catch(() => setFaireStatus(false));
    // Check Firebase status (simulate by calling a Firebase endpoint)
    fetch(`${API_BASE_URL}/firebase/status`).then(res => res.json()).then(data => setFirebaseStatus(data.connected)).catch(() => setFirebaseStatus(false));
  }, []);

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
      showSnackbar('Zoho items fetched successfully!', 'success');
    } catch (error) {
      console.error('Error fetching Zoho items:', error);
      showSnackbar(`Error fetching Zoho items: ${error.message}`, 'error');
      setZohoItemsFetchedCount(0); // Reset count on error
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [page, rowsPerPage, searchTerm, sortColumn, sortOrder, filterInactive, showSnackbar]); // Added filterInactive dependency

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
      showSnackbar(`Selected all ${newSelected.size} items.`, 'info');
    } else {
      setSelectedItems(new Set());
      showSnackbar('Cleared all selections.', 'info');
    }
  };

  const handleSelectItem = (event, itemId) => {
    const newSelected = new Set(selectedItems);
    if (event.target.checked) {
      newSelected.add(itemId);
      // Don't show snackbar for individual selections to avoid spam
    } else {
      newSelected.delete(itemId);
      // Don't show snackbar for individual deselections to avoid spam
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
    showSnackbar('Starting complete sync workflow...', 'info');

    try {
      const response = await fetch(`${API_BASE_URL}/workflow/complete-sync`, { method: 'POST' });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Complete sync failed on backend.');
      }

      const data = await response.json();

      if (data.summary) {
          const { zohoItemsFetched, matchedItems, itemsUploadedToFaire } = data.summary;
          showSnackbar(
              `Sync completed successfully! Fetched ${zohoItemsFetched} Zoho items, matched ${matchedItems} with images, and completed Faire upload for ${itemsUploadedToFaire} items.`,
              'success'
          );
          setZohoItemsFetchedCount(zohoItemsFetched); // Update count after successful sync
      } else {
          showSnackbar(data.message, 'success');
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
      showSnackbar(errorMessage, 'error');
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
    showSnackbar(`Uploading ${selectedItems.size} items to Faire...`, 'info');
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
      showSnackbar(`Successfully uploaded ${data.uploaded || selected.length} items to Faire!`, 'success');
      // Optionally refresh items or update UI
      fetchZohoItems(true);
    } catch (error) {
      showSnackbar(`Upload to Faire failed: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };


  return (
    <Box sx={{ p: 3, maxWidth: '100%', mx: 'auto', mt: 4, mb: 4 }}>
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        TransitionComponent={SlideTransition}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ 
            width: '100%',
            boxShadow: 3,
            '& .MuiAlert-icon': {
              fontSize: 28
            }
          }}
          variant="filled"
          elevation={6}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

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

        {/* Status Badges Section - Animated Circular Badges */}
        <Grid container spacing={4} alignItems="center" sx={{ mb: 4, justifyContent: 'center' }}>
          {/* Zoho Status Badge */}
          <Grid item>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Tooltip 
                title={
                  authStatus 
                    ? 'Connected to Zoho Inventory' 
                    : 'Not connected. Click to authenticate with Zoho.'
                } 
                placement="top"
                arrow
              >
                <StatusBadge
                  theme={theme}
                  connected={authStatus}
                  onClick={!authStatus ? handleAuthZoho : undefined}
                >
                  <Avatar 
                    src="/logos/zoho-inventory.png" 
                    alt="Zoho Inventory" 
                    className="status-icon"
                    sx={{ 
                      bgcolor: 'white',
                      p: 1,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }} 
                  />
                </StatusBadge>
              </Tooltip>
              <Typography 
                variant="body2" 
                sx={{ 
                  mt: 1.5, 
                  fontWeight: 600,
                  color: authStatus ? theme.palette.success.main : theme.palette.error.main
                }}
              >
                Zoho
              </Typography>
            </Box>
          </Grid>
          
          {/* Faire Status Badge */}
          <Grid item>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Tooltip 
                title={
                  faireStatus 
                    ? 'Faire API Key is configured' 
                    : 'No Faire API key found. Click to set up API access.'
                } 
                placement="top"
                arrow
              >
                <StatusBadge
                  theme={theme}
                  connected={faireStatus}
                  onClick={!faireStatus ? () => {
                    window.open('https://www.faire.com/account/api', '_blank');
                    showSnackbar('Please add your Faire API key to the backend configuration.', 'info');
                  } : undefined}
                >
                  <Avatar 
                    src="/logos/faire.png" 
                    alt="Faire" 
                    className="status-icon"
                    sx={{ 
                      bgcolor: 'white',
                      p: 1,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }} 
                  />
                </StatusBadge>
              </Tooltip>
              <Typography 
                variant="body2" 
                sx={{ 
                  mt: 1.5, 
                  fontWeight: 600,
                  color: faireStatus ? theme.palette.success.main : theme.palette.error.main
                }}
              >
                Faire
              </Typography>
            </Box>
          </Grid>
          
          {/* Firebase Status Badge */}
          <Grid item>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Tooltip 
                title={
                  firebaseStatus 
                    ? 'Firebase Storage is connected' 
                    : 'Firebase Storage not configured. Images cannot be uploaded.'
                } 
                placement="top"
                arrow
              >
                <StatusBadge
                  theme={theme}
                  connected={firebaseStatus}
                  sx={{ 
                    overflow: 'visible',
                    '& .firebase-flame': {
                      animation: firebaseStatus ? `${flameWobble} 1.5s ease-in-out infinite` : 'none'
                    }
                  }}
                >
                  <Avatar 
                    src="/logos/firebase.png" 
                    alt="Firebase" 
                    className="status-icon firebase-flame"
                    sx={{ 
                      bgcolor: 'white',
                      p: 1,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }} 
                  />
                </StatusBadge>
              </Tooltip>
              <Typography 
                variant="body2" 
                sx={{ 
                  mt: 1.5, 
                  fontWeight: 600,
                  color: firebaseStatus ? theme.palette.success.main : theme.palette.error.main
                }}
              >
                Firebase
              </Typography>
            </Box>
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
          <>
            {/* Batch Action Bar - Shows when items are selected */}
            {selectedItems.size > 0 && (
            <Paper 
              elevation={3} 
              sx={{ 
                position: 'sticky',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1200,
                p: 2,
                borderRadius: 3,
                background: alpha(theme.palette.primary.main, 0.95),
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                maxWidth: 'fit-content',
                mx: 'auto'
              }}
            >
              <Typography variant="body2" sx={{ color: 'white', fontWeight: 600 }}>
                {selectedItems.size} items selected
              </Typography>
              <Button
                variant="contained"
                size="small"
                sx={{ 
                  bgcolor: 'white', 
                  color: theme.palette.primary.main,
                  '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.9) }
                }}
                startIcon={<UploadIcon />}
                onClick={handleUploadToFaire}
                disabled={loading}
              >
                Upload to Faire
              </Button>
              <Button
                variant="contained"
                size="small"
                sx={{ 
                  bgcolor: 'white', 
                  color: theme.palette.primary.main,
                  '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.9) }
                }}
                startIcon={<ImageIcon />}
                onClick={() => {
                  setActiveTab(1);
                  showSnackbar('Navigate to Image Management to match images', 'info');
                }}
              >
                Match Images
              </Button>
              <IconButton
                size="small"
                sx={{ color: 'white' }}
                onClick={() => {
                  setSelectedItems(new Set());
                  showSnackbar('Selection cleared', 'info');
                }}
              >
                <CloseIcon />
              </IconButton>
            </Paper>
          )}

          <TableContainer 
            component={Paper} 
            elevation={2} 
            sx={{ 
              mt: 3, 
              borderRadius: 2,
              maxHeight: '70vh',
              '& .MuiTableRow-root:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
                transition: 'background-color 0.2s ease'
              }
            }}
          >
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

            <Table aria-label="zoho items table" stickyHeader>
              <TableHead>
                <TableRow
                  sx={{
                    '& .MuiTableCell-head': {
                      backgroundColor: theme.palette.mode === 'dark' 
                        ? theme.palette.grey[900] 
                        : theme.palette.grey[100],
                      fontWeight: 600,
                      borderBottom: `2px solid ${theme.palette.divider}`,
                    }
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      onChange={handleToggleSelectAll}
                      checked={selectedItems.size === zohoItems.length && zohoItems.length > 0}
                      indeterminate={selectedItems.size > 0 && selectedItems.size < zohoItems.length}
                    />
                  </TableCell>
                  <TableCell 
                    onClick={() => handleSort('name')} 
                    sx={{ 
                      cursor: 'pointer',
                      userSelect: 'none',
                      '&:hover': { 
                        backgroundColor: alpha(theme.palette.primary.main, 0.08) 
                      }
                    }}
                  >
                    Item Name {sortColumn === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </TableCell>
                  <TableCell 
                    onClick={() => handleSort('sku')} 
                    sx={{ 
                      cursor: 'pointer',
                      userSelect: 'none',
                      '&:hover': { 
                        backgroundColor: alpha(theme.palette.primary.main, 0.08) 
                      }
                    }}
                  >
                    SKU {sortColumn === 'sku' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Stock</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell align="center">Actions</TableCell>
                  <TableCell align="center">Faire Status</TableCell>
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
                    .map((item) => {
                      const isItemSelected = isSelected(item.item_id);
                      return (
                        <TableRow
                          key={item.item_id}
                          hover
                          role="checkbox"
                          tabIndex={-1}
                          selected={isItemSelected}
                          sx={{
                            '&.Mui-selected': {
                              backgroundColor: alpha(theme.palette.primary.main, 0.08),
                              '&:hover': {
                                backgroundColor: alpha(theme.palette.primary.main, 0.12),
                              },
                            },
                            cursor: 'pointer',
                          }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={isItemSelected}
                              onChange={(event) => handleSelectItem(event, item.item_id)}
                              icon={<RadioButtonUncheckedIcon />}
                              checkedIcon={<CheckCircleOutlineIcon />}
                              sx={{
                                color: theme.palette.primary.main,
                                '&.Mui-checked': {
                                  color: theme.palette.primary.main,
                                },
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <BrandAvatar brand={item.brand || item.manufacturer} size={32} />
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {item.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {item.brand || item.manufacturer || 'No Brand'}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {item.sku}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={item.status}
                              size="small"
                              sx={{
                                fontWeight: 600,
                                backgroundColor: item.status === 'Active' 
                                  ? alpha(theme.palette.success.main, 0.1)
                                  : alpha(theme.palette.grey[500], 0.1),
                                color: item.status === 'Active' 
                                  ? theme.palette.success.dark
                                  : theme.palette.grey[700],
                                border: `1px solid ${item.status === 'Active' 
                                  ? alpha(theme.palette.success.main, 0.3)
                                  : alpha(theme.palette.grey[500], 0.3)}`,
                              }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  fontWeight: 600,
                                  color: item.stock_on_hand <= 10 
                                    ? theme.palette.error.main 
                                    : theme.palette.text.primary
                                }}
                              >
                                {item.stock_on_hand}
                              </Typography>
                              {item.stock_on_hand <= 10 && (
                                <WarningIcon sx={{ fontSize: 16, color: theme.palette.error.main }} />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              ${parseFloat(item.rate).toFixed(2)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                              <Tooltip title="Manage product images">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTab(1);
                                  }}
                                >
                                  <ImageIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="View product details">
                                <IconButton
                                  size="small"
                                  color="default"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // TODO: Implement view details
                                    showSnackbar('View details coming soon', 'info');
                                  }}
                                >
                                  <VisibilityIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            {item.uploaded_to_faire ? (
                              <Chip
                                icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                                label="Uploaded"
                                size="small"
                                sx={{
                                  backgroundColor: alpha(theme.palette.success.main, 0.1),
                                  color: theme.palette.success.dark,
                                  border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                                  fontWeight: 600,
                                  '& .MuiChip-icon': {
                                    color: theme.palette.success.main,
                                  },
                                }}
                              />
                            ) : (
                              <Chip
                                icon={<CloudUploadIcon sx={{ fontSize: 16 }} />}
                                label="Not Uploaded"
                                size="small"
                                sx={{
                                  backgroundColor: alpha(theme.palette.grey[500], 0.1),
                                  color: theme.palette.grey[700],
                                  border: `1px solid ${alpha(theme.palette.grey[500], 0.3)}`,
                                  '& .MuiChip-icon': {
                                    color: theme.palette.grey[600],
                                  },
                                }}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
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
          </>
        )}

        {/* Image Management Tab */}
        {activeTab === 1 && (
          <ImageManagement
            zohoItems={zohoItems}
            onAlert={showSnackbar}
            onRefreshItems={() => fetchZohoItems(true)}
          />
        )}
      </Paper>
    </Box>
  );
};

export default ZohoFaireIntegration;