import React, { memo } from 'react';
import { Typography } from '@mui/material';
import { formatDate } from '../../utils/helpers';

interface GoalDateInfoProps {
  dateCreated: string;
  status: 'in-progress' | 'achieved' | 'modified';
  dateAchieved?: string;
  createdBy?: string;
  dateModified?: string;
  modifiedBy?: string;
}

export const GoalDateInfo: React.FC<GoalDateInfoProps> = memo(({
  dateCreated,
  status,
  dateAchieved,
  createdBy,
  dateModified,
  modifiedBy,
}) => {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
      {createdBy ? (
        <>Added by {createdBy} on {formatDate(dateCreated)}</>
      ) : (
        <>Created: {formatDate(dateCreated)}</>
      )}
      {dateModified && (
        <>
          <br />
          {modifiedBy ? (
            <>Last edited by {modifiedBy} on {formatDate(dateModified)}</>
          ) : (
            <>Last edited: {formatDate(dateModified)}</>
          )}
        </>
      )}
      {status === 'achieved' && dateAchieved && (
        <>
          <br />
          Achieved: {formatDate(dateAchieved)}
        </>
      )}
    </Typography>
  );
});

