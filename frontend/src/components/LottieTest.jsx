// Test component to verify Lottie is working
import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import Lottie from 'lottie-react';
import loaderAnimation from '../loader.json';

const LottieTest = () => {
  return (
    <Paper sx={{ p: 4, m: 4, textAlign: 'center' }}>
      <Typography variant="h6" gutterBottom>
        Lottie Animation Test
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
        <Lottie 
          animationData={loaderAnimation}
          loop={true}
          autoplay={true}
          style={{ width: 100, height: 100 }}
        />
      </Box>
      <Typography variant="body2" color="text.secondary">
        If you can see an animated loader above, Lottie is working correctly.
      </Typography>
    </Paper>
  );
};

export default LottieTest;