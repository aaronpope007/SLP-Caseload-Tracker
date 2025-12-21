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
import { School as SchoolIcon } from '@mui/icons-material';

interface IEPGoalsDialogProps {
  open: boolean;
  assessmentData: string;
  iepGoals: string;
  loading: boolean;
  error: string;
  onClose: () => void;
  onAssessmentDataChange: (value: string) => void;
  onGenerate: () => void;
}

export const IEPGoalsDialog: React.FC<IEPGoalsDialogProps> = ({
  open,
  assessmentData,
  iepGoals,
  loading,
  error,
  onClose,
  onAssessmentDataChange,
  onGenerate,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Generate IEP Goals from Assessment Data</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Assessment Data"
            fullWidth
            multiline
            rows={8}
            value={assessmentData}
            onChange={(e) => onAssessmentDataChange(e.target.value)}
            placeholder="Enter assessment results, observations, test scores, areas of need, etc."
            helperText="Provide comprehensive assessment data to generate appropriate IEP goals"
          />
          {error && (
            <Alert severity="error">{error}</Alert>
          )}
          <Button
            variant="contained"
            onClick={onGenerate}
            disabled={loading || !assessmentData.trim()}
            startIcon={loading ? <CircularProgress size={20} /> : <SchoolIcon />}
          >
            Generate IEP Goals
          </Button>
          {iepGoals && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>Generated IEP Goals:</Typography>
              <Typography
                component="div"
                sx={{
                  whiteSpace: 'pre-wrap',
                  p: 2,
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  maxHeight: '500px',
                  overflow: 'auto',
                }}
              >
                {iepGoals}
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

