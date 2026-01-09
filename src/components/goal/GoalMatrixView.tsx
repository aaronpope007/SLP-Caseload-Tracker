import { useMemo, useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  Checkbox,
  FormControlLabel,
  Paper,
  TextField,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Pin as PinIcon,
  PinOutlined as PinOutlinedIcon,
} from '@mui/icons-material';
import type { Goal, Student } from '../../types';
import { organizeGoalsHierarchy } from '../../utils/goalHierarchy';
import { getGoalPath } from '../../utils/goalPaths';
import { GoalProgressChip } from './GoalProgressChip';
import { PerformanceDataForm } from '../session/PerformanceDataForm';

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
  [key: string]: unknown;
}

interface GoalMatrixViewProps {
  students: Student[];
  goals: Goal[];
  goalsTargeted: string[];
  performanceData: PerformanceDataItem[];
  getRecentPerformance: (goalId: string, studentId: string) => number | null;
  onGoalToggle: (goalId: string, studentId: string) => void;
  onTrialUpdate: (goalId: string, studentId: string, isCorrect: boolean) => void;
  onPerformanceUpdate: (goalId: string, studentId: string, field: 'accuracy' | 'notes', value: string) => void;
  onCuingLevelToggle: (goalId: string, studentId: string, cuingLevel: 'independent' | 'verbal' | 'visual' | 'tactile' | 'physical') => void;
  onFormDataChange: (updater: (prev: SessionFormData) => SessionFormData) => void;
  isGoalAchieved: (goal: Goal) => boolean;
  pinnedGoalIds?: Set<string>;
  onPinToggle?: (goalId: string) => void;
}

/**
 * Matrix view for 2-student sessions: shows goals side-by-side for easy comparison and logging
 */
export const GoalMatrixView = ({
  students,
  goals,
  goalsTargeted,
  performanceData,
  getRecentPerformance,
  onGoalToggle,
  onTrialUpdate,
  onPerformanceUpdate,
  onCuingLevelToggle,
  onFormDataChange,
  isGoalAchieved,
  pinnedGoalIds,
  onPinToggle,
}: GoalMatrixViewProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

  // Only works for exactly 2 students
  if (students.length !== 2) {
    return null;
  }

  const [student1, student2] = students;

  // Get all goals for both students, organized by matching descriptions/paths
  const goalPairs = useMemo(() => {
    const student1Goals = goals.filter(g => g.studentId === student1.id && !isGoalAchieved(g));
    const student2Goals = goals.filter(g => g.studentId === student2.id && !isGoalAchieved(g));

    // Create a map of goal descriptions to goals for easier matching
    const student1Map = new Map<string, Goal[]>();
    const student2Map = new Map<string, Goal[]>();

    student1Goals.forEach(goal => {
      const key = goal.description.toLowerCase();
      if (!student1Map.has(key)) {
        student1Map.set(key, []);
      }
      student1Map.get(key)!.push(goal);
    });

    student2Goals.forEach(goal => {
      const key = goal.description.toLowerCase();
      if (!student2Map.has(key)) {
        student2Map.set(key, []);
      }
      student2Map.get(key)!.push(goal);
    });

    // Find matching goals
    const pairs: Array<{
      student1Goal: Goal | null;
      student2Goal: Goal | null;
      key: string;
    }> = [];

    const allKeys = new Set([...student1Map.keys(), ...student2Map.keys()]);
    
    allKeys.forEach(key => {
      const s1Goals = student1Map.get(key) || [];
      const s2Goals = student2Map.get(key) || [];
      
      // If both have goals with this description, create pairs
      if (s1Goals.length > 0 && s2Goals.length > 0) {
        // Match first goal from each student
        pairs.push({
          student1Goal: s1Goals[0],
          student2Goal: s2Goals[0],
          key,
        });
      } else if (s1Goals.length > 0) {
        pairs.push({
          student1Goal: s1Goals[0],
          student2Goal: null,
          key,
        });
      } else if (s2Goals.length > 0) {
        pairs.push({
          student1Goal: null,
          student2Goal: s2Goals[0],
          key,
        });
      }
    });

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return pairs.filter(pair => {
        const s1Match = pair.student1Goal?.description.toLowerCase().includes(term);
        const s2Match = pair.student2Goal?.description.toLowerCase().includes(term);
        return s1Match || s2Match;
      });
    }

    return pairs;
  }, [goals, student1, student2, isGoalAchieved, searchTerm]);

  const toggleExpanded = (key: string) => {
    setExpandedGoals(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderGoalCell = (goal: Goal | null, studentId: string, studentName: string) => {
    if (!goal) {
      return (
        <Box sx={{ p: 1, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="caption">No matching goal</Typography>
        </Box>
      );
    }

    const isSelected = goalsTargeted.includes(goal.id);
    const recentAvg = getRecentPerformance(goal.id, studentId);
    const path = getGoalPath(goal, goals);

    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={isSelected}
                onChange={() => onGoalToggle(goal.id, studentId)}
                size="small"
              />
            }
            label={
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                    {goal.description}
                  </Typography>
                  <GoalProgressChip average={recentAvg} target={goal.target} />
                </Box>
                {path !== goal.description && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    {path}
                  </Typography>
                )}
              </Box>
            }
            sx={{ flex: 1, m: 0 }}
          />
          {onPinToggle && (
            <Tooltip title={pinnedGoalIds?.has(goal.id) ? 'Unpin goal' : 'Pin goal to quick access'}>
              <IconButton
                size="small"
                onClick={() => onPinToggle(goal.id)}
                sx={{ mt: 0.5 }}
              >
                {pinnedGoalIds?.has(goal.id) ? (
                  <PinIcon fontSize="small" color="primary" />
                ) : (
                  <PinOutlinedIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          )}
        </Box>
        {isSelected && (
          <Box sx={{ ml: 4, mt: 0.5 }}>
            <PerformanceDataForm
              goalId={goal.id}
              studentId={studentId}
              performanceData={performanceData}
              isCompact={true}
              onTrialUpdate={onTrialUpdate}
              onPerformanceUpdate={onPerformanceUpdate}
              onCuingLevelToggle={onCuingLevelToggle}
              onFormDataChange={onFormDataChange}
            />
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <TextField
          placeholder="Filter goals..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ flex: 1, maxWidth: '300px' }}
        />
        <Typography variant="caption" color="text.secondary">
          {goalPairs.length} goal{goalPairs.length !== 1 ? 's' : ''} found
        </Typography>
      </Box>

      <Grid container spacing={1}>
        {/* Header */}
        <Grid item xs={6}>
          <Paper sx={{ p: 1, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              {student1.name}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6}>
          <Paper sx={{ p: 1, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              {student2.name}
            </Typography>
          </Paper>
        </Grid>

        {/* Goal pairs */}
        {goalPairs.map((pair) => {
          return (
            <Grid container item xs={12} key={pair.key} spacing={1}>
              <Grid item xs={6}>
                <Paper
                  sx={{
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    minHeight: '80px',
                  }}
                >
                  {renderGoalCell(pair.student1Goal, student1.id, student1.name)}
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper
                  sx={{
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    minHeight: '80px',
                  }}
                >
                  {renderGoalCell(pair.student2Goal, student2.id, student2.name)}
                </Paper>
              </Grid>
            </Grid>
          );
        })}

        {goalPairs.length === 0 && (
          <Grid item xs={12}>
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {searchTerm ? 'No goals match your search' : 'No matching goals found between students'}
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

