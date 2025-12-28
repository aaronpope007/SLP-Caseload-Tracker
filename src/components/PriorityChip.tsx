import React, { memo } from 'react';
import { Chip } from '@mui/material';
import { getPriorityChipColor } from '../utils/helpers';

interface PriorityChipProps {
  priority: 'high' | 'medium' | 'low';
  size?: 'small' | 'medium';
  variant?: 'filled' | 'outlined';
}

export const PriorityChip: React.FC<PriorityChipProps> = memo(({ 
  priority, 
  size = 'small',
  variant = 'outlined'
}) => {
  return (
    <Chip
      label={priority}
      size={size}
      color={getPriorityChipColor(priority)}
      variant={variant}
    />
  );
});

