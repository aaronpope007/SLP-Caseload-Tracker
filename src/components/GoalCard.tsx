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
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as ContentCopyIcon,
  AccountTree as AccountTreeIcon,
  FlashOn as FlashOnIcon,
} from '@mui/icons-material';
import type { Goal } from '../types';
import { getPriorityBorderColor } from '../utils/helpers';
import { SubGoalList } from './SubGoalList';
import { StatusChip } from './StatusChip';
import { PriorityChip } from './PriorityChip';
import { GoalProgressChip } from './GoalProgressChip';
import { GoalDateInfo } from './GoalDateInfo';
import { AccordionExpandIcon } from './AccordionExpandIcon';

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
  onQuickSubGoal?: (parentGoalId: string) => void;
  onEditSubGoal: (goal: Goal) => void;
  onDuplicateSubGoal: (goal: Goal) => void;
  onCopySubtree?: (goal: Goal) => void;
  expanded?: boolean;
  onExpandedChange?: (goalId: string, expanded: boolean) => void;
  expandedSubGoals?: Set<string>;
  onSubGoalExpandedChange?: (goalId: string, expanded: boolean) => void;
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
  onQuickSubGoal,
  onEditSubGoal,
  onDuplicateSubGoal,
  onCopySubtree,
  expanded = false,
  onExpandedChange,
  expandedSubGoals = new Set(),
  onSubGoalExpandedChange,
}) => {
  const theme = useTheme();
  const recent = getRecentPerformance(goal.id);
  const hasSubGoals = subGoals.length > 0;

  // Get border color from theme using priority
  const borderColor = goal.priority 
    ? theme.palette[getPriorityBorderColor(goal.priority).split('.')[0] as 'error' | 'warning' | 'success']?.main || theme.palette.divider
    : theme.palette.divider;

  const goalContent = (
    <>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
        <StatusChip status={goal.status} />
        <GoalProgressChip average={recent.average} target={goal.target} />
        {(!goal.target || goal.target.trim() === '') && (
          <Chip
            label="No target set"
            size="small"
            color="error"
            variant="outlined"
          />
        )}
        {goal.priority && <PriorityChip priority={goal.priority} />}
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
          Recent: {recent.average !== null && !isNaN(recent.average) && isFinite(recent.average)
            ? `${Math.round(recent.average)}% (avg of ${recent.recentSessions.length} sessions)`
            : recent.recentSessions.map(s => {
                const accuracy = s.accuracy ?? 0;
                const validAccuracy = !isNaN(accuracy) && isFinite(accuracy) ? accuracy : 0;
                return `${Math.round(validAccuracy)}%`;
              }).join(', ')
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
        onCopySubtree={onCopySubtree}
        onDelete={onDelete}
        onAddSubGoal={onAddSubGoal}
        onQuickSubGoal={onQuickSubGoal}
        expandedSubGoals={expandedSubGoals}
        onSubGoalExpandedChange={onSubGoalExpandedChange}
      />
      <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => onAddSubGoal(goal.id)}
          variant="outlined"
        >
          Add Sub-goal
        </Button>
        {onQuickSubGoal && (
          <Button
            size="small"
            startIcon={<FlashOnIcon />}
            onClick={() => onQuickSubGoal(goal.id)}
            variant="outlined"
          >
            Quick Sub-goal
          </Button>
        )}
      </Box>
      <GoalDateInfo
        dateCreated={goal.dateCreated}
        status={goal.status}
        dateAchieved={goal.dateAchieved}
      />
    </>
  );

  const actionButtons = (
    <Box onClick={(e) => e.stopPropagation()}>
      <IconButton
        size="small"
        onClick={() => onEdit(goal)}
        title="Edit goal"
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
      {onCopySubtree && (
        <Tooltip title="Copy subtree">
          <IconButton
            size="small"
            onClick={() => onCopySubtree(goal)}
            color="primary"
          >
            <AccountTreeIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <IconButton
        size="small"
        onClick={() => onDelete(goal.id)}
        color="error"
        title="Delete goal"
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );

  return (
    <Card sx={{ borderLeft: `4px solid ${borderColor}` }}>
      <CardContent sx={{ p: hasSubGoals ? 0 : 2, '&:last-child': { pb: hasSubGoals ? 0 : 2 } }}>
        {hasSubGoals ? (
          <Accordion 
            expanded={expanded}
            onChange={(_, isExpanded) => onExpandedChange?.(goal.id, isExpanded)}
          >
            <AccordionSummary 
              expandIcon={<AccordionExpandIcon />} 
              slotProps={{
                content: {
                  component: 'div',
                },
              }}
              sx={{ px: 2, py: 1 }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 2 }}>
                <Typography variant="h6">{goal.description}</Typography>
                {actionButtons}
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
              {actionButtons}
            </Box>
            {goalContent}
          </>
        )}
      </CardContent>
    </Card>
  );
};
