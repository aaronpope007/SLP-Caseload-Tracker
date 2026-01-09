import React, { memo } from 'react';
import { Chip } from '@mui/material';
import { getStatusChipColor } from '../../utils/helpers';

interface StatusChipProps {
  status: 'in-progress' | 'achieved' | 'modified';
  size?: 'small' | 'medium';
  variant?: 'filled' | 'outlined';
}

const getStatusLabel = (status: 'in-progress' | 'achieved' | 'modified'): string => {
  if (status === 'in-progress') return 'In Progress';
  if (status === 'achieved') return 'Achieved';
  return 'Modified';
};

export const StatusChip: React.FC<StatusChipProps> = memo(({ 
  status, 
  size = 'small',
  variant = 'outlined'
}) => {
  return (
    <Chip
      label={getStatusLabel(status)}
      size={size}
      color={getStatusChipColor(status)}
      variant={variant}
    />
  );
});

