import React from 'react';
import { Chip } from '@mui/material';
import { getStatusChipColor } from '../utils/helpers';

interface StatusChipProps {
  status: 'in-progress' | 'achieved' | 'modified';
  size?: 'small' | 'medium';
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, size = 'small' }) => {
  return (
    <Chip
      label={status}
      size={size}
      color={getStatusChipColor(status)}
    />
  );
};

