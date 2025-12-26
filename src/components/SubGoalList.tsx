import React from 'react';
import { Box, Typography, Button, Accordion, AccordionSummary, AccordionDetails, Chip } from '@mui/material';
import { Add as AddIcon, FlashOn as FlashOnIcon } from '@mui/icons-material';
import type { Goal } from '../types';
import { organizeGoalsHierarchy } from '../utils/goalHierarchy';
import { StatusChip } from './StatusChip';
import { PriorityChip } from './PriorityChip';
import { GoalProgressChip } from './GoalProgressChip';
import { GoalDateInfo } from './GoalDateInfo';
import { GoalActionButtons } from './GoalActionButtons';
import { AccordionExpandIcon } from './AccordionExpandIcon';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

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
  onCopySubtree?: (goal: Goal) => void;
  onDelete?: (goalId: string) => void;
  onAddSubGoal: (parentGoalId: string) => void;
  onQuickSubGoal?: (parentGoalId: string) => void; // Optional callback for quick subgoal creation
  depth?: number; // Track nesting depth for recursive rendering
  label?: string; // Custom label for the list (e.g., "Sub-goals", "Breakdown-sub-goals")
  expandedSubGoals?: Set<string>;
  onSubGoalExpandedChange?: (goalId: string, expanded: boolean) => void;
}

const NestedGoalItem: React.FC<{
  goal: Goal;
  allGoals: Goal[];
  hierarchy: ReturnType<typeof organizeGoalsHierarchy>;
  getRecentPerformance: (goalId: string) => { recentSessions: RecentSessionData[]; average: number | null };
  onEdit: (goal: Goal) => void;
  onDuplicate: (goal: Goal) => void;
  onCopySubtree?: (goal: Goal) => void;
  onDelete?: (goalId: string) => void;
  onAddSubGoal: (parentGoalId: string) => void;
  onQuickSubGoal?: (parentGoalId: string) => void;
  depth: number;
  expanded?: boolean;
  onExpandedChange?: (goalId: string, expanded: boolean) => void;
  expandedSubGoals?: Set<string>;
  onSubGoalExpandedChange?: (goalId: string, expanded: boolean) => void;
}> = ({
  goal,
  allGoals,
  hierarchy,
  getRecentPerformance,
  onEdit,
  onDuplicate,
  onCopySubtree,
  onDelete,
  onAddSubGoal,
  onQuickSubGoal,
  depth,
  expanded = false,
  onExpandedChange,
  expandedSubGoals = new Set(),
  onSubGoalExpandedChange,
}) => {
  const recent = getRecentPerformance(goal.id);
  const subGoals = hierarchy.subGoalsByParent.get(goal.id) || [];
  const hasSubGoals = subGoals.length > 0;

  const goalContent = (
    <>
      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
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
        <GoalActionButtons
          onEdit={() => onEdit(goal)}
          onDuplicate={() => onDuplicate(goal)}
          onCopySubtree={onCopySubtree ? () => onCopySubtree(goal) : undefined}
          onDelete={onDelete ? () => onDelete(goal.id) : undefined}
          editTitle={`Edit ${depth > 1 ? 'sub-' : ''}goal`}
          duplicateTitle={`Duplicate ${depth > 1 ? 'sub-' : ''}goal`}
          copySubtreeTitle={`Copy ${depth > 1 ? 'sub-' : ''}goal subtree`}
          deleteTitle={`Delete ${depth > 1 ? 'sub-' : ''}goal`}
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
          onCopySubtree={onCopySubtree}
          onDelete={onDelete}
          onAddSubGoal={onAddSubGoal}
          onQuickSubGoal={onQuickSubGoal}
          depth={depth + 1}
          label={`Breakdown-sub-goals (${subGoals.length})`}
          expandedSubGoals={expandedSubGoals}
          onSubGoalExpandedChange={onSubGoalExpandedChange}
        />
      )}
      
      {/* Add Sub-goal and Quick Sub-goal buttons */}
      <Box sx={{ display: 'flex', gap: 1, mt: 1, ml: depth > 0 ? 2 : 0, flexWrap: 'wrap' }}>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => {
            // Automatically expand this goal when adding a sub-goal so the new sub-goal is visible
            if (onExpandedChange && !expanded) {
              onExpandedChange(goal.id, true);
            }
            onAddSubGoal(goal.id);
          }}
          variant="outlined"
        >
          Add {depth > 0 ? 'breakdown-' : ''}sub-goal
        </Button>
        {onQuickSubGoal && (
          <Button
            size="small"
            startIcon={<FlashOnIcon />}
            onClick={() => {
              // Automatically expand this goal when adding a quick sub-goal so the new sub-goal is visible
              if (onExpandedChange && !expanded) {
                onExpandedChange(goal.id, true);
              }
              onQuickSubGoal(goal.id);
            }}
            variant="outlined"
          >
            Quick {depth > 0 ? 'breakdown-' : ''}sub-goal
          </Button>
        )}
      </Box>
    </>
  );

  // Always use accordion if goal has sub-goals (all levels)
  const useAccordion = hasSubGoals;

  return (
    <Box 
      sx={{ 
        mb: depth === 0 ? 2 : 1,
        position: 'relative',
        zIndex: 1,
      }} 
      key={`goal-wrapper-${goal.id}`}
    >
      {useAccordion ? (
        <Accordion 
          key={`accordion-${goal.id}`}
          expanded={expanded}
          onChange={(_, isExpanded) => {
            // For nested accordions (depth >= 2), handle expansion manually via onClick on AccordionSummary
            // The Accordion's onChange might not fire properly for deeply nested accordions
            if (depth < 2 && onExpandedChange) {
              onExpandedChange(goal.id, isExpanded);
            }
          }}
          sx={{
            boxShadow: 'none',
            '&:before': {
              display: 'none',
            },
          }}
        >
          <AccordionSummary 
            expandIcon={depth >= 2 ? <ExpandMoreIcon /> : <AccordionExpandIcon />}
            onClick={(e) => {
              // Manual click handler for nested accordions (depth >= 2) to ensure expansion works
              if (depth >= 2 && onExpandedChange) {
                // Use setTimeout to ensure state update happens after event propagation
                setTimeout(() => {
                  onExpandedChange(goal.id, !expanded);
                }, 0);
              }
            }}
          >
            <Typography variant="body2" sx={{ fontSize: depth > 0 ? '0.875rem' : 'inherit' }}>
              {goal.description}
            </Typography>
          </AccordionSummary>
          <AccordionDetails 
            sx={{ 
              pt: 1,
              '& .MuiAccordion-root': {
                boxShadow: 'none',
              },
            }}
          >
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
  onCopySubtree,
  onDelete,
  onAddSubGoal,
  onQuickSubGoal,
  depth = 0,
  label,
  expandedSubGoals = new Set(),
  onSubGoalExpandedChange,
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
          onCopySubtree={onCopySubtree}
          onDelete={onDelete}
          onAddSubGoal={onAddSubGoal}
          onQuickSubGoal={onQuickSubGoal}
          depth={depth}
          expanded={expandedSubGoals.has(sub.id)}
          onExpandedChange={onSubGoalExpandedChange}
          expandedSubGoals={expandedSubGoals}
          onSubGoalExpandedChange={onSubGoalExpandedChange}
        />
      ))}
    </Box>
  );
};
