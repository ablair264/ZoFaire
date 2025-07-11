// src/theme/theme.js
import { createTheme, alpha } from '@mui/material/styles';

// Define custom colors and gradients
const customColors = {
  gradients: {
    primary: 'linear-gradient(135deg, #79d5e9 0%, #4daeac 100%)',
    secondary: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    accent: 'linear-gradient(135deg, #448382 0%, #50B9B7 100%)',
    dark: 'linear-gradient(135deg, #1a1f2a 0%, #2c3e50 50%, #34495e 100%)',
    success: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    warning: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  },
  solid: {
    primary: '#4daeac',
    primaryDark: '#448382',
    primaryLight: '#79d5e9',
    secondary: '#6366f1',
    secondaryDark: '#8b5cf6',
    accent: '#50B9B7',
    success: '#22c55e',
    warning: '#fbbf24',
    error: '#ef4444',
  }
};

// Light theme configuration
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: customColors.solid.primary,
      dark: customColors.solid.primaryDark,
      light: customColors.solid.primaryLight,
      contrastText: '#ffffff',
    },
    secondary: {
      main: customColors.solid.secondary,
      dark: customColors.solid.secondaryDark,
      light: '#a5a7ff',
      contrastText: '#ffffff',
    },
    accent: {
      main: customColors.solid.accent,
      dark: customColors.solid.primaryDark,
      light: '#7fc9c7',
      contrastText: '#ffffff',
    },
    success: {
      main: customColors.solid.success,
      light: '#4ade80',
      dark: '#16a34a',
    },
    warning: {
      main: customColors.solid.warning,
      light: '#fcd34d',
      dark: '#f59e0b',
    },
    error: {
      main: customColors.solid.error,
      light: '#f87171',
      dark: '#dc2626',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#1e293b',
      secondary: '#64748b',
    },
  },
  gradients: customColors.gradients,
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.01562em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: '-0.00833em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 12,
  },
  shadows: [
    'none',
    '0px 2px 4px rgba(0,0,0,0.05)',
    '0px 4px 8px rgba(0,0,0,0.05)',
    '0px 8px 16px rgba(0,0,0,0.05)',
    '0px 12px 24px rgba(0,0,0,0.05)',
    '0px 16px 32px rgba(0,0,0,0.05)',
    '0px 20px 40px rgba(0,0,0,0.05)',
    '0px 24px 48px rgba(0,0,0,0.06)',
    '0px 28px 56px rgba(0,0,0,0.06)',
    '0px 32px 64px rgba(0,0,0,0.06)',
    '0px 36px 72px rgba(0,0,0,0.07)',
    '0px 40px 80px rgba(0,0,0,0.07)',
    '0px 44px 88px rgba(0,0,0,0.07)',
    '0px 48px 96px rgba(0,0,0,0.08)',
    '0px 52px 104px rgba(0,0,0,0.08)',
    '0px 56px 112px rgba(0,0,0,0.08)',
    '0px 60px 120px rgba(0,0,0,0.09)',
    '0px 64px 128px rgba(0,0,0,0.09)',
    '0px 68px 136px rgba(0,0,0,0.09)',
    '0px 72px 144px rgba(0,0,0,0.1)',
    '0px 76px 152px rgba(0,0,0,0.1)',
    '0px 80px 160px rgba(0,0,0,0.1)',
    '0px 84px 168px rgba(0,0,0,0.11)',
    '0px 88px 176px rgba(0,0,0,0.11)',
    '0px 92px 184px rgba(0,0,0,0.11)',
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 24px',
          fontSize: '0.875rem',
          fontWeight: 500,
          boxShadow: 'none',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0px 4px 12px rgba(0,0,0,0.1)',
            transform: 'translateY(-1px)',
          },
        },
        containedPrimary: {
          background: customColors.gradients.primary,
          '&:hover': {
            background: customColors.gradients.primary,
            filter: 'brightness(0.95)',
          },
        },
        containedSecondary: {
          background: customColors.gradients.secondary,
          '&:hover': {
            background: customColors.gradients.secondary,
            filter: 'brightness(0.95)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0px 4px 24px rgba(0,0,0,0.04)',
          border: '1px solid rgba(0,0,0,0.05)',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0px 8px 32px rgba(0,0,0,0.08)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0px 4px 24px rgba(0,0,0,0.04)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
        colorPrimary: {
          background: alpha(customColors.solid.primary, 0.1),
          color: customColors.solid.primary,
          border: `1px solid ${alpha(customColors.solid.primary, 0.2)}`,
        },
        colorSuccess: {
          background: alpha(customColors.solid.success, 0.1),
          color: customColors.solid.success,
          border: `1px solid ${alpha(customColors.solid.success, 0.2)}`,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 8,
          borderRadius: 4,
          backgroundColor: alpha(customColors.solid.primary, 0.1),
        },
        bar: {
          borderRadius: 4,
          background: customColors.gradients.accent,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backdropFilter: 'blur(10px)',
        },
      },
    },
  },
});

// Dark theme configuration
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: customColors.solid.primaryLight,
      dark: customColors.solid.primary,
      light: '#a0e5f0',
      contrastText: '#000000',
    },
    secondary: {
      main: customColors.solid.secondaryDark,
      dark: customColors.solid.secondary,
      light: '#b794f6',
      contrastText: '#ffffff',
    },
    accent: {
      main: customColors.solid.accent,
      dark: customColors.solid.primaryDark,
      light: '#7fc9c7',
      contrastText: '#000000',
    },
    success: {
      main: '#4ade80',
      light: '#86efac',
      dark: customColors.solid.success,
    },
    warning: {
      main: '#fcd34d',
      light: '#fde68a',
      dark: customColors.solid.warning,
    },
    error: {
      main: '#f87171',
      light: '#fca5a5',
      dark: customColors.solid.error,
    },
    background: {
      default: '#0f172a',
      paper: '#1e293b',
    },
    text: {
      primary: '#f1f5f9',
      secondary: '#cbd5e1',
    },
  },
  gradients: customColors.gradients,
  typography: lightTheme.typography,
  shape: lightTheme.shape,
  shadows: lightTheme.shadows.map((shadow) => 
    shadow === 'none' ? shadow : shadow.replace(/rgba\(0,0,0,/g, 'rgba(0,0,0,')
  ),
  components: {
    ...lightTheme.components,
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0px 4px 24px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.08)',
          backgroundColor: alpha('#1e293b', 0.6),
          backdropFilter: 'blur(10px)',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0px 8px 32px rgba(0,0,0,0.3)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1e293b',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
        colorPrimary: {
          background: alpha(customColors.solid.primaryLight, 0.2),
          color: customColors.solid.primaryLight,
          border: `1px solid ${alpha(customColors.solid.primaryLight, 0.3)}`,
        },
        colorSuccess: {
          background: alpha('#4ade80', 0.2),
          color: '#4ade80',
          border: `1px solid ${alpha('#4ade80', 0.3)}`,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(customColors.solid.primaryLight, 0.2),
        },
      },
    },
  },
});

// Helper function to get logo based on theme
export const getLogoPath = (isDarkMode) => {
  return isDarkMode ? '/splitfin-white.png' : '/splitfin.png';
};