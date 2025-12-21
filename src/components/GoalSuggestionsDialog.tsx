import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';

interface GoalSuggestionsDialogProps {
  open: boolean;
  goalArea: string;
  goalSuggestions: string;
  loading: boolean;
  error: string;
  onClose: () => void;
  onGoalAreaChange: (value: string) => void;
  onGenerate: () => void;
}

export const GoalSuggestionsDialog: React.FC<GoalSuggestionsDialogProps> = ({
  open,
  goalArea,
  goalSuggestions,
  loading,
  error,
  onClose,
  onGoalAreaChange,
  onGenerate,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>AI Goal Writing Assistant</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Goal Area"
            fullWidth
            value={goalArea}
            onChange={(e) => onGoalAreaChange(e.target.value)}
            placeholder="e.g., Articulation, Language, Fluency, Pragmatics"
            helperText="Enter the area you'd like to write goals for"
          />
          {error && (
            <Alert severity="error">{error}</Alert>
          )}
          <Button
            variant="contained"
            onClick={onGenerate}
            disabled={loading || !goalArea.trim()}
            startIcon={loading ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
          >
            Generate Goal Suggestions
          </Button>
          {goalSuggestions && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>Suggestions:</Typography>
              <Typography
                component="div"
                sx={{
                  whiteSpace: 'pre-wrap',
                  p: 2,
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  maxHeight: '400px',
                  overflow: 'auto',
                }}
              >
                {goalSuggestions}
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

