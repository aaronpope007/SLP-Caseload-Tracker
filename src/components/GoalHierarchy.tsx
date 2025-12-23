import {
  Box,
  Checkbox,
  FormControlLabel,
  Typography,
  Chip,
  IconButton,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import type { Goal } from '../types';
import { getGoalProgressChipProps } from '../utils/helpers';

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
    const chipProps = getGoalProgressChipProps(recentAvg, goal.target);
    
    // Calculate indentation based on depth (each level adds 2 units of padding)
    const paddingLeft = depth * 2;
    const borderLeftWidth = depth > 0 ? '2px solid' : 'none';
    
    return (
      <Box key={goal.id} sx={{ pl: paddingLeft, borderLeft: borderLeftWidth, borderColor: 'divider' }}>
        {hasSubGoals ? (
          <Accordion defaultExpanded={false}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant={isCompact ? 'body2' : 'body1'}>{goal.description}</Typography>
                      <Chip
                        label={recentAvg !== null ? `${Math.round(recentAvg)}%` : 'not started'}
                        size="small"
                        color={chipProps.color}
                        variant={chipProps.variant}
                      />
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant={isCompact ? 'body2' : 'body1'}>{goal.description}</Typography>
                <Chip
                  label={recentAvg !== null ? `${Math.round(recentAvg)}%` : 'not started'}
                  size="small"
                  color={chipProps.color}
                  variant={chipProps.variant}
                />
              </Box>
            }
          />
        )}
        {/* Performance data for goal */}
        {renderPerformanceData(goal)}
      </Box>
    );
  };

  // Helper function to render a single goal item (used for both parent and subgoals)
  const renderGoalItem = (goal: Goal, isSubgoal: boolean = false) => {
    const recentAvg = getRecentPerformance(goal.id, studentId);
    const chipProps = getGoalProgressChipProps(recentAvg, goal.target);
    return (
      <Box key={goal.id} sx={isSubgoal ? { pl: 2, borderLeft: '2px solid', borderColor: 'divider' } : {}}>
        <FormControlLabel
          control={
            <Checkbox
              checked={goalsTargeted.includes(goal.id)}
              onChange={() => onGoalToggle(goal.id, studentId)}
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant={isCompact ? 'body2' : 'body1'}>{goal.description}</Typography>
              <Chip
                label={recentAvg !== null ? `${Math.round(recentAvg)}%` : 'not started'}
                size="small"
                color={chipProps.color}
                variant={chipProps.variant}
              />
            </Box>
          }
        />
        {goalsTargeted.includes(goal.id) && (() => {
          const perfData = performanceData.find((p) => p.goalId === goal.id && p.studentId === studentId);
          const correctTrials = perfData?.correctTrials || 0;
          const incorrectTrials = perfData?.incorrectTrials || 0;
          const totalTrials = correctTrials + incorrectTrials;
          const calculatedAccuracy = totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0;
          const displayText = totalTrials > 0 ? `${correctTrials}/${totalTrials} trials (${calculatedAccuracy}%)` : '0/0 trials (0%)';
          
          return (
            <Box sx={{ ml: 4, display: 'flex', gap: 1, mt: 0.5, alignItems: 'center', flexWrap: 'wrap', ...(isCompact ? { flexDirection: 'column', alignItems: 'stretch' } : {}) }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                <IconButton
                  size="small"
                  onClick={() => onTrialUpdate(goal.id, studentId, false)}
                  color="error"
                  sx={{ border: '1px solid', borderColor: 'error.main' }}
                >
                  <RemoveIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => onTrialUpdate(goal.id, studentId, true)}
                  color="success"
                  sx={{ border: '1px solid', borderColor: 'success.main' }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
                <Typography variant="body2" sx={{ ml: 1, minWidth: isCompact ? '120px' : '140px', fontSize: isCompact ? '0.75rem' : 'inherit' }}>
                  {displayText}
                </Typography>
              </Box>
              <TextField
                label="Accuracy %"
                type="number"
                size="small"
                value={totalTrials > 0 ? calculatedAccuracy.toString() : (perfData?.accuracy || '')}
                onChange={(e) => {
                  onFormDataChange((prev) => ({
                    ...prev,
                    performanceData: prev.performanceData.map((p) =>
                      p.goalId === goal.id && p.studentId === studentId
                        ? { ...p, accuracy: e.target.value, correctTrials: 0, incorrectTrials: 0 }
                        : p
                    ),
                  }));
                }}
                helperText={totalTrials > 0 ? (isCompact ? 'Auto-calculated' : 'Auto-calculated from trials (clear to enter manually)') : (isCompact ? 'Manual entry' : 'Enter manually or use +/- buttons')}
                sx={{ width: isCompact ? '100%' : 140 }}
              />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: isCompact ? '100%' : 'auto' }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                  Cuing Levels:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {(['independent', 'verbal', 'visual', 'tactile', 'physical'] as const).map((level) => {
                    const cuingLevels = perfData?.cuingLevels || [];
                    const isChecked = cuingLevels.includes(level);
                    return (
                      <FormControlLabel
                        key={level}
                        control={
                          <Checkbox
                            size="small"
                            checked={isChecked}
                            onChange={() => onCuingLevelToggle(goal.id, studentId, level)}
                          />
                        }
                        label={level.charAt(0).toUpperCase() + level.slice(1)}
                      />
                    );
                  })}
                </Box>
              </Box>
              <TextField
                label="Notes"
                size="small"
                fullWidth
                multiline={isCompact}
                rows={isCompact ? 2 : 1}
                value={perfData?.notes || ''}
                onChange={(e) =>
                  onPerformanceUpdate(goal.id, studentId, 'notes', e.target.value)
                }
              />
            </Box>
          );
        })()}
      </Box>
    );
  };

  const renderPerformanceData = (goal: Goal) => {
    if (!goalsTargeted.includes(goal.id)) return null;
    
    const perfData = performanceData.find((p) => p.goalId === goal.id && p.studentId === studentId);
    const correctTrials = perfData?.correctTrials || 0;
    const incorrectTrials = perfData?.incorrectTrials || 0;
    const totalTrials = correctTrials + incorrectTrials;
    const calculatedAccuracy = totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0;
    const displayText = totalTrials > 0 ? `${correctTrials}/${totalTrials} trials (${calculatedAccuracy}%)` : '0/0 trials (0%)';
    
    return (
      <Box sx={{ ml: 4, display: 'flex', gap: 1, mt: 0.5, alignItems: 'center', flexWrap: 'wrap', mb: 1, ...(isCompact ? { flexDirection: 'column', alignItems: 'stretch' } : {}) }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => onTrialUpdate(goal.id, studentId, false)}
            color="error"
            sx={{ border: '1px solid', borderColor: 'error.main' }}
          >
            <RemoveIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => onTrialUpdate(goal.id, studentId, true)}
            color="success"
            sx={{ border: '1px solid', borderColor: 'success.main' }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
          <Typography variant="body2" sx={{ ml: 1, minWidth: isCompact ? '120px' : '140px', fontSize: isCompact ? '0.75rem' : 'inherit' }}>
            {displayText}
          </Typography>
        </Box>
        <TextField
          label="Accuracy %"
          type="number"
          size="small"
          value={totalTrials > 0 ? calculatedAccuracy.toString() : (perfData?.accuracy || '')}
          onChange={(e) => {
            onFormDataChange((prev) => ({
              ...prev,
              performanceData: prev.performanceData.map((p) =>
                p.goalId === goal.id && p.studentId === studentId
                  ? { ...p, accuracy: e.target.value, correctTrials: 0, incorrectTrials: 0 }
                  : p
              ),
            }));
          }}
          helperText={totalTrials > 0 ? (isCompact ? 'Auto-calculated' : 'Auto-calculated from trials (clear to enter manually)') : (isCompact ? 'Manual entry' : 'Enter manually or use +/- buttons')}
          sx={{ width: isCompact ? '100%' : 140 }}
        />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: isCompact ? '100%' : 'auto' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
            Cuing Levels:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {(['independent', 'verbal', 'visual', 'tactile', 'physical'] as const).map((level) => {
              const cuingLevels = perfData?.cuingLevels || [];
              const isChecked = cuingLevels.includes(level);
              return (
                <FormControlLabel
                  key={level}
                  control={
                    <Checkbox
                      size="small"
                      checked={isChecked}
                      onChange={() => onCuingLevelToggle(goal.id, studentId, level)}
                    />
                  }
                  label={level.charAt(0).toUpperCase() + level.slice(1)}
                />
              );
            })}
          </Box>
        </Box>
        <TextField
          label="Notes"
          size="small"
          fullWidth
          multiline={isCompact}
          rows={isCompact ? 2 : 1}
          value={perfData?.notes || ''}
          onChange={(e) =>
            onPerformanceUpdate(goal.id, studentId, 'notes', e.target.value)
          }
        />
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
        const chipProps = getGoalProgressChipProps(recentAvg, goal.target);
        
        return (
          <Box key={goal.id}>
            <Accordion expanded={true} onChange={() => {}}>
              <AccordionSummary expandIcon={null} sx={{ cursor: 'default', '&:hover': { backgroundColor: 'transparent' } }}>
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant={isCompact ? 'body2' : 'body1'}>{goal.description}</Typography>
                        <Chip
                          label={recentAvg !== null ? `${Math.round(recentAvg)}%` : 'not started'}
                          size="small"
                          color={chipProps.color}
                          variant={chipProps.variant}
                        />
                      </Box>
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                </Box>
              </AccordionSummary>
            </Accordion>
            {/* Performance data for orphan goal (outside accordion) */}
            {renderPerformanceData(goal)}
          </Box>
        );
      })}
    </Box>
  );
};

