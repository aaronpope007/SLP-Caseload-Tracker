/**
 * 404 Not Found Page
 * 
 * Displayed when a user navigates to a route that doesn't exist.
 */

import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Paper, Stack } from '@mui/material';
import { 
  SearchOff as SearchOffIcon, 
  Home as HomeIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        p: 3,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 4,
          maxWidth: 500,
          width: '100%',
          textAlign: 'center',
          bgcolor: 'transparent',
        }}
      >
        <SearchOffIcon 
          sx={{ 
            fontSize: 80, 
            color: 'text.secondary',
            mb: 2,
            opacity: 0.7,
          }} 
        />
        
        <Typography variant="h1" color="text.secondary" sx={{ mb: 1, fontSize: '6rem', fontWeight: 'bold' }}>
          404
        </Typography>
        
        <Typography variant="h5" gutterBottom>
          Page Not Found
        </Typography>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          The page you're looking for doesn't exist or has been moved.
          Check the URL or navigate back to the dashboard.
        </Typography>

        <Stack direction="row" spacing={2} justifyContent="center">
          <Button
            variant="contained"
            startIcon={<HomeIcon />}
            onClick={() => navigate('/')}
          >
            Go to Dashboard
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
          >
            Go Back
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

export default NotFound;

