import React, { memo } from 'react';
import { Typography } from '@mui/material';
import { formatDate } from '../../utils/helpers';

interface GoalDateInfoProps {
  dateCreated: string;
  status: 'in-progress' | 'achieved' | 'modified';
  dateAchieved?: string;
}

export const GoalDateInfo: React.FC<GoalDateInfoProps> = memo(({
  dateCreated,
  status,
  dateAchieved,
}) => {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
      Created: {formatDate(dateCreated)}
      {status === 'achieved' && dateAchieved && (
        <>
          <br />
          Achieved: {formatDate(dateAchieved)}
        </>
      )}
    </Typography>
  );
});

