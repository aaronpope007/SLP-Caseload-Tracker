import { useState, useCallback } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';

interface SnackbarState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

/**
 * Hook for managing snackbar notifications
 * 
 * @example
 * const { snackbar, showSnackbar, SnackbarComponent } = useSnackbar();
 * 
 * showSnackbar('Student saved successfully', 'success');
 * 
 * return (
 *   <>
 *     ...
 *     <SnackbarComponent />
 *   </>
 * );
 */
export const useSnackbar = () => {
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showSnackbar = useCallback((message: string, severity: AlertColor = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  }, []);

  const hideSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  const SnackbarComponent = useCallback(() => {
    return (
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={hideSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={hideSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    );
  }, [snackbar, hideSnackbar]);

  return {
    snackbar,
    showSnackbar,
    hideSnackbar,
    SnackbarComponent,
    // For backward compatibility with existing code that uses setSnackbar directly
    setSnackbar,
  };
};

