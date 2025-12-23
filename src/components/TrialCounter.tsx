import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { Add as AddIcon, Remove as RemoveIcon } from '@mui/icons-material';

interface TrialCounterProps {
  correctTrials: number;
  incorrectTrials: number;
  onIncrement: () => void;
  onDecrement: () => void;
  isCompact?: boolean;
}

export const TrialCounter: React.FC<TrialCounterProps> = ({
  correctTrials,
  incorrectTrials,
  onIncrement,
  onDecrement,
  isCompact = false,
}) => {
  const totalTrials = correctTrials + incorrectTrials;
  const calculatedAccuracy = totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0;
  const displayText = totalTrials > 0 
    ? `${correctTrials}/${totalTrials} trials (${calculatedAccuracy}%)` 
    : '0/0 trials (0%)';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
      <IconButton
        size="small"
        onClick={onDecrement}
        color="error"
        sx={{ border: '1px solid', borderColor: 'error.main' }}
      >
        <RemoveIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={onIncrement}
        color="success"
        sx={{ border: '1px solid', borderColor: 'success.main' }}
      >
        <AddIcon fontSize="small" />
      </IconButton>
      <Typography 
        variant="body2" 
        sx={{ 
          ml: 1, 
          minWidth: isCompact ? '120px' : '140px', 
          fontSize: isCompact ? '0.75rem' : 'inherit' 
        }}
      >
        {displayText}
      </Typography>
    </Box>
  );
};

