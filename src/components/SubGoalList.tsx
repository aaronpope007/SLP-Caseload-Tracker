import React from 'react';
import { Box, Typography, Chip, IconButton, Button } from '@mui/material';
import { Edit as EditIcon, ContentCopy as ContentCopyIcon, Add as AddIcon } from '@mui/icons-material';
import type { Goal } from '../types';
import { formatDate, getGoalProgressChipProps } from '../utils/helpers';
import { organizeGoalsHierarchy } from '../utils/goalHierarchy';

interface RecentSessionData {
  date: string;
  accuracy?: number;
  correctTrials?: number;
  incorrectTrials?: number;
}

interface SubGoalListProps {
  subGoals: Goal[];
  allGoals: Goal[]; // All goals needed to build hierarchy
  getRecentPerformance: (goalId: string) => { recentSessions: RecentSessionData[]; average: number | null };
  onEdit: (goal: Goal) => void;
  onDuplicate: (goal: Goal) => void;
  onAddSubGoal: (parentGoalId: string) => void;
}

export const SubGoalList: React.FC<SubGoalListProps> = ({
  subGoals,
  allGoals,
  getRecentPerformance,
  onEdit,
  onDuplicate,
  onAddSubGoal,
}) => {
  if (subGoals.length === 0) return null;

  // Build hierarchy to find sub-sub goals
  const hierarchy = organizeGoalsHierarchy(allGoals);

  return (
    <Box sx={{ mt: 2, pl: 2, borderLeft: '2px solid #e0e0e0' }}>
      <Typography variant="subtitle2" gutterBottom>
        Sub-goals ({subGoals.length}):
      </Typography>
      {subGoals.map(sub => {
        const subRecent = getRecentPerformance(sub.id);
        const subSubGoals = hierarchy.subGoalsByParent.get(sub.id) || [];
        const hasSubSubGoals = subSubGoals.length > 0;
        
        return (
          <Box key={sub.id} sx={{ mb: 2 }}>
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
            
            {/* Recursively render sub-sub goals */}
            {hasSubSubGoals && (
              <Box sx={{ mt: 1, pl: 2, borderLeft: '2px solid #e0e0e0' }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  Sub-sub-goals ({subSubGoals.length}):
                </Typography>
                {subSubGoals.map(subSub => {
                  const subSubRecent = getRecentPerformance(subSub.id);
                  return (
                    <Box key={subSub.id} sx={{ mb: 1 }}>
                      <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>{subSub.description}</Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                        <Chip 
                          label={subSub.status} 
                          size="small"
                          color={
                            subSub.status === 'achieved'
                              ? 'success'
                              : subSub.status === 'modified' || subSub.status === 'in-progress'
                              ? 'warning'
                              : 'default'
                          }
                        />
                        {(() => {
                          const subSubChipProps = getGoalProgressChipProps(subSubRecent.average, subSub.target);
                          return (
                            <Chip
                              label={subSubRecent.average !== null ? `${Math.round(subSubRecent.average)}%` : 'not started'}
                              size="small"
                              color={subSubChipProps.color}
                              variant={subSubChipProps.variant}
                            />
                          );
                        })()}
                        {subSub.priority && (
                          <Chip
                            label={subSub.priority}
                            size="small"
                            color={subSub.priority === 'high' ? 'error' : subSub.priority === 'medium' ? 'warning' : 'success'}
                            variant="outlined"
                          />
                        )}
                        <IconButton
                          size="small"
                          onClick={() => onEdit(subSub)}
                          title="Edit sub-sub-goal"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => onDuplicate(subSub)}
                          title="Duplicate sub-sub-goal"
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        Created: {formatDate(subSub.dateCreated)}
                        {subSub.status === 'achieved' && subSub.dateAchieved && (
                          <>
                            <br />
                            Achieved: {formatDate(subSub.dateAchieved)}
                          </>
                        )}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            )}
            
            {/* Add Sub-sub-goal button */}
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => onAddSubGoal(sub.id)}
              sx={{ mt: 1, ml: 2 }}
              variant="outlined"
            >
              Add breakdown-sub-goal
            </Button>
          </Box>
        );
      })}
    </Box>
  );
};

