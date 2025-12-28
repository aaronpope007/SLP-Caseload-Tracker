import React, { memo } from 'react';
import { Chip } from '@mui/material';
import { getGoalProgressChipProps } from '../utils/helpers';

interface GoalProgressChipProps {
  average: number | null;
  target: string;
  size?: 'small' | 'medium';
}

export const GoalProgressChip: React.FC<GoalProgressChipProps> = memo(({
  average,
  target,
  size = 'small',
}) => {
  const chipProps = getGoalProgressChipProps(average, target);
  return (
    <Chip
      label={average !== null ? `${Math.round(average)}%` : 'not started'}
      size={size}
      color={chipProps.color}
      variant={chipProps.variant}
    />
  );
});

