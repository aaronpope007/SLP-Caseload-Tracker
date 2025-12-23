import React from 'react';
import { Box, Typography, Button, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import type { Goal } from '../types';
import { organizeGoalsHierarchy } from '../utils/goalHierarchy';
import { StatusChip } from './StatusChip';
import { PriorityChip } from './PriorityChip';
import { GoalProgressChip } from './GoalProgressChip';
import { GoalDateInfo } from './GoalDateInfo';
import { GoalActionButtons } from './GoalActionButtons';
import { AccordionExpandIcon } from './AccordionExpandIcon';

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
  depth?: number; // Track nesting depth for recursive rendering
  label?: string; // Custom label for the list (e.g., "Sub-goals", "Breakdown-sub-goals")
}

const NestedGoalItem: React.FC<{
  goal: Goal;
  allGoals: Goal[];
  hierarchy: ReturnType<typeof organizeGoalsHierarchy>;
  getRecentPerformance: (goalId: string) => { recentSessions: RecentSessionData[]; average: number | null };
  onEdit: (goal: Goal) => void;
  onDuplicate: (goal: Goal) => void;
  onAddSubGoal: (parentGoalId: string) => void;
  depth: number;
  defaultExpanded?: boolean;
}> = ({
  goal,
  allGoals,
  hierarchy,
  getRecentPerformance,
  onEdit,
  onDuplicate,
  onAddSubGoal,
  depth,
  defaultExpanded = false,
}) => {
  const recent = getRecentPerformance(goal.id);
  const subGoals = hierarchy.subGoalsByParent.get(goal.id) || [];
  const hasSubGoals = subGoals.length > 0;

  const goalContent = (
    <>
      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <StatusChip status={goal.status} />
        <GoalProgressChip average={recent.average} target={goal.target} />
        {goal.priority && <PriorityChip priority={goal.priority} />}
        <GoalActionButtons
          onEdit={() => onEdit(goal)}
          onDuplicate={() => onDuplicate(goal)}
          editTitle={`Edit ${depth > 1 ? 'sub-' : ''}goal`}
          duplicateTitle={`Duplicate ${depth > 1 ? 'sub-' : ''}goal`}
        />
      </Box>
      <GoalDateInfo
        dateCreated={goal.dateCreated}
        status={goal.status}
        dateAchieved={goal.dateAchieved}
      />
      
      {/* Recursively render nested sub-goals */}
      {hasSubGoals && (
        <SubGoalList
          subGoals={subGoals}
          allGoals={allGoals}
          getRecentPerformance={getRecentPerformance}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onAddSubGoal={onAddSubGoal}
          depth={depth + 1}
          label={`Breakdown-sub-goals (${subGoals.length})`}
        />
      )}
      
      {/* Add Sub-goal button */}
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => onAddSubGoal(goal.id)}
        sx={{ mt: 1, ml: depth > 0 ? 2 : 0 }}
        variant="outlined"
      >
        Add {depth > 0 ? 'breakdown-' : ''}sub-goal
      </Button>
    </>
  );

  return (
    <Box sx={{ mb: depth === 0 ? 2 : 1 }}>
      {hasSubGoals ? (
        <Accordion defaultExpanded={defaultExpanded}>
          <AccordionSummary expandIcon={<AccordionExpandIcon />}>
            <Typography variant="body2" sx={{ fontSize: depth > 0 ? '0.875rem' : 'inherit' }}>
              {goal.description}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {goalContent}
          </AccordionDetails>
        </Accordion>
      ) : (
        <>
          <Typography variant="body2" sx={{ fontSize: depth > 0 ? '0.875rem' : 'inherit' }}>
            {goal.description}
          </Typography>
          {goalContent}
        </>
      )}
    </Box>
  );
};

export const SubGoalList: React.FC<SubGoalListProps> = ({
  subGoals,
  allGoals,
  getRecentPerformance,
  onEdit,
  onDuplicate,
  onAddSubGoal,
  depth = 0,
  label,
}) => {
  if (subGoals.length === 0) return null;

  // Build hierarchy to find nested sub-goals
  const hierarchy = organizeGoalsHierarchy(allGoals);

  const displayLabel = label || `Sub-goals (${subGoals.length})`;

  return (
    <Box sx={{ 
      mt: depth > 0 ? 1 : 2, 
      pl: depth > 0 ? 2 : 2, 
      borderLeft: depth > 0 ? '2px solid' : '2px solid',
      borderColor: 'divider'
    }}>
      <Typography 
        variant={depth > 0 ? 'caption' : 'subtitle2'} 
        color={depth > 0 ? 'text.secondary' : 'text.primary'}
        sx={{ mb: depth > 0 ? 0.5 : 1, display: 'block' }}
      >
        {displayLabel}:
      </Typography>
      {subGoals.map(sub => (
        <NestedGoalItem
          key={sub.id}
          goal={sub}
          allGoals={allGoals}
          hierarchy={hierarchy}
          getRecentPerformance={getRecentPerformance}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onAddSubGoal={onAddSubGoal}
          depth={depth}
          defaultExpanded={depth === 0}
        />
      ))}
    </Box>
  );
};
