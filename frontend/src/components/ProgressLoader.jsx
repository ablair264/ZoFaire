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
} from '@mui/material';
import Lottie from 'lottie-react';
import loaderAnimation from '../loader.json';

const ProgressLoader = ({ 
  progress, 
  message = 'Loading...', 
  submessage,
  size = 100,
  variant = 'default'
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  if (variant === 'minimal') {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress 
          variant="determinate" 
          value={progress}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              background: theme.gradients.accent,
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
        gap: 3,
        width: '100%',
        maxWidth: 400,
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
            width: size * 1.5,
            height: size * 1.5,
            background: theme.gradients.accent,
            borderRadius: '50%',
            opacity: 0.1,
            filter: 'blur(40px)',
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
          variant="h5" 
          sx={{ 
            fontWeight: 600,
            background: theme.gradients.primary,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            mb: 1,
          }}
        >
          {message}
        </Typography>
        {submessage && (
          <Fade in={true} timeout={600}>
            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{ opacity: 0.8 }}
            >
              {submessage}
            </Typography>
          </Fade>
        )}
      </Box>
      
      {/* Progress Bar Container */}
      <Box sx={{ width: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 1,
          }}
        >
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              flexGrow: 1,
              height: 10,
              borderRadius: 5,
              backgroundColor: alpha(theme.palette.primary.main, isDarkMode ? 0.2 : 0.1),
              '& .MuiLinearProgress-bar': {
                borderRadius: 5,
                background: theme.gradients.accent,
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
            variant="h6" 
            sx={{ 
              fontWeight: 600,
              color: theme.palette.primary.main,
              minWidth: 50,
              textAlign: 'right',
            }}
          >
            {Math.round(progress)}%
          </Typography>
        </Box>
      </Box>
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
          backgroundColor: alpha(isDarkMode ? '#000' : '#fff', 0.8),
          backdropFilter: 'blur(10px)',
          zIndex: 9999,
        }}
      >
        <Paper
          sx={{
            p: 4,
            borderRadius: 3,
            backgroundColor: theme.palette.background.paper,
            boxShadow: theme.shadows[20],
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
        p: 3,
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