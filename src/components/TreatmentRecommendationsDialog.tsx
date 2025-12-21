import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';

interface TreatmentRecommendationsDialogProps {
  open: boolean;
  recommendations: string;
  loading: boolean;
  error: string;
  onClose: () => void;
}

export const TreatmentRecommendationsDialog: React.FC<TreatmentRecommendationsDialogProps> = ({
  open,
  recommendations,
  loading,
  error,
  onClose,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Treatment Recommendations</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && (
            <Alert severity="error">{error}</Alert>
          )}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          )}
          {recommendations && (
            <Typography
              component="div"
              sx={{
                whiteSpace: 'pre-wrap',
                p: 2,
                bgcolor: 'grey.50',
                borderRadius: 1,
                maxHeight: '500px',
                overflow: 'auto',
              }}
            >
              {recommendations}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

