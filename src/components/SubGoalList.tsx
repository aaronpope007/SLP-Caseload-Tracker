import React from 'react';
import { Box, Typography, Chip, IconButton } from '@mui/material';
import { Edit as EditIcon, ContentCopy as ContentCopyIcon } from '@mui/icons-material';
import type { Goal } from '../types';
import { formatDate, getGoalProgressChipProps } from '../utils/helpers';

interface SubGoalListProps {
  subGoals: Goal[];
  getRecentPerformance: (goalId: string) => { recentSessions: any[]; average: number | null };
  onEdit: (goal: Goal) => void;
  onDuplicate: (goal: Goal) => void;
}

export const SubGoalList: React.FC<SubGoalListProps> = ({
  subGoals,
  getRecentPerformance,
  onEdit,
  onDuplicate,
}) => {
  if (subGoals.length === 0) return null;

  return (
    <Box sx={{ mt: 2, pl: 2, borderLeft: '2px solid #e0e0e0' }}>
      <Typography variant="subtitle2" gutterBottom>
        Sub-goals ({subGoals.length}):
      </Typography>
      {subGoals.map(sub => {
        const subRecent = getRecentPerformance(sub.id);
        return (
          <Box key={sub.id} sx={{ mb: 1 }}>
            <Typography variant="body2">{sub.description}</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
              <Chip 
                label={sub.status} 
                size="small"
                color={
                  sub.status === 'achieved'
                    ? 'success'
                    : sub.status === 'modified' || sub.status === 'in-progress'
                    ? 'warning'
                    : 'default'
                }
              />
              {(() => {
                const subChipProps = getGoalProgressChipProps(subRecent.average, sub.target);
                return (
                  <Chip
                    label={subRecent.average !== null ? `${Math.round(subRecent.average)}%` : 'not started'}
                    size="small"
                    color={subChipProps.color}
                    variant={subChipProps.variant}
                  />
                );
              })()}
              {sub.priority && (
                <Chip
                  label={sub.priority}
                  size="small"
                  color={sub.priority === 'high' ? 'error' : sub.priority === 'medium' ? 'warning' : 'success'}
                  variant="outlined"
                />
              )}
              <IconButton
                size="small"
                onClick={() => onEdit(sub)}
                title="Edit sub-goal"
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => onDuplicate(sub)}
                title="Duplicate sub-goal"
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Created: {formatDate(sub.dateCreated)}
              {sub.status === 'achieved' && sub.dateAchieved && (
                <>
                  <br />
                  Achieved: {formatDate(sub.dateAchieved)}
                </>
              )}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

