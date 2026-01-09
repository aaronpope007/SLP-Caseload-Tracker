/**
 * Route Error Boundary
 * 
 * Handles errors that occur within React Router routes.
 * Provides a user-friendly error page with options to recover.
 */

import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Paper, Stack } from '@mui/material';
import { 
  Error as ErrorIcon, 
  Home as HomeIcon, 
  Refresh as RefreshIcon,
  BugReport as BugReportIcon,
} from '@mui/icons-material';
import { logError } from '../../utils/logger';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  // Log the error
  logError('Route error occurred', error);

  // Determine error type and message
  let title = 'Something went wrong';
  let message = 'An unexpected error occurred while loading this page.';
  let statusCode: number | null = null;

  if (isRouteErrorResponse(error)) {
    statusCode = error.status;
    
    switch (error.status) {
      case 404:
        title = 'Page Not Found';
        message = "The page you're looking for doesn't exist or has been moved.";
        break;
      case 401:
        title = 'Unauthorized';
        message = 'You need to be logged in to access this page.';
        break;
      case 403:
        title = 'Access Denied';
        message = "You don't have permission to access this page.";
        break;
      case 500:
        title = 'Server Error';
        message = 'Something went wrong on our end. Please try again later.';
        break;
      default:
        title = `Error ${error.status}`;
        message = error.statusText || 'An error occurred.';
    }
  } else if (error instanceof Error) {
    message = error.message;
    
    // Check for common error patterns
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      title = 'Connection Error';
      message = 'Unable to connect to the server. Please check your internet connection and make sure the API server is running.';
    } else if (error.message.includes('chunk')) {
      title = 'Loading Error';
      message = 'Failed to load page resources. Please refresh and try again.';
    }
  }

  const handleGoHome = () => {
    navigate('/', { replace: true });
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        p: 3,
        bgcolor: 'background.default',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 500,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <ErrorIcon 
          sx={{ 
            fontSize: 64, 
            color: statusCode === 404 ? 'warning.main' : 'error.main',
            mb: 2,
          }} 
        />
        
        {statusCode && (
          <Typography variant="h2" color="text.secondary" sx={{ mb: 1 }}>
            {statusCode}
          </Typography>
        )}
        
        <Typography variant="h4" gutterBottom>
          {title}
        </Typography>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {message}
        </Typography>

        <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap" useFlexGap>
          <Button
            variant="contained"
            startIcon={<HomeIcon />}
            onClick={handleGoHome}
          >
            Go to Dashboard
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
          >
            Refresh Page
          </Button>
        </Stack>

        {/* Show technical details in development */}
        {process.env.NODE_ENV === 'development' && error instanceof Error && (
          <Box sx={{ mt: 3, textAlign: 'left' }}>
            <Typography variant="caption" color="text.secondary" component="div">
              <BugReportIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
              Debug Info (dev only):
            </Typography>
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                mt: 1, 
                bgcolor: 'grey.100',
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              <Typography 
                variant="caption" 
                component="pre" 
                sx={{ 
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  m: 0,
                }}
              >
                {error.stack || error.message}
              </Typography>
            </Paper>
          </Box>
        )}
      </Paper>
    </Box>
  );
}

export default RouteErrorBoundary;

