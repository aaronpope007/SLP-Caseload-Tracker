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
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as ContentCopyIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import type { Goal } from '../types';
import { formatDate, getGoalProgressChipProps } from '../utils/helpers';
import { SubGoalList } from './SubGoalList';

interface RecentSessionData {
  date: string;
  accuracy?: number;
  correctTrials?: number;
  incorrectTrials?: number;
}

interface GoalCardProps {
  goal: Goal;
  subGoals: Goal[];
  allGoals: Goal[]; // All goals needed for hierarchy building
  getRecentPerformance: (goalId: string) => { recentSessions: RecentSessionData[]; average: number | null };
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
  allGoals,
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
  const hasSubGoals = subGoals.length > 0;

  const goalContent = (
    <>
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
        allGoals={allGoals}
        getRecentPerformance={getRecentPerformance}
        onEdit={onEditSubGoal}
        onDuplicate={onDuplicateSubGoal}
        onAddSubGoal={onAddSubGoal}
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
    </>
  );

  return (
    <Card sx={{ borderLeft: `4px solid ${goal.priority === 'high' ? '#f44336' : goal.priority === 'medium' ? '#ff9800' : '#4caf50'}` }}>
      <CardContent sx={{ p: hasSubGoals ? 0 : 2, '&:last-child': { pb: hasSubGoals ? 0 : 2 } }}>
        {hasSubGoals ? (
          <Accordion defaultExpanded={true}>
            <AccordionSummary
              expandIcon={
                <Box
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: '50%',
                    p: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'action.hover',
                  }}
                >
                  <ExpandMoreIcon sx={{ fontSize: '1.2rem' }} />
                </Box>
              }
              sx={{ px: 2, py: 1 }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 2 }}>
                <Typography variant="h6">{goal.description}</Typography>
                <Box onClick={(e) => e.stopPropagation()}>
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
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pb: 2 }}>
              {goalContent}
            </AccordionDetails>
          </Accordion>
        ) : (
          <>
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
            {goalContent}
          </>
        )}
      </CardContent>
    </Card>
  );
};

