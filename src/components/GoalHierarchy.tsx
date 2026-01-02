import {
  Box,
  Checkbox,
  FormControlLabel,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import type { Goal } from '../types';
import { GoalProgressChip } from './GoalProgressChip';
import { PerformanceDataForm } from './PerformanceDataForm';

interface PerformanceDataItem {
  goalId: string;
  studentId: string;
  accuracy?: string;
  correctTrials?: number;
  incorrectTrials?: number;
  notes?: string;
  cuingLevels?: ('independent' | 'verbal' | 'visual' | 'tactile' | 'physical')[];
}

interface SessionFormData {
  performanceData: PerformanceDataItem[];
  [key: string]: unknown; // Allow other fields in the form data
}

interface GoalHierarchyProps {
  hierarchy: {
    parentGoals: Goal[];
    subGoalsByParent: Map<string, Goal[]>;
    orphanGoals: Goal[];
  };
  studentId: string;
  goalsTargeted: string[];
  performanceData: PerformanceDataItem[];
  isCompact?: boolean;
  getRecentPerformance: (goalId: string, studentId: string) => number | null;
  onGoalToggle: (goalId: string, studentId: string) => void;
  onTrialUpdate: (goalId: string, studentId: string, isCorrect: boolean) => void;
  onPerformanceUpdate: (goalId: string, studentId: string, field: 'accuracy' | 'notes', value: string) => void;
  onCuingLevelToggle: (goalId: string, studentId: string, cuingLevel: 'independent' | 'verbal' | 'visual' | 'tactile' | 'physical') => void;
  onFormDataChange: (updater: (prev: SessionFormData) => SessionFormData) => void;
}

export const GoalHierarchy = ({
  hierarchy,
  studentId,
  goalsTargeted,
  performanceData,
  isCompact = false,
  getRecentPerformance,
  onGoalToggle,
  onTrialUpdate,
  onPerformanceUpdate,
  onCuingLevelToggle,
  onFormDataChange,
}: GoalHierarchyProps) => {
  const { parentGoals, subGoalsByParent, orphanGoals } = hierarchy;

  // Recursive function to render a goal and all its nested sub-goals
  const renderGoalWithChildren = (goal: Goal, depth: number = 0): JSX.Element => {
    const subGoals = subGoalsByParent.get(goal.id) || [];
    const hasSubGoals = subGoals.length > 0;
    const recentAvg = getRecentPerformance(goal.id, studentId);
    
    // Calculate indentation based on depth (each level adds 2 units of padding)
    const paddingLeft = depth * 2;
    const borderLeftWidth = depth > 0 ? '2px solid' : 'none';
    
    return (
      <Box key={goal.id} sx={{ pl: paddingLeft, borderLeft: borderLeftWidth, borderColor: 'divider' }}>
        {hasSubGoals ? (
          <Accordion defaultExpanded={false}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon />}
              slotProps={{
                content: {
                  component: 'div',
                },
              }}
            >
              <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={goalsTargeted.includes(goal.id)}
                      onChange={() => onGoalToggle(goal.id, studentId)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  }
                  label={
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Box component="span" sx={{ fontSize: isCompact ? '0.875rem' : '1rem' }}>{goal.description}</Box>
                      <GoalProgressChip average={recentAvg} target={goal.target} />
                      {(!goal.target || goal.target.trim() === '') && (
                        <Chip
                          label="No target set"
                          size="small"
                          color="error"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  }
                  onClick={(e) => e.stopPropagation()}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {subGoals.map((subGoal) => renderGoalWithChildren(subGoal, depth + 1))}
              </Box>
            </AccordionDetails>
          </Accordion>
        ) : (
          <FormControlLabel
            control={
              <Checkbox
                checked={goalsTargeted.includes(goal.id)}
                onChange={() => onGoalToggle(goal.id, studentId)}
              />
            }
            label={
              <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Box component="span" sx={{ fontSize: isCompact ? '0.875rem' : '1rem' }}>{goal.description}</Box>
                <GoalProgressChip average={recentAvg} target={goal.target} />
                {(!goal.target || goal.target.trim() === '') && (
                  <Chip
                    label="No target set"
                    size="small"
                    color="error"
                    variant="outlined"
                  />
                )}
              </Box>
            }
          />
        )}
        {/* Performance data for goal */}
        {goalsTargeted.includes(goal.id) && (
          <PerformanceDataForm
            goalId={goal.id}
            studentId={studentId}
            performanceData={performanceData}
            isCompact={isCompact}
            onTrialUpdate={onTrialUpdate}
            onPerformanceUpdate={onPerformanceUpdate}
            onCuingLevelToggle={onCuingLevelToggle}
            onFormDataChange={onFormDataChange}
          />
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Render parent goals with recursive sub-goal rendering */}
      {parentGoals.map((parentGoal) => renderGoalWithChildren(parentGoal, 0))}
      
      {/* Render orphan goals (goals without parent/child relationships) in accordions for consistent layout */}
      {orphanGoals.map((goal) => {
        const recentAvg = getRecentPerformance(goal.id, studentId);
        
        return (
          <Box key={goal.id}>
            <Accordion expanded={true} onChange={() => {}}>
              <AccordionSummary 
                expandIcon={null} 
                slotProps={{
                  content: {
                    component: 'div',
                  },
                }}
                sx={{ cursor: 'default', '&:hover': { backgroundColor: 'transparent' } }}
              >
                <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={goalsTargeted.includes(goal.id)}
                        onChange={() => onGoalToggle(goal.id, studentId)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    }
                    label={
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Box component="span" sx={{ fontSize: isCompact ? '0.875rem' : '1rem' }}>{goal.description}</Box>
                        <GoalProgressChip average={recentAvg} target={goal.target} />
                        {(!goal.target || goal.target.trim() === '') && (
                          <Chip
                            label="No target set"
                            size="small"
                            color="error"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                </Box>
              </AccordionSummary>
            </Accordion>
            {/* Performance data for orphan goal (outside accordion) */}
            {goalsTargeted.includes(goal.id) && (
              <PerformanceDataForm
                goalId={goal.id}
                studentId={studentId}
                performanceData={performanceData}
                isCompact={isCompact}
                onTrialUpdate={onTrialUpdate}
                onPerformanceUpdate={onPerformanceUpdate}
                onCuingLevelToggle={onCuingLevelToggle}
                onFormDataChange={onFormDataChange}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
};
