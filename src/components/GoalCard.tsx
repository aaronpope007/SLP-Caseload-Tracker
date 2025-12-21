import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Typography,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import type { Goal } from '../types';
import { formatDate, getGoalProgressChipProps } from '../utils/helpers';
import { SubGoalList } from './SubGoalList';

interface GoalCardProps {
  goal: Goal;
  subGoals: Goal[];
  getRecentPerformance: (goalId: string) => { recentSessions: any[]; average: number | null };
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
  onCopyToSubGoal: (goal: Goal) => void;
  onAddSubGoal: (parentGoalId: string) => void;
  onEditSubGoal: (goal: Goal) => void;
  onDuplicateSubGoal: (goal: Goal) => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({
  goal,
  subGoals,
  getRecentPerformance,
  onEdit,
  onDelete,
  onCopyToSubGoal,
  onAddSubGoal,
  onEditSubGoal,
  onDuplicateSubGoal,
}) => {
  const recent = getRecentPerformance(goal.id);
  const chipProps = getGoalProgressChipProps(recent.average, goal.target);

  return (
    <Card sx={{ borderLeft: `4px solid ${goal.priority === 'high' ? '#f44336' : goal.priority === 'medium' ? '#ff9800' : '#4caf50'}` }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6">{goal.description}</Typography>
          <Box>
            <IconButton
              size="small"
              onClick={() => onEdit(goal)}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <Tooltip title="Copy to sub goal">
              <IconButton
                size="small"
                onClick={() => onCopyToSubGoal(goal)}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton
              size="small"
              onClick={() => onDelete(goal.id)}
              color="error"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
          <Chip
            label={goal.status}
            size="small"
            color={
              goal.status === 'achieved'
                ? 'success'
                : goal.status === 'modified' || goal.status === 'in-progress'
                ? 'warning'
                : 'default'
            }
          />
          <Chip
            label={recent.average !== null ? `${Math.round(recent.average)}%` : 'not started'}
            size="small"
            color={chipProps.color}
            variant={chipProps.variant}
          />
          {goal.priority && (
            <Chip
              label={goal.priority}
              size="small"
              color={goal.priority === 'high' ? 'error' : goal.priority === 'medium' ? 'warning' : 'success'}
              variant="outlined"
            />
          )}
          {goal.domain && (
            <Chip
              label={goal.domain}
              size="small"
              variant="outlined"
            />
          )}
        </Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Baseline: {goal.baseline}
        </Typography>
        {recent.recentSessions.length > 0 && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Recent: {recent.average !== null 
              ? `${Math.round(recent.average)}% (avg of ${recent.recentSessions.length} sessions)`
              : recent.recentSessions.map(s => `${Math.round(s.accuracy || 0)}%`).join(', ')
            }
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Target: {goal.target}
        </Typography>
        <SubGoalList
          subGoals={subGoals}
          getRecentPerformance={getRecentPerformance}
          onEdit={onEditSubGoal}
          onDuplicate={onDuplicateSubGoal}
        />
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => onAddSubGoal(goal.id)}
          sx={{ mt: 1 }}
        >
          Add Sub-goal
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Created: {formatDate(goal.dateCreated)}
          {goal.status === 'achieved' && goal.dateAchieved && (
            <>
              <br />
              Achieved: {formatDate(goal.dateAchieved)}
            </>
          )}
        </Typography>
      </CardContent>
    </Card>
  );
};

