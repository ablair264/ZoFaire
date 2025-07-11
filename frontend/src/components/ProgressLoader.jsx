// src/components/ProgressLoader.jsx
import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Paper,
  useTheme,
  alpha,
  Fade,
  CircularProgress,
} from '@mui/material';
import Lottie from 'lottie-react';
import loaderAnimation from '../loader.json';

const ProgressLoader = ({ 
  progress, 
  message = 'Loading...', 
  submessage,
  size = 60,
  variant = 'overlay'
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // Fix NaN% issue by ensuring progress is a valid number
  const validProgress = typeof progress === 'number' && !isNaN(progress) ? Math.max(0, Math.min(100, progress)) : 0;

  if (variant === 'minimal') {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress 
          variant="determinate" 
          value={validProgress}
          sx={{
            height: 6,
            borderRadius: 3,
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            '& .MuiLinearProgress-bar': {
              borderRadius: 3,
              background: theme.gradients?.accent || theme.palette.primary.main,
            }
          }}
        />
      </Box>
    );
  }

  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        width: '100%',
        maxWidth: 300,
      }}
    >
      {/* Lottie Animation with backdrop */}
      <Box
        sx={{
          position: 'relative',
          width: size,
          height: size,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: size * 1.2,
            height: size * 1.2,
            background: theme.gradients?.accent || theme.palette.primary.main,
            borderRadius: '50%',
            opacity: 0.1,
            filter: 'blur(20px)',
          }}
        />
        <Lottie 
          animationData={loaderAnimation}
          loop={true}
          autoplay={true}
          style={{ 
            width: size, 
            height: size,
            position: 'relative',
            zIndex: 1,
          }}
        />
      </Box>
      
      {/* Text Information */}
      <Box sx={{ textAlign: 'center' }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 600,
            background: theme.gradients?.primary || theme.palette.primary.main,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            mb: 0.5,
          }}
        >
          {message}
        </Typography>
        {submessage && (
          <Fade in={true} timeout={600}>
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{ opacity: 0.8 }}
            >
              {submessage}
            </Typography>
          </Fade>
        )}
      </Box>
      
      {/* Progress Bar Container - Only show if progress is provided */}
      {typeof progress === 'number' && (
        <Box sx={{ width: '100%' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 0.5,
            }}
          >
            <LinearProgress
              variant="determinate"
              value={validProgress}
              sx={{
                flexGrow: 1,
                height: 6,
                borderRadius: 3,
                backgroundColor: alpha(theme.palette.primary.main, isDarkMode ? 0.2 : 0.1),
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  background: theme.gradients?.accent || theme.palette.primary.main,
                  position: 'relative',
                  overflow: 'hidden',
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                    animation: 'shimmer 1.5s infinite',
                  },
                },
              }}
            />
            <Typography 
              variant="caption" 
              sx={{ 
                fontWeight: 600,
                color: theme.palette.primary.main,
                minWidth: 35,
                textAlign: 'right',
              }}
            >
              {Math.round(validProgress)}%
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );

  if (variant === 'overlay') {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(isDarkMode ? '#000' : '#fff', 0.7),
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
        }}
      >
        <Paper
          sx={{
            p: 3,
            borderRadius: 2,
            backgroundColor: theme.palette.background.paper,
            boxShadow: theme.shadows[15],
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}
        >
          {content}
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      {content}
    </Box>
  );
};

// CSS for shimmer animation
const styles = `
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
`;

// Add styles to document
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

export default ProgressLoader;