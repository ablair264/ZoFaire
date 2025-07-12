import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Checkbox,
  TextField,
  IconButton,
  Tooltip,
  Chip,
  Grid,
  Card,
  CardContent,
  Avatar,
  Snackbar,
  Alert,
  alpha,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Toolbar,
  FormControlLabel,
  styled,
  keyframes,
  Slide
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Inventory as InventoryIcon,
  Image as ImageIcon,
  Visibility as VisibilityIcon,
  CloudUpload as CloudUploadIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  AddPhotoAlternate as AddPhotoIcon,
  CloudSync as CloudSyncIcon,
  FilterList as FilterListIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Close as CloseIcon,
  ImageNotSupported as ImageNotSupportedIcon
} from '@mui/icons-material';
import ItemDetail from './ItemDetail';
import ProgressLoader from './ProgressLoader';
import { firebaseCache } from '../utils/firebaseCache';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

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

// Smaller StatusBadge for header
const StatusBadge = styled(Box)(({ theme, connected }) => ({
  width: 50,
  height: 50,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: connected 
    ? `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.light, 0.2)} 100%)`
    : `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.1)} 0%, ${alpha(theme.palette.error.light, 0.2)} 100%)`,
  border: `2px solid ${connected ? theme.palette.success.main : theme.palette.error.main}`,
  boxShadow: connected
    ? `0 0 15px ${alpha(theme.palette.success.main, 0.4)}, 
       inset 0 0 15px ${alpha(theme.palette.success.main, 0.1)}`
    : `0 0 15px ${alpha(theme.palette.error.main, 0.4)}, 
       inset 0 0 15px ${alpha(theme.palette.error.main, 0.1)}`,
  animation: `${connected ? pulseGreen : pulseRed} 2s ease-in-out infinite`,
  cursor: connected ? 'default' : 'pointer',
  transition: 'all 0.3s ease',
  position: 'relative',
  '&:hover': {
    transform: connected ? 'none' : 'scale(1.1)',
    boxShadow: connected
      ? `0 0 15px ${alpha(theme.palette.success.main, 0.4)}, 
         inset 0 0 15px ${alpha(theme.palette.success.main, 0.1)}`
      : `0 0 25px ${alpha(theme.palette.error.main, 0.6)}, 
         inset 0 0 20px ${alpha(theme.palette.error.main, 0.2)}`,
  },
  '& .status-icon': {
    width: 30,
    height: 30,
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

// --- STYLED COMPONENTS (for better UI feedback) ---
const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: alpha(theme.palette.action.hover, 0.02),
  },
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.1),
  },
  // hide last border
  '&:last-child td, &:last-child th': {
    border: 0,
  },
}));

// Normalize brand names for Firebase paths (remove special characters, umlauts, etc.)
const normalizeBrandName = (brand) => {
  if (!brand) return 'unknown';
  
  // Convert to string if it's not already
  const brandStr = String(brand).trim();
  
  // Early return for empty string after trimming
  if (!brandStr) {
    return 'unknown';
  }
  
  // Special case: My Flame Lifestyle → myflame
  if (brandStr.toLowerCase() === 'my flame lifestyle') {
    return 'myflame';
  }
  
  // Special case: räder → rader
  if (brandStr.toLowerCase() === 'räder') {
    return 'rader';
  }
  
  // Convert to lowercase and normalize unicode characters
  let normalized = brandStr.toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric characters
    .trim();
  
  return normalized || 'unknown';
};

// Brand avatar component
const BrandAvatar = ({ brand, size = 24 }) => {
  const theme = useTheme();
  const [imageError, setImageError] = useState(false);
  
  const brandName = brand || 'Unknown';
  const brandLower = String(brandName).toLowerCase().replace(/\s+/g, '');
  const logoPath = `/logos/${brandLower}.png`;
  
  // Generate color based on brand name
  const stringToColor = (string) => {
    const str = String(string || '');
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i += 1) {
      const value = (hash >> (i * 8)) & 0xff;
      color += `00${value.toString(16)}`.slice(-2);
    }
    return color;
  };
  
  const getInitials = (name) => {
    const nameStr = String(name || '');
    return nameStr
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
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState([]);
  
  // Fixed state variables
  const [selectedBrand, setSelectedBrand] = useState('');
  const [availableBrands, setAvailableBrands] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [filterInactive, setFilterInactive] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Image Management states
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [imageDialog, setImageDialog] = useState(false);
  const [uploadDialog, setUploadDialog] = useState(false);
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
  
  // Batch processing states
  const [manufacturers, setManufacturers] = useState([]);
  const [matchProgress, setMatchProgress] = useState({ current: 0, total: 0 });
  const [isMatching, setIsMatching] = useState(false);
  
  // Batch upload states
  const [batchUploadDialog, setBatchUploadDialog] = useState(false);
  const [batchSelectedBrand, setBatchSelectedBrand] = useState('');
  const [batchFiles, setBatchFiles] = useState([]);
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchUploadProgress, setBatchUploadProgress] = useState({ current: 0, total: 0 });

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
        // setAuthStatus(data.isAuthenticated); // This state is no longer needed
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

  // Helper function to clean item data and prevent rendering issues
  const cleanItemData = (item) => {
    if (!item) return null;
    
    // Remove any problematic object fields
    const problematicFields = ['manufacturer_contact', 'manufacturer_part_number', 'manufacturer_name', 'manufacturer_website'];
    const cleanItem = { ...item };
    
    problematicFields.forEach(field => {
      if (cleanItem[field] && typeof cleanItem[field] === 'object') {
        console.warn(`Removing problematic object field: ${field} from item ${cleanItem.sku || cleanItem.item_id}`);
        delete cleanItem[field];
      }
    });
    
    // Handle manufacturer field that might be a map/object
    if (cleanItem.manufacturer && typeof cleanItem.manufacturer === 'object' && cleanItem.manufacturer.manufacturer_name) {
      cleanItem.manufacturer = cleanItem.manufacturer.manufacturer_name;
      console.log(`📝 Extracted manufacturer_name "${cleanItem.manufacturer}" from manufacturer map for item ${cleanItem.sku || cleanItem.item_id}`);
    }
    
    // Ensure all text fields are strings
    const textFields = ['name', 'sku', 'manufacturer', 'brand', 'description', 'status', 'product_type', 'item_type'];
    textFields.forEach(field => {
      if (cleanItem[field] && typeof cleanItem[field] !== 'string') {
        cleanItem[field] = String(cleanItem[field]);
      }
    });
    
    return cleanItem;
  };

  // Fetch Items from items_data collection with improved caching
  const fetchItems = useCallback(async (showLoading = true, forceRefresh = false) => {
    if (showLoading) setLoading(true);
    
    // Create base cache key without search term for better caching
    const baseCacheKey = `items_${page}_${rowsPerPage}_${selectedBrand}_${filterInactive}`;
    
    // Try to get from cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedData = firebaseCache.get(baseCacheKey);
      if (cachedData) {
        // Apply search filter on cached data if needed
        let filteredItems = cachedData.items;
        
        // SAFETY FILTER: Remove any items with UID starting with 310
        filteredItems = filteredItems.filter(item => {
          const itemId = String(item.item_id || item.id || '');
          const sku = String(item.sku || '');
          return !itemId.startsWith('310') && !sku.startsWith('310');
        });
        
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          filteredItems = filteredItems.filter(item => {
            const nameMatch = String(item.name || '').toLowerCase().includes(searchLower);
            const skuMatch = String(item.sku || '').toLowerCase().includes(searchLower);
            const descriptionMatch = String(item.description || '').toLowerCase().includes(searchLower);
            return nameMatch || skuMatch || descriptionMatch;
          });
        }
        setItems(filteredItems);
        setTotalCount(searchTerm ? filteredItems.length : cachedData.total);
        setAvailableBrands(cachedData.brands || []);
        if (showLoading) setLoading(false);
        return;
      }
    }
    
    try {
      const params = new URLSearchParams({
        page: page + 1,
        per_page: rowsPerPage,
        sort_column: 'name',
        sort_order: 'asc',
        filterInactive: filterInactive
      });
      
      // Don't include search in API call - we'll filter cached results instead
      if (forceRefresh && searchTerm) {
        params.append('search_text', searchTerm);
      }

      const response = await fetch(`${API_BASE_URL}/items?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch items');
      }
      const data = await response.json();
      
      // SAFETY FILTER: Remove any items with UID starting with 310 from the response
      let safeItems = (data.items || []).filter(item => {
        const itemId = String(item.item_id || item.id || '');
        const sku = String(item.sku || '');
        const shouldFilter = itemId.startsWith('310') || sku.startsWith('310');
        if (shouldFilter) {
          console.log(`Frontend filtering item with UID/SKU starting with 310: ${itemId || sku}`);
        }
        return !shouldFilter;
      });
      
      // Extract unique brands from the items
      const brandsSet = new Set();
      safeItems.forEach(item => {
        if (item.brand_normalized && item.brand_normalized !== 'unknown') {
          brandsSet.add(item.brand || item.brand_normalized);
        }
      });
      const uniqueBrands = Array.from(brandsSet).sort();
      
      // Apply search filter if we didn't send it to server
      let finalItems = safeItems;
      if (!forceRefresh && searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        finalItems = safeItems.filter(item => {
          const nameMatch = String(item.name || '').toLowerCase().includes(searchLower);
          const skuMatch = String(item.sku || '').toLowerCase().includes(searchLower);
          const descriptionMatch = String(item.description || '').toLowerCase().includes(searchLower);
          return nameMatch || skuMatch || descriptionMatch;
        });
      }
      
      setItems(finalItems);
      setTotalCount(finalItems.length); // Use filtered count
      setAvailableBrands(uniqueBrands);
      
      // Cache the filtered results
      if (!searchTerm || forceRefresh) {
        firebaseCache.set(baseCacheKey, {
          items: safeItems,
          total: safeItems.length,
          brands: uniqueBrands
        }, 15 * 60 * 1000); // Cache for 15 minutes
      }
      
      showSnackbar('Items fetched successfully!', 'success');
    } catch (error) {
      console.error('Error fetching items:', error);
      showSnackbar(`Error fetching items: ${error.message}`, 'error');
      setTotalCount(0);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [page, rowsPerPage, selectedBrand, filterInactive, searchTerm, showSnackbar]);

  // Load items on mount and when dependencies change
  useEffect(() => {
    fetchItems();
  }, [page, rowsPerPage, searchTerm, filterInactive, selectedBrand]);

  // Load Firebase brands and extract manufacturers for ImageManagement
  useEffect(() => {
    checkFirebaseAndLoad();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Extract unique manufacturers from items
  useEffect(() => {
    if (items && items.length > 0) {
      // Create a map to store unique manufacturers with their original names
      const manufacturerMap = new Map();
      
      items.forEach(item => {
        const original = item.brand || item.manufacturer;
        if (original) {
          const normalized = normalizeBrandName(original);
          if (normalized !== 'unknown' && !manufacturerMap.has(normalized)) {
            manufacturerMap.set(normalized, original);
          }
        }
      });
      
      // Convert to array of objects sorted by original name
      const uniqueManufacturers = Array.from(manufacturerMap.entries())
        .map(([normalized, original]) => ({ normalized, original }))
        .sort((a, b) => {
          const aStr = String(a.original || '');
          const bStr = String(b.original || '');
          return aStr.toLowerCase().localeCompare(bStr.toLowerCase());
        });
      
      setManufacturers(uniqueManufacturers);
    }
  }, [items]);

  // Create manufacturerOptions from manufacturers data
  const manufacturerOptions = useMemo(() => {
    return manufacturers.map(m => m.original).filter(Boolean);
  }, [manufacturers]);

  // Load product images when image dialog opens
  useEffect(() => {
    if (imageDialog && selectedProduct) {
      getProductImages(selectedProduct);
    }
  }, [imageDialog, selectedProduct]);

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
      const newSelected = new Set(items.map((n) => n.item_id));
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
    // This function is no longer needed as sorting is handled by backend
    // For now, we'll just re-fetch with current params
    fetchItems(true);
  };

  // FIX: Corrected logic for filterInactive checkbox
  const handleFilterInactiveChange = (event) => {
    setFilterInactive(event.target.checked); // Set filterInactive to true if checked (meaning, filter for active items)
  };


  const isSelected = (itemId) => selectedItems.has(itemId);

  const handleItemClick = (item) => {
    // Clean the item before passing it to ItemDetail
    const cleanedItem = cleanItemData(item);
    console.log('Cleaned item being passed to ItemDetail:', cleanedItem);
    
    setSelectedItem(cleanedItem);
    setDetailDialogOpen(true);
  };

  const handleCloseDetailDialog = () => {
    setDetailDialogOpen(false);
    setSelectedItem(null);
  };

  // Image Management functions
  const checkFirebaseAndLoad = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/firebase/status`);
      if (response.ok) {
        loadFirebaseBrands();
      } else {
        console.log('Firebase endpoints not available yet');
      }
    } catch (error) {
      console.log('Firebase not configured:', error);
    }
  };

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
      showSnackbar('Failed to load brands from Firebase', 'error');
    }
  };

  const matchAllImages = async () => {
    const itemsToMatch = selectedBrand === 'all' || !selectedBrand
      ? items 
      : items.filter(item => item.brand_normalized === normalizeBrandName(selectedBrand));

    if (itemsToMatch.length === 0) {
      showSnackbar('No products to match', 'warning');
      return;
    }

    setIsMatching(true);
    setMatchProgress({ current: 0, total: itemsToMatch.length });
    
    const BATCH_SIZE = 50;
    const batches = Math.ceil(itemsToMatch.length / BATCH_SIZE);
    
    const allResults = {
      matched: 0,
      notMatched: 0,
      errors: 0,
      products: []
    };

    try {
      for (let i = 0; i < batches; i++) {
        const batch = itemsToMatch.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        
        const response = await fetch(`${API_BASE_URL}/workflow/match-images`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            products: batch
          }),
        });

        if (response.ok) {
          const data = await response.json();
          allResults.matched += data.matched || 0;
          allResults.notMatched += data.notMatched || 0;
          allResults.errors += data.errors || 0;
          allResults.products.push(...(data.products || []));
        } else {
          allResults.errors += batch.length;
        }
        
        setMatchProgress({ current: (i + 1) * BATCH_SIZE, total: itemsToMatch.length });
      }

      showSnackbar(
        `Image matching complete! ${allResults.matched} matched, ${allResults.notMatched} not found, ${allResults.errors} errors`, 
        allResults.errors > 0 ? 'warning' : 'success'
      );
      
      // IMPORTANT: Force refresh items to show updated image status
      await fetchItems(true, true); // Force refresh with cache bypass
      
    } catch (error) {
      console.error('Error matching images:', error);
      showSnackbar(`Image matching failed: ${error.message}`, 'error');
    } finally {
      setIsMatching(false);
      setMatchProgress({ current: 0, total: 0 });
    }
  };

  const getProductImages = async (product) => {
    if (!product || !product.sku) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/firebase/product-images/${product.sku}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProductImages(prev => ({
            ...prev,
            [product.sku]: data
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching product images:', error);
    }
  };

  const processAndUploadImages = async () => {
    if (!selectedProduct || selectedFiles.length === 0) return;
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      formData.append('sku', selectedProduct.sku);
      formData.append('brand', normalizeBrandName(selectedProduct.manufacturer || selectedProduct.brand));
      formData.append('padding', processOptions.padding);
      formData.append('quality', processOptions.quality);
      formData.append('createVariants', processOptions.createVariants);
      
      selectedFiles.forEach(file => {
        formData.append('images', file);
      });
      
      const response = await fetch(`${API_BASE_URL}/firebase/upload-images`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          showSnackbar('Images uploaded successfully!', 'success');
          setUploadDialog(false);
          setSelectedFiles([]);
          getProductImages(selectedProduct);
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      showSnackbar(`Upload failed: ${error.message}`, 'error');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const runCompleteSync = async () => {
    setSyncStatus('running');
    try {
      const response = await fetch(`${API_BASE_URL}/workflow/complete-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        showSnackbar(
          `Complete sync finished! ${data.summary?.matched || 0} items matched with images.`, 
          'success'
        );
        await fetchItems(true, true); // Force refresh the items list
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Complete sync failed');
      }
    } catch (error) {
      console.error('Error in complete sync:', error);
      showSnackbar(`Complete sync failed: ${error.message}`, 'error');
    } finally {
      setSyncStatus('idle');
    }
  };

  const getImageStatus = (product) => {
    const images = productImages[product.sku];
    if (images && images.images && images.images.length > 0) {
      return { status: 'matched', count: images.images.length };
    }
    return { status: 'missing', count: 0 };
  };

  const handleFileSelect = (event) => {
    setSelectedFiles(Array.from(event.target.files));
  };

  const handleBatchFileSelect = (event) => {
    setBatchFiles(Array.from(event.target.files));
  };

  const handleBatchUpload = async () => {
    if (batchFiles.length === 0) {
      showSnackbar('Please select images to upload', 'warning');
      return;
    }
    
    if (!batchSelectedBrand) {
      showSnackbar('Please select a brand', 'warning');
      return;
    }
    
    setBatchUploading(true);
    setBatchUploadProgress({ current: 0, total: batchFiles.length });
    
    try {
      const formData = new FormData();
      formData.append('brand', normalizeBrandName(batchSelectedBrand));
      
      // Add all files
      batchFiles.forEach(file => {
        formData.append('images', file);
      });
      
      const response = await fetch(`${API_BASE_URL}/firebase/batch-upload-images`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          showSnackbar(
            `Batch upload complete! ${data.summary.successful} succeeded, ${data.summary.failed} failed`,
            data.summary.failed > 0 ? 'warning' : 'success'
          );
          
          // Close dialog and reset
          setBatchUploadDialog(false);
          setBatchFiles([]);
          setBatchSelectedBrand('');
          
          // Refresh brands list
          loadFirebaseBrands();
          
          // If we're viewing this brand, refresh the image matching
          if (selectedBrand === normalizeBrandName(batchSelectedBrand)) {
            matchAllImages();
          }
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Batch upload failed');
      }
    } catch (error) {
      console.error('Error in batch upload:', error);
      showSnackbar(`Batch upload failed: ${error.message}`, 'error');
    } finally {
      setBatchUploading(false);
      setBatchUploadProgress({ current: 0, total: 0 });
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const itemName = String(item.name || '');
      const itemSku = String(item.sku || '');
      const itemDescription = String(item.description || '');
      const searchLower = String(searchTerm || '').toLowerCase();
      
      // Search filter
      const searchMatch = !searchTerm || 
        itemName.toLowerCase().includes(searchLower) ||
        itemSku.toLowerCase().includes(searchLower) ||
        itemDescription.toLowerCase().includes(searchLower);
      
      // Brand filter using brand_normalized
      const brandMatch = !selectedBrand || selectedBrand === '' || 
        (item.brand_normalized && item.brand_normalized === normalizeBrandName(selectedBrand));
      
      return searchMatch && brandMatch;
    });
  }, [items, searchTerm, selectedBrand]);

  const handleCompleteSync = async () => {
    setLoading(true);
    setSyncStatus('fetchingZoho');
    showSnackbar('Starting complete sync workflow...', 'info');

    try {
      const response = await fetch(`${API_BASE_URL}/workflow/complete-sync`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Complete sync failed');
      }

      const data = await response.json();

      if (data.summary) {
        const { zohoItemsFetched, matchedItems, itemsUploadedToFaire } = data.summary;
        showSnackbar(
          `Sync completed! Fetched ${zohoItemsFetched} items, matched ${matchedItems} with images.`,
          'success'
        );
        setTotalCount(zohoItemsFetched);
      } else {
        showSnackbar(data.message || 'Sync completed', 'success');
      }

      setSyncStatus('complete');
      // Force refresh with cache clear
      firebaseCache.clearAll();
      await fetchItems(true, true);
    } catch (error) {
      console.error('Complete sync failed:', error);
      showSnackbar(`Sync failed: ${error.message}`, 'error');
      setSyncStatus('error');
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
      const selected = items.filter(item => selectedItems.has(item.item_id));
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
      fetchItems(true);
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
      {loading && (
        <ProgressLoader 
          message={getSyncButtonText()} 
          variant="overlay"
          size={50}
        />
      )}
      
      {/* Image Matching Progress Overlay */}
      {isMatching && (
        <ProgressLoader 
          message="Matching Images..."
          submessage={`${matchProgress.current} / ${matchProgress.total} items processed`}
          progress={matchProgress.total > 0 ? (matchProgress.current / matchProgress.total) * 100 : 0}
          variant="overlay"
          size={50}
        />
      )}

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
            borderBottom: `2px solid ${theme.palette.primary.main}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          Zoho-Faire Integration Dashboard
          
          {/* Status Badges in Header */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {/* Faire Status Badge */}
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

            {/* Firebase Status Badge */}
            <Tooltip 
              title={
                firebaseBrands.length > 0
                  ? `Connected to Firebase (${firebaseBrands.length} brands available)` 
                  : 'Firebase not configured. Click to check connection.'
              } 
              placement="top"
              arrow
            >
              <StatusBadge
                theme={theme}
                connected={firebaseBrands.length > 0}
                onClick={firebaseBrands.length === 0 ? checkFirebaseAndLoad : undefined}
              >
                <Avatar 
                  src="/logos/firebase.png" 
                  alt="Firebase" 
                  className="status-icon"
                  sx={{ 
                    bgcolor: 'white',
                    p: 1,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }} 
                />
              </StatusBadge>
            </Tooltip>
          </Box>
        </Typography>

        {/* Tabs for Navigation */}
        {/* Removed as per edit hint */}

        {/* Zoho Items Tab */}
        {/* This section is now the main view */}
        <Paper 
          elevation={2} 
          sx={{ 
            borderRadius: 3,
            overflow: 'hidden',
            boxShadow: theme.shadows[4]
          }}
        >
          <Toolbar sx={{ 
            pl: { sm: 2 }, 
            pr: { xs: 1, sm: 1 },
            backgroundColor: alpha(theme.palette.primary.main, 0.05),
            borderBottom: `1px solid ${theme.palette.divider}`,
            minHeight: 64,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'nowrap',
            overflowX: 'auto',
            '&::-webkit-scrollbar': {
              height: 6,
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: alpha(theme.palette.primary.main, 0.2),
              borderRadius: 3,
            }
          }}>
            {/* Title */}
            <Typography variant="h6" component="div" sx={{ fontWeight: 600, flexShrink: 0, minWidth: 100 }}>
              Items ({items.length})
            </Typography>
            
            {/* Search and Filter Group */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
              <TextField
                label="Search Items"
                variant="outlined"
                size="small"
                value={searchTerm}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
                }}
                sx={{ width: 200 }}
              />
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={filterInactive}
                    onChange={handleFilterInactiveChange}
                    color="primary"
                    size="small"
                  />
                }
                label="Active Only"
                sx={{ mr: 0, whiteSpace: 'nowrap' }}
              />
              
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel id="brand-filter-label">Brand</InputLabel>
                <Select
                  labelId="brand-filter-label"
                  value={selectedBrand}
                  label="Brand"
                  onChange={e => setSelectedBrand(e.target.value)}
                >
                  <MenuItem value="">All Brands</MenuItem>
                  {availableBrands.map(brand => (
                    <MenuItem key={brand} value={brand}>{brand}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            
            {/* Spacer */}
            <Box sx={{ flexGrow: 1 }} />
            
            {/* Action Buttons Group */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
              <IconButton
                color="primary"
                onClick={() => fetchItems(true, true)}
                disabled={loading}
                title="Refresh"
                sx={{ 
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}`,
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  }
                }}
              >
                <RefreshIcon />
              </IconButton>
              
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={() => {
                  firebaseCache.clearAll();
                  showSnackbar('Cache cleared!', 'info');
                }}
                disabled={loading}
                title="Clear all cached data"
                sx={{ whiteSpace: 'nowrap' }}
              >
                Clear Cache
              </Button>
              
              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
              
              <Button
                variant="outlined"
                size="small"
                startIcon={<ImageIcon />}
                onClick={matchAllImages}
                disabled={loading || isMatching}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Match Images
              </Button>
              
              <Button
                variant="contained"
                size="small"
                color="secondary"
                startIcon={<AddPhotoIcon />}
                onClick={() => setBatchUploadDialog(true)}
                disabled={loading || isMatching}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Batch Upload
              </Button>
              
              <Button
                variant="contained"
                size="small"
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <CloudSyncIcon />}
                onClick={handleCompleteSync}
                disabled={loading || isMatching}
                sx={{ 
                  whiteSpace: 'nowrap',
                  minWidth: 140,
                  backgroundColor: theme.palette.primary.main,
                  '&:hover': {
                    backgroundColor: theme.palette.primary.dark,
                  }
                }}
              >
                {getSyncButtonText()}
              </Button>
              
              {selectedItems.size > 0 && (
                <Button
                  variant="contained"
                  size="small"
                  color="success"
                  startIcon={<UploadIcon />}
                  onClick={handleUploadToFaire}
                  disabled={loading}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  Upload to Faire ({selectedItems.size})
                </Button>
              )}
            </Box>
          </Toolbar>

          <TableContainer>
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
                      checked={selectedItems.size === items.length && items.length > 0}
                      indeterminate={selectedItems.size > 0 && selectedItems.size < items.length}
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
                    Item Name
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
                    SKU
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
                  filteredItems.map((item) => {
                      const isItemSelected = isSelected(item.item_id);
                      return (
                        <TableRow
                          hover
                          key={item.item_id}
                          selected={isSelected(item.item_id)}
                          sx={{
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: alpha(theme.palette.primary.main, 0.08),
                            },
                          }}
                          onClick={() => handleItemClick(item)}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={isSelected(item.item_id)}
                              onChange={(event) => handleSelectItem(event, item.item_id)}
                              onClick={(e) => e.stopPropagation()} // Prevent row click when clicking checkbox
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <BrandAvatar brand={typeof (item.brand || item.manufacturer) === 'string' ? (item.brand || item.manufacturer) : 'Unknown'} size={32} />
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {typeof item.name === 'string' ? item.name : 'No Name'}
                                </Typography>
                                <Tooltip title="View details">
                                  <VisibilityIcon fontSize="small" color="action" />
                                </Tooltip>
                                <Typography variant="caption" color="text.secondary">
                                  {typeof (item.brand || item.manufacturer) === 'string' ? (item.brand || item.manufacturer) : 'No Brand'}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {typeof item.sku === 'string' ? item.sku : 'No SKU'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={item.images_matched ? `Has images (${item.imageCount || 0})` : "No images"}
                              color={item.images_matched ? "success" : "warning"}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  fontWeight: 600,
                                  color: (item.stock_on_hand || 0) <= 10 
                                    ? theme.palette.error.main 
                                    : theme.palette.text.primary
                                }}
                              >
                                {item.stock_on_hand || 0}
                              </Typography>
                              {(item.stock_on_hand || 0) <= 10 && (
                                <WarningIcon sx={{ fontSize: 16, color: theme.palette.error.main }} />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              ${parseFloat(item.rate || 0).toFixed(2)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                              {item.images_matched ? (
                                <img
                                  src={item.images && item.images.length > 0 ? item.images[0].url : ''}
                                  alt="thumbnail"
                                  style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: '50%' }}
                                />
                              ) : (
                                <ImageNotSupportedIcon />
                              )}
                              <Tooltip title="Manage product images">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Clean the item before setting it to avoid rendering issues
                                    const cleanedItem = cleanItemData(item);
                                    setSelectedProduct(cleanedItem);
                                    setImageDialog(true);
                                  }}
                                >
                                  <ImageIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="View product details">
                                <IconButton
                                  size="small"
                                  color="info"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleItemClick(item);
                                  }}
                                >
                                  <VisibilityIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label="Not Uploaded"
                              size="small"
                              color="default"
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          <TablePagination
            rowsPerPageOptions={[50, 100, 200]}
            component="div"
            count={totalCount}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>

        {/* Image Management Tab */}
        {/* This section is now the main view */}
      </Paper>

      {/* Item Detail Dialog */}
      {selectedItem && (
        <ItemDetail
          item={selectedItem}
          open={detailDialogOpen}
          onClose={handleCloseDetailDialog}
          onAlert={showSnackbar}
          onRefreshItems={() => fetchItems(true)}
        />
      )}

      {/* Image View Dialog */}
      <Dialog
        open={imageDialog}
        onClose={() => setImageDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {typeof selectedProduct?.name === 'string' ? selectedProduct.name : 'Product'} - Images
          <Typography variant="caption" display="block">
            SKU: {typeof selectedProduct?.sku === 'string' ? selectedProduct.sku : 'No SKU'}
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
          Upload Images - {typeof selectedProduct?.name === 'string' ? selectedProduct.name : 'Product'}
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

      {/* Batch Upload Dialog */}
      <Dialog
        open={batchUploadDialog}
        onClose={() => setBatchUploadDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <AddPhotoIcon color="primary" />
            <Typography variant="h6">Batch Image Upload</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Upload multiple product images at once. Images should be named with their SKU 
              (e.g., "ABC123.jpg" or "ABC123_main.jpg").
            </Typography>
            
            <FormControl fullWidth sx={{ mt: 3, mb: 3 }}>
              <InputLabel id="batch-brand-select-label">Select Brand</InputLabel>
              <Select
                labelId="batch-brand-select-label"
                value={batchSelectedBrand}
                onChange={(e) => setBatchSelectedBrand(e.target.value)}
                label="Select Brand"
                renderValue={(selected) => {
                  if (!selected) return '';
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BrandAvatar brand={selected} size={20} />
                      <span>{selected}</span>
                    </Box>
                  );
                }}
              >
                {(() => {
                  // Combine Firebase brands with manufacturers, avoiding duplicates
                  const brandSet = new Map();
                  
                  // Add Firebase brands
                  firebaseBrands.forEach(brand => {
                    const normalized = normalizeBrandName(brand);
                    if (!brandSet.has(normalized)) {
                      brandSet.set(normalized, brand);
                    }
                  });
                  
                  // Add manufacturers
                  manufacturers.forEach(mfr => {
                    if (!brandSet.has(mfr.normalized)) {
                      brandSet.set(mfr.normalized, mfr.original);
                    }
                  });
                  
                  // Convert to sorted array
                  return Array.from(brandSet.entries())
                    .map(([normalized, original]) => ({ normalized, original }))
                    .sort((a, b) => {
                      const aStr = String(a.original || '');
                      const bStr = String(b.original || '');
                      return aStr.toLowerCase().localeCompare(bStr.toLowerCase());
                    })
                    .map(brand => (
                      <MenuItem key={brand.original} value={brand.original}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <BrandAvatar brand={brand.original} size={24} />
                          <span>{brand.original}</span>
                        </Box>
                      </MenuItem>
                    ));
                })()}
              </Select>
            </FormControl>
            
            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="batch-image-file-input"
              multiple
              type="file"
              onChange={handleBatchFileSelect}
            />
            <label htmlFor="batch-image-file-input">
              <Button
                variant="outlined"
                component="span"
                startIcon={<AddPhotoIcon />}
                fullWidth
                size="large"
              >
                Select Images ({batchFiles.length} selected)
              </Button>
            </label>
            
            {batchFiles.length > 0 && (
              <Box sx={{ mt: 2, maxHeight: 200, overflow: 'auto' }}>
                <List dense>
                  {batchFiles.map((file, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <ImageIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={file.name}
                        secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
                      />
                    </ListItem>
                  ))}
                </List>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  Total size: {(batchFiles.reduce((acc, file) => acc + file.size, 0) / 1024 / 1024).toFixed(2)} MB
                </Typography>
              </Box>
            )}
          </Box>
          
          {batchUploading && (
            <Box sx={{ mt: 3 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                Processing images... Please wait
              </Typography>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setBatchUploadDialog(false)} disabled={batchUploading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleBatchUpload}
            disabled={batchFiles.length === 0 || !batchSelectedBrand || batchUploading}
            startIcon={batchUploading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
          >
            {batchUploading ? 'Uploading...' : 'Upload & Process'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ZohoFaireIntegration;