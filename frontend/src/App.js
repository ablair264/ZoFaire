import React, { useState, useMemo } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import {
  CssBaseline,
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  useMediaQuery,
} from '@mui/material';
import {
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
} from '@mui/icons-material';
import ZohoFaireIntegration from './components/ZohoFaireIntegration';
import { lightTheme, darkTheme, getLogoPath } from './theme/theme';

function App() {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [darkMode, setDarkMode] = useState(prefersDarkMode);
  
  const theme = useMemo(() => darkMode ? darkTheme : lightTheme, [darkMode]);
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleThemeToggle = () => {
    setDarkMode(!darkMode);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      
      {/* App Bar with Logo */}
      <AppBar 
        position="sticky" 
        elevation={0}
        sx={{
          backgroundColor: theme.palette.mode === 'dark' 
            ? 'rgba(30, 41, 59, 0.8)' 
            : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${theme.palette.mode === 'dark' 
            ? 'rgba(255, 255, 255, 0.08)' 
            : 'rgba(0, 0, 0, 0.08)'}`,
        }}
      >
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <img 
              src={getLogoPath(darkMode)} 
              alt="Splitfin Logo" 
              style={{ 
                height: isMobile ? 32 : 40,
                marginRight: 16,
              }}
            />
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 700,
                background: theme.gradients.primary,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              ZoFaire Integration
            </Typography>
          </Box>
          <IconButton onClick={handleThemeToggle} color="inherit">
            {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: theme.palette.background.default,
        }}
      >
        <ZohoFaireIntegration />
      </Box>
    </ThemeProvider>
  );
}

export default App;