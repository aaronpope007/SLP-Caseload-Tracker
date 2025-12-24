import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Alert,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import type { Goal } from '../types';

interface Replacement {
  from: string;
  to: string;
}

interface CopySubtreeDialogProps {
  open: boolean;
  goal: Goal | null;
  onClose: () => void;
  onConfirm: (replacements: Replacement[]) => void;
}

export const CopySubtreeDialog: React.FC<CopySubtreeDialogProps> = ({
  open,
  goal,
  onClose,
  onConfirm,
}) => {
  const [replacements, setReplacements] = useState<Replacement[]>([
    { from: '', to: '' },
  ]);

  const handleAddReplacement = () => {
    setReplacements([...replacements, { from: '', to: '' }]);
  };

  const handleRemoveReplacement = (index: number) => {
    setReplacements(replacements.filter((_, i) => i !== index));
  };

  const handleReplacementChange = (index: number, field: 'from' | 'to', value: string) => {
    const newReplacements = [...replacements];
    newReplacements[index] = { ...newReplacements[index], [field]: value };
    setReplacements(newReplacements);
  };

  const handleConfirm = () => {
    // Filter out empty replacements
    const validReplacements = replacements.filter(r => r.from.trim() !== '');
    onConfirm(validReplacements);
    // Reset form
    setReplacements([{ from: '', to: '' }]);
  };

  const handleClose = () => {
    setReplacements([{ from: '', to: '' }]);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Copy Goal Subtree
      </DialogTitle>
      <DialogContent>
        {goal && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Goal to copy:
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              {goal.description}
            </Typography>
          </Box>
        )}
        
        <Alert severity="info" sx={{ mb: 2 }}>
          This will copy the selected goal and all its sub-goals. You can specify text replacements
          to apply to all descriptions, baselines, and targets (e.g., replace "/t/" with "/d/").
        </Alert>

        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          Text Replacements (optional):
        </Typography>

        {replacements.map((replacement, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
            <TextField
              label="Find"
              value={replacement.from}
              onChange={(e) => handleReplacementChange(index, 'from', e.target.value)}
              placeholder="e.g., /t/"
              size="small"
              sx={{ flex: 1 }}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              →
            </Typography>
            <TextField
              label="Replace with"
              value={replacement.to}
              onChange={(e) => handleReplacementChange(index, 'to', e.target.value)}
              placeholder="e.g., /d/"
              size="small"
              sx={{ flex: 1 }}
            />
            {replacements.length > 1 && (
              <IconButton
                size="small"
                onClick={() => handleRemoveReplacement(index)}
                color="error"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        ))}

        <Button
          startIcon={<AddIcon />}
          onClick={handleAddReplacement}
          size="small"
          sx={{ mt: 1 }}
        >
          Add Replacement
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleConfirm} variant="contained" color="primary">
          Copy Subtree
        </Button>
      </DialogActions>
    </Dialog>
  );
};

