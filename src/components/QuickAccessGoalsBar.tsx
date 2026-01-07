import { useMemo, memo } from 'react';
import {
  Box,
  Chip,
  Typography,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Pin as PinIcon,
  PinOutlined as PinOutlinedIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import type { Goal, Student } from '../types';
import { getGoalPath } from '../utils/goalPaths';

interface QuickAccessGoalsBarProps {
  goals: Goal[];
  students: Student[];
  selectedStudentIds: string[];
  goalsTargeted: string[];
  pinnedGoalIds: Set<string>;
  onGoalToggle: (goalId: string, studentId: string) => void;
  onPinToggle: (goalId: string) => void;
  onClearPinned: () => void;
  getRecentPerformance: (goalId: string, studentId: string) => number | null;
  onGoalFocus?: (goalId: string | null) => void;
}

export const QuickAccessGoalsBar = memo(({
  goals,
  students,
  selectedStudentIds,
  goalsTargeted,
  pinnedGoalIds,
  onGoalToggle,
  onPinToggle,
  onClearPinned,
  getRecentPerformance,
  onGoalFocus,
}: QuickAccessGoalsBarProps) => {
  // Get pinned goals for selected students
  const pinnedGoals = useMemo(() => {
    const selectedStudents = students.filter(s => selectedStudentIds.includes(s.id));
    const result: Array<{ goal: Goal; studentId: string; studentName: string }> = [];
    
    selectedStudents.forEach(student => {
      const studentGoals = goals.filter(g => 
        g.studentId === student.id && pinnedGoalIds.has(g.id)
      );
      studentGoals.forEach(goal => {
        result.push({ goal, studentId: student.id, studentName: student.name });
      });
    });
    
    return result;
  }, [goals, students, selectedStudentIds, pinnedGoalIds]);

  // Get recently used goals (goals that are currently targeted)
  const recentGoals = useMemo(() => {
    const selectedStudents = students.filter(s => selectedStudentIds.includes(s.id));
    const result: Array<{ goal: Goal; studentId: string; studentName: string }> = [];
    
    selectedStudents.forEach(student => {
      const studentGoals = goals.filter(g => 
        g.studentId === student.id && 
        goalsTargeted.includes(g.id) &&
        !pinnedGoalIds.has(g.id) // Don't duplicate pinned goals
      );
      studentGoals.forEach(goal => {
        result.push({ goal, studentId: student.id, studentName: student.name });
      });
    });
    
    return result.slice(0, 10); // Limit to 10 most recent
  }, [goals, students, selectedStudentIds, goalsTargeted, pinnedGoalIds]);

  if (pinnedGoals.length === 0 && recentGoals.length === 0) {
    return null;
  }

  return (
    <Paper sx={{ p: 1.5, mb: 2, bgcolor: 'action.hover' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
          Quick Access Goals
        </Typography>
        {pinnedGoals.length > 0 && (
          <Tooltip title="Clear all pinned goals">
            <IconButton size="small" onClick={onClearPinned}>
              <ClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {pinnedGoals.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Pinned:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {pinnedGoals.map(({ goal, studentId, studentName }) => {
                const isSelected = goalsTargeted.includes(goal.id);
                const recentAvg = getRecentPerformance(goal.id, studentId);
                return (
                  <Chip
                    key={`${studentId}-${goal.id}`}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PinIcon sx={{ fontSize: '0.875rem' }} />
                        <Typography variant="caption" sx={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {studentName}: {goal.description}
                        </Typography>
                        {recentAvg !== null && (
                          <Typography variant="caption" color="text.secondary">
                            ({recentAvg}%)
                          </Typography>
                        )}
                      </Box>
                    }
                    onClick={() => {
                      onGoalToggle(goal.id, studentId);
                      // Focus the goal if it's being selected (not deselected)
                      if (!isSelected && onGoalFocus) {
                        onGoalFocus(goal.id);
                      }
                    }}
                    onDelete={(e) => {
                      e.stopPropagation();
                      onPinToggle(goal.id);
                    }}
                    color={isSelected ? 'primary' : 'default'}
                    variant={isSelected ? 'filled' : 'outlined'}
                    size="small"
                    sx={{ maxWidth: '100%' }}
                  />
                );
              })}
            </Box>
          </Box>
        )}
        
        {recentGoals.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Recent:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {recentGoals.map(({ goal, studentId, studentName }) => {
                const isSelected = goalsTargeted.includes(goal.id);
                const recentAvg = getRecentPerformance(goal.id, studentId);
                return (
                  <Chip
                    key={`${studentId}-${goal.id}`}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="caption" sx={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {studentName}: {goal.description}
                        </Typography>
                        {recentAvg !== null && (
                          <Typography variant="caption" color="text.secondary">
                            ({recentAvg}%)
                          </Typography>
                        )}
                      </Box>
                    }
                    onClick={() => {
                      onGoalToggle(goal.id, studentId);
                      // Focus the goal if it's being selected (not deselected)
                      if (!isSelected && onGoalFocus) {
                        onGoalFocus(goal.id);
                      }
                    }}
                    color={isSelected ? 'primary' : 'default'}
                    variant={isSelected ? 'filled' : 'outlined'}
                    size="small"
                    sx={{ maxWidth: '100%' }}
                  />
                );
              })}
            </Box>
          </Box>
        )}
      </Box>
    </Paper>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo - only re-render if relevant props change
  return prevProps.selectedStudentIds.length === nextProps.selectedStudentIds.length &&
         JSON.stringify(prevProps.selectedStudentIds) === JSON.stringify(nextProps.selectedStudentIds) &&
         JSON.stringify(prevProps.goalsTargeted) === JSON.stringify(nextProps.goalsTargeted) &&
         prevProps.goals.length === nextProps.goals.length &&
         prevProps.students.length === nextProps.students.length &&
         (prevProps.pinnedGoalIds?.size || 0) === (nextProps.pinnedGoalIds?.size || 0);
});

