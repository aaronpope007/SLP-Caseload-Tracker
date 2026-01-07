import { useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  KeyboardArrowUp as KeyboardArrowUpIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import type { Goal, Student } from '../types';
import { getGoalPath } from '../utils/goalPaths';
import { GoalProgressChip } from './GoalProgressChip';

interface PerformanceDataItem {
  goalId: string;
  studentId: string;
  accuracy?: string;
  correctTrials?: number;
  incorrectTrials?: number;
  notes?: string;
  cuingLevels?: ('independent' | 'verbal' | 'visual' | 'tactile' | 'physical')[];
}

interface ActiveGoalsTrackingPanelProps {
  goals: Goal[];
  students: Student[];
  goalsTargeted: string[];
  performanceData: PerformanceDataItem[];
  focusedGoalId: string | null;
  getRecentPerformance: (goalId: string, studentId: string) => number | null;
  onGoalFocus: (goalId: string | null) => void;
  onGoalToggle: (goalId: string, studentId: string) => void;
  onTrialUpdate: (goalId: string, studentId: string, isCorrect: boolean) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const ActiveGoalsTrackingPanel = ({
  goals,
  students,
  goalsTargeted,
  performanceData,
  focusedGoalId,
  getRecentPerformance,
  onGoalFocus,
  onGoalToggle,
  onTrialUpdate,
  collapsed = false,
  onToggleCollapse,
}: ActiveGoalsTrackingPanelProps) => {
  // Get all active goals with their data
  const activeGoals = useMemo(() => {
    return goalsTargeted.map(goalId => {
      const goal = goals.find(g => g.id === goalId);
      if (!goal) return null;
      
      const student = students.find(s => s.id === goal.studentId);
      const perfData = performanceData.find(p => p.goalId === goalId && p.studentId === goal.studentId);
      const recentAvg = getRecentPerformance(goalId, goal.studentId);
      
      return {
        goal,
        student: student || null,
        perfData: perfData || { goalId, studentId: goal.studentId, correctTrials: 0, incorrectTrials: 0 },
        recentAvg,
        path: getGoalPath(goal, goals),
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  }, [goals, students, goalsTargeted, performanceData, getRecentPerformance]);

  if (activeGoals.length === 0) {
    return null;
  }

  const totalTrials = activeGoals.reduce((sum, item) => {
    const correct = item.perfData.correctTrials || 0;
    const incorrect = item.perfData.incorrectTrials || 0;
    return sum + correct + incorrect;
  }, 0);

  return (
    <Paper
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        mb: 2,
        border: '2px solid',
        borderColor: focusedGoalId ? 'primary.main' : 'divider',
        boxShadow: 3,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1.5,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          cursor: onToggleCollapse ? 'pointer' : 'default',
        }}
        onClick={onToggleCollapse}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            Active Goals ({activeGoals.length})
          </Typography>
          {totalTrials > 0 && (
            <Chip
              label={`${totalTrials} total trials`}
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit' }}
            />
          )}
          {focusedGoalId && (
            <Chip
              label="Focused"
              size="small"
              color="secondary"
              sx={{ bgcolor: 'rgba(255,255,255,0.3)' }}
            />
          )}
        </Box>
        {onToggleCollapse && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            sx={{ color: 'inherit' }}
          >
            {collapsed ? <KeyboardArrowDownIcon /> : <KeyboardArrowUpIcon />}
          </IconButton>
        )}
      </Box>

      {!collapsed && (
        <Box sx={{ p: 1.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {activeGoals.map(({ goal, student, perfData, recentAvg, path }) => {
              const isFocused = focusedGoalId === goal.id;
              const correctTrials = perfData.correctTrials || 0;
              const incorrectTrials = perfData.incorrectTrials || 0;
              const total = correctTrials + incorrectTrials;
              const accuracy = total > 0 ? Math.round((correctTrials / total) * 100) : 0;

              return (
                <Paper
                  key={goal.id}
                  sx={{
                    p: 1.5,
                    border: '2px solid',
                    borderColor: isFocused ? 'primary.main' : 'divider',
                    bgcolor: isFocused ? 'action.selected' : 'background.paper',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                  onClick={() => onGoalFocus(isFocused ? null : goal.id)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: isFocused ? 'bold' : 'normal',
                            fontSize: '0.875rem',
                          }}
                        >
                          {student?.name || 'Unknown'}
                        </Typography>
                        <Chip
                          label={goal.description}
                          size="small"
                          color={isFocused ? 'primary' : 'default'}
                          sx={{ maxWidth: '100%' }}
                        />
                        {path !== goal.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                            {path}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          label={`✓ ${correctTrials}`}
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                        <Chip
                          label={`✗ ${incorrectTrials}`}
                          size="small"
                          color="error"
                          variant="outlined"
                        />
                        {total > 0 && (
                          <Chip
                            label={`${accuracy}%`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        <GoalProgressChip average={recentAvg} target={goal.target} />
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Tooltip title="Quick log: + for correct, - for incorrect">
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton
                            size="small"
                            color="success"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTrialUpdate(goal.id, goal.studentId, true);
                            }}
                            sx={{ border: '1px solid', borderColor: 'success.main' }}
                          >
                            +
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTrialUpdate(goal.id, goal.studentId, false);
                            }}
                            sx={{ border: '1px solid', borderColor: 'error.main' }}
                          >
                            -
                          </IconButton>
                        </Box>
                      </Tooltip>
                      <Tooltip title="Remove from tracking">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onGoalToggle(goal.id, goal.studentId);
                            if (focusedGoalId === goal.id) {
                              onGoalFocus(null);
                            }
                          }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Paper>
              );
            })}
          </Box>
          {focusedGoalId && (
            <Box sx={{ mt: 1.5, p: 1, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                💡 Keyboard shortcuts (+, -, 1-5) will log trials for the focused goal above
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
};

