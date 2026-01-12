import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormGroup,
  FormControlLabel,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  ExpandMore as ExpandMoreIcon,
  Delete as DeleteIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
} from '@mui/icons-material';
import type { Student, Goal, Session } from '../../types';
import { formatDate, formatTime, toLocalDateTimeString, fromLocalDateTimeString } from '../../utils/helpers';
import { StudentSelector } from '../student/StudentSelector';
import { ServiceTypeSelector } from './ServiceTypeSelector';
import { GoalHierarchy } from '../goal/GoalHierarchy';
import { organizeGoalsHierarchy } from '../../utils/goalHierarchy';
import { COMMON_SUBJECTIVE_STATEMENTS } from '../../utils/soapNoteGenerator';
import { EmailTeacherDialog } from '../EmailTeacherDialog';
import { Email as EmailIcon } from '@mui/icons-material';
import { GoalSearchBar } from '../goal/GoalSearchBar';
import { QuickAccessGoalsBar } from '../goal/QuickAccessGoalsBar';
import { GoalMatrixView } from '../goal/GoalMatrixView';
import { ActiveGoalsTrackingPanel } from '../goal/ActiveGoalsTrackingPanel';
import { usePinnedGoals } from '../../hooks/usePinnedGoals';
import { PreviousSessionGoals } from './PreviousSessionGoals';

export interface SessionFormData {
  studentIds: string[];
  date: string;
  endTime: string;
  goalsTargeted: string[];
  activitiesUsed: string[];
  performanceData: {
    goalId: string;
    studentId: string;
    accuracy?: string;
    correctTrials?: number;
    incorrectTrials?: number;
    notes?: string;
    cuingLevels?: ('independent' | 'verbal' | 'visual' | 'tactile' | 'physical')[];
  }[];
  notes: string;
  isDirectServices: boolean;
  indirectServicesNotes: string;
  missedSession: boolean;
  selectedSubjectiveStatements: string[];
  customSubjective: string;
  plan: string;
}

interface SessionFormDialogProps {
  open: boolean;
  editingSession: Session | null;
  editingGroupSessionId: string | null;
  students: Student[];
  goals: Goal[];
  sessions: Session[];
  formData: SessionFormData;
  studentSearch: string;
  isDirty: () => boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  onFormDataChange: (data: Partial<SessionFormData>) => void;
  onStudentSearchChange: (value: string) => void;
  onStudentToggle: (studentId: string) => void;
  onGoalToggle: (goalId: string, studentId: string) => void;
  onPerformanceUpdate: (goalId: string, studentId: string, field: 'accuracy' | 'notes', value: string) => void;
  onCuingLevelToggle: (goalId: string, studentId: string, cuingLevel: 'independent' | 'verbal' | 'visual' | 'tactile' | 'physical') => void;
  onTrialUpdate: (goalId: string, studentId: string, isCorrect: boolean) => void;
  getRecentPerformance: (goalId: string, studentId: string) => number | null;
  isGoalAchieved: (goal: Goal) => boolean;
}

export const SessionFormDialog = ({
  open,
  editingSession,
  editingGroupSessionId,
  students,
  goals,
  sessions,
  formData,
  studentSearch,
  isDirty,
  onClose,
  onSave,
  onDelete,
  onFormDataChange,
  onStudentSearchChange,
  onStudentToggle,
  onGoalToggle,
  onPerformanceUpdate,
  onCuingLevelToggle,
  onTrialUpdate,
  getRecentPerformance,
  isGoalAchieved,
}: SessionFormDialogProps) => {
  const [emailTeacherDialogOpen, setEmailTeacherDialogOpen] = useState(false);
  const [selectedStudentForEmail, setSelectedStudentForEmail] = useState<Student | null>(null);
  const [selectedStudentsForEmail, setSelectedStudentsForEmail] = useState<Student[]>([]);
  const [viewMode, setViewMode] = useState<'hierarchy' | 'matrix'>('hierarchy');
  const [focusedGoalId, setFocusedGoalId] = useState<string | null>(null);
  const [trackingPanelCollapsed, setTrackingPanelCollapsed] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { pinnedGoalIds, togglePin, clearPinned } = usePinnedGoals();

  // Local state for text fields to prevent re-renders on every keystroke
  const [localNotes, setLocalNotes] = useState(formData.notes);
  const [localPlan, setLocalPlan] = useState(formData.plan || '');
  const [localActivitiesUsed, setLocalActivitiesUsed] = useState(formData.activitiesUsed.join(', '));
  const [localCustomSubjective, setLocalCustomSubjective] = useState(formData.customSubjective || '');
  const [localIndirectServicesNotes, setLocalIndirectServicesNotes] = useState(formData.indirectServicesNotes);

  // Use ref for onFormDataChange to keep debounce effect stable
  const onFormDataChangeRef = useRef(onFormDataChange);
  onFormDataChangeRef.current = onFormDataChange;

  // Track last synced values to prevent sync loops
  const lastSyncedRef = useRef({
    notes: formData.notes,
    plan: formData.plan || '',
    activitiesUsed: formData.activitiesUsed.join(', '),
    customSubjective: formData.customSubjective || '',
    indirectServicesNotes: formData.indirectServicesNotes,
  });

  // Sync local state when formData changes externally (e.g., when editing a session)
  // Only update if the change came from outside (not from our own debounced sync)
  useEffect(() => {
    if (formData.notes !== lastSyncedRef.current.notes) {
      setLocalNotes(formData.notes);
      lastSyncedRef.current.notes = formData.notes;
    }
  }, [formData.notes]);
  
  useEffect(() => {
    const newPlan = formData.plan || '';
    if (newPlan !== lastSyncedRef.current.plan) {
      setLocalPlan(newPlan);
      lastSyncedRef.current.plan = newPlan;
    }
  }, [formData.plan]);
  
  useEffect(() => {
    const newActivities = formData.activitiesUsed.join(', ');
    if (newActivities !== lastSyncedRef.current.activitiesUsed) {
      setLocalActivitiesUsed(newActivities);
      lastSyncedRef.current.activitiesUsed = newActivities;
    }
  }, [formData.activitiesUsed]);
  
  useEffect(() => {
    const newCustomSubjective = formData.customSubjective || '';
    if (newCustomSubjective !== lastSyncedRef.current.customSubjective) {
      setLocalCustomSubjective(newCustomSubjective);
      lastSyncedRef.current.customSubjective = newCustomSubjective;
    }
  }, [formData.customSubjective]);
  
  useEffect(() => {
    if (formData.indirectServicesNotes !== lastSyncedRef.current.indirectServicesNotes) {
      setLocalIndirectServicesNotes(formData.indirectServicesNotes);
      lastSyncedRef.current.indirectServicesNotes = formData.indirectServicesNotes;
    }
  }, [formData.indirectServicesNotes]);

  // Single consolidated debounce effect for all text fields
  // Uses ref for onFormDataChange to prevent effect re-runs when parent provides new callback reference
  const debounceSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debounceSyncTimeoutRef.current) {
      clearTimeout(debounceSyncTimeoutRef.current);
    }
    
    debounceSyncTimeoutRef.current = setTimeout(() => {
      const updates: Partial<SessionFormData> = {};
      
      // Check and collect all changed fields
      if (localNotes !== lastSyncedRef.current.notes) {
        updates.notes = localNotes;
        lastSyncedRef.current.notes = localNotes;
      }
      
      if (localPlan !== lastSyncedRef.current.plan) {
        updates.plan = localPlan;
        lastSyncedRef.current.plan = localPlan;
      }
      
      const activities = localActivitiesUsed
        .split(',')
        .map((a) => a.trim())
        .filter((a) => a.length > 0);
      const activitiesStr = activities.join(', ');
      if (activitiesStr !== lastSyncedRef.current.activitiesUsed) {
        updates.activitiesUsed = activities;
        lastSyncedRef.current.activitiesUsed = activitiesStr;
      }
      
      if (localCustomSubjective !== lastSyncedRef.current.customSubjective) {
        updates.customSubjective = localCustomSubjective;
        lastSyncedRef.current.customSubjective = localCustomSubjective;
      }
      
      if (localIndirectServicesNotes !== lastSyncedRef.current.indirectServicesNotes) {
        updates.indirectServicesNotes = localIndirectServicesNotes;
        lastSyncedRef.current.indirectServicesNotes = localIndirectServicesNotes;
      }
      
      // Only call onFormDataChange if there are actual updates
      if (Object.keys(updates).length > 0) {
        onFormDataChangeRef.current(updates);
      }
    }, 500);
    
    return () => {
      if (debounceSyncTimeoutRef.current) {
        clearTimeout(debounceSyncTimeoutRef.current);
      }
    };
  }, [localNotes, localPlan, localActivitiesUsed, localCustomSubjective, localIndirectServicesNotes]); // Removed onFormDataChange - using ref instead

  // Helper function to format student names for the dialog title
  const formatStudentNamesForTitle = (): string => {
    if (formData.studentIds.length === 0) {
      return '';
    }
    
    const selectedStudents = formData.studentIds
      .map(id => students.find(s => s.id === id))
      .filter((s): s is Student => s !== undefined)
      .map(s => {
        const grade = s.grade != null && s.grade !== undefined && s.grade.trim() !== '' ? ` (${s.grade})` : '';
        return `${s.name}${grade}`;
      });
    
    if (selectedStudents.length === 0) {
      return '';
    }
    
    if (selectedStudents.length === 1) {
      return ` for ${selectedStudents[0]}`;
    } else if (selectedStudents.length === 2) {
      return ` for ${selectedStudents[0]} and ${selectedStudents[1]}`;
    } else {
      const allButLast = selectedStudents.slice(0, -1).join(', ');
      const last = selectedStudents[selectedStudents.length - 1];
      return ` for ${allButLast} and ${last}`;
    }
  };

  // Helper function to format scheduled time for the dialog title
  const formatScheduledTimeForTitle = (): string => {
    if (!formData.date) {
      return '';
    }
    
    const startTime = formatTime(formData.date);
    
    if (formData.endTime) {
      const endTime = formatTime(formData.endTime);
      return ` - ${startTime} - ${endTime}`;
    }
    
    return ` - ${startTime}`;
  };

  // Stable callback wrapper - uses ref to avoid dependency on formData and onFormDataChange
  // This allows child components to use updater functions without causing re-renders
  const formDataRef = useRef(formData);
  const handleFormDataChange = useCallback((
    updatesOrUpdater: Partial<SessionFormData> | ((prev: SessionFormData) => SessionFormData)
  ) => {
    if (typeof updatesOrUpdater === 'function') {
      // Apply the updater function using current ref value
      const updated = updatesOrUpdater(formDataRef.current);
      onFormDataChangeRef.current(updated);
    } else {
      // If it's a partial update, pass it through
      onFormDataChangeRef.current(updatesOrUpdater);
    }
  }, []); // No dependencies - uses refs for all external values

  // Sync all local state to parent state immediately (e.g., before save)
  const syncAllLocalState = useCallback(() => {
    const updates: Partial<SessionFormData> = {};
    
    if (localNotes !== lastSyncedRef.current.notes) {
      updates.notes = localNotes;
      lastSyncedRef.current.notes = localNotes;
    }
    if (localPlan !== lastSyncedRef.current.plan) {
      updates.plan = localPlan;
      lastSyncedRef.current.plan = localPlan;
    }
    const activities = localActivitiesUsed
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    const activitiesStr = activities.join(', ');
    if (activitiesStr !== lastSyncedRef.current.activitiesUsed) {
      updates.activitiesUsed = activities;
      lastSyncedRef.current.activitiesUsed = activitiesStr;
    }
    if (localCustomSubjective !== lastSyncedRef.current.customSubjective) {
      updates.customSubjective = localCustomSubjective;
      lastSyncedRef.current.customSubjective = localCustomSubjective;
    }
    if (localIndirectServicesNotes !== lastSyncedRef.current.indirectServicesNotes) {
      updates.indirectServicesNotes = localIndirectServicesNotes;
      lastSyncedRef.current.indirectServicesNotes = localIndirectServicesNotes;
    }
    
    if (Object.keys(updates).length > 0) {
      onFormDataChangeRef.current(updates);
    }
  }, [localNotes, localPlan, localActivitiesUsed, localCustomSubjective, localIndirectServicesNotes]); // Uses ref for onFormDataChange

  // Handle save with immediate sync
  const handleSave = useCallback(() => {
    syncAllLocalState();
    // Use setTimeout to ensure state updates are processed before save
    setTimeout(() => {
      onSave();
    }, 0);
  }, [syncAllLocalState, onSave]);

  // Check isDirty only when dialog tries to close - not continuously while typing

  // Auto-switch to matrix view for 2 students
  useEffect(() => {
    if (formData.studentIds.length === 2 && viewMode === 'hierarchy') {
      setViewMode('matrix');
    } else if (formData.studentIds.length !== 2 && viewMode === 'matrix') {
      setViewMode('hierarchy');
    }
  }, [formData.studentIds.length, viewMode]);

  // Use refs to avoid re-attaching event listeners on every formData change
  // Direct assignment in render is safe and more efficient than 6 separate useEffects
  const focusedGoalIdRef = useRef(focusedGoalId);
  const goalsRef = useRef(goals);
  const onTrialUpdateRef = useRef(onTrialUpdate);
  const handleFormDataChangeRef = useRef(handleFormDataChange);
  const setFocusedGoalIdRef = useRef(setFocusedGoalId);

  // Keep refs in sync - direct assignment in render is more efficient than 6 separate useEffects
  formDataRef.current = formData;
  focusedGoalIdRef.current = focusedGoalId;
  goalsRef.current = goals;
  onTrialUpdateRef.current = onTrialUpdate;
  handleFormDataChangeRef.current = handleFormDataChange;
  setFocusedGoalIdRef.current = setFocusedGoalId;

  // Keyboard shortcuts: / to focus search, number keys for trials
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle keyboard shortcuts if typing in any input/textarea
      // This allows "/" and other characters to be typed normally in search fields
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return; // Let the input handle all keys normally, including "/"
      }

      // Press / to focus search (only when NOT in an input field)
      if (event.key === '/') {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Get current values from refs to avoid stale closures
      const currentFormData = formDataRef.current;
      const currentFocusedGoalId = focusedGoalIdRef.current;
      const currentGoals = goalsRef.current;
      const currentOnTrialUpdate = onTrialUpdateRef.current;
      const currentHandleFormDataChange = handleFormDataChangeRef.current;
      const currentSetFocusedGoalId = setFocusedGoalIdRef.current;

      // Arrow keys for navigation and trial logging (only when there are active goals)
      if (currentFormData.goalsTargeted.length > 0) {
        // Arrow Up: Move to previous goal
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          const currentIndex = currentFocusedGoalId 
            ? currentFormData.goalsTargeted.indexOf(currentFocusedGoalId)
            : -1;
          if (currentIndex > 0) {
            currentSetFocusedGoalId(currentFormData.goalsTargeted[currentIndex - 1]);
          } else if (currentIndex === -1 && currentFormData.goalsTargeted.length > 0) {
            // If no goal is focused, focus the last one
            currentSetFocusedGoalId(currentFormData.goalsTargeted[currentFormData.goalsTargeted.length - 1]);
          }
          return;
        }

        // Arrow Down: Move to next goal
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          const currentIndex = currentFocusedGoalId 
            ? currentFormData.goalsTargeted.indexOf(currentFocusedGoalId)
            : -1;
          if (currentIndex >= 0 && currentIndex < currentFormData.goalsTargeted.length - 1) {
            currentSetFocusedGoalId(currentFormData.goalsTargeted[currentIndex + 1]);
          } else if (currentIndex === -1 && currentFormData.goalsTargeted.length > 0) {
            // If no goal is focused, focus the first one
            currentSetFocusedGoalId(currentFormData.goalsTargeted[0]);
          }
          return;
        }

        // Arrow Left: Same as + (increment correct trials)
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          const targetGoalId = currentFocusedGoalId || currentFormData.goalsTargeted[0];
          const goal = currentGoals.find(g => g.id === targetGoalId);
          if (goal) {
            let perfData = currentFormData.performanceData.find(p => p.goalId === targetGoalId && p.studentId === goal.studentId);
            if (!perfData) {
              currentHandleFormDataChange((prev) => ({
                ...prev,
                performanceData: [
                  ...prev.performanceData,
                  { goalId: targetGoalId, studentId: goal.studentId, correctTrials: 0, incorrectTrials: 0 },
                ],
              }));
              perfData = { goalId: targetGoalId, studentId: goal.studentId, correctTrials: 0, incorrectTrials: 0 };
            }
            currentOnTrialUpdate(perfData.goalId, perfData.studentId, true);
          }
          return;
        }

        // Arrow Right: Same as - (increment incorrect trials)
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          const targetGoalId = currentFocusedGoalId || currentFormData.goalsTargeted[0];
          const goal = currentGoals.find(g => g.id === targetGoalId);
          if (goal) {
            let perfData = currentFormData.performanceData.find(p => p.goalId === targetGoalId && p.studentId === goal.studentId);
            if (!perfData) {
              currentHandleFormDataChange((prev) => ({
                ...prev,
                performanceData: [
                  ...prev.performanceData,
                  { goalId: targetGoalId, studentId: goal.studentId, correctTrials: 0, incorrectTrials: 0 },
                ],
              }));
              perfData = { goalId: targetGoalId, studentId: goal.studentId, correctTrials: 0, incorrectTrials: 0 };
            }
            currentOnTrialUpdate(perfData.goalId, perfData.studentId, false);
          }
          return;
        }
      }

      // Number keys 1-5 to log correct trials (when a goal is focused or selected)
      if (event.key >= '1' && event.key <= '5' && currentFormData.goalsTargeted.length > 0) {
        const count = parseInt(event.key);
        // Use focused goal, or fall back to first selected goal
        const targetGoalId = currentFocusedGoalId || currentFormData.goalsTargeted[0];
        const goal = currentGoals.find(g => g.id === targetGoalId);
        if (goal) {
          // Ensure performance data exists
          let perfData = currentFormData.performanceData.find(p => p.goalId === targetGoalId && p.studentId === goal.studentId);
          if (!perfData) {
            // Initialize performance data if it doesn't exist
            currentHandleFormDataChange((prev) => ({
              ...prev,
              performanceData: [
                ...prev.performanceData,
                { goalId: targetGoalId, studentId: goal.studentId, correctTrials: 0, incorrectTrials: 0 },
              ],
            }));
            perfData = { goalId: targetGoalId, studentId: goal.studentId, correctTrials: 0, incorrectTrials: 0 };
          }
          for (let i = 0; i < count; i++) {
            currentOnTrialUpdate(perfData.goalId, perfData.studentId, true);
          }
        }
        return;
      }

      // + to increment, - to decrement
      if (event.key === '+' || event.key === '=') {
        const targetGoalId = currentFocusedGoalId || currentFormData.goalsTargeted[0];
        const goal = currentGoals.find(g => g.id === targetGoalId);
        if (goal) {
          let perfData = currentFormData.performanceData.find(p => p.goalId === targetGoalId && p.studentId === goal.studentId);
          if (!perfData) {
            currentHandleFormDataChange((prev) => ({
              ...prev,
              performanceData: [
                ...prev.performanceData,
                { goalId: targetGoalId, studentId: goal.studentId, correctTrials: 0, incorrectTrials: 0 },
              ],
            }));
            perfData = { goalId: targetGoalId, studentId: goal.studentId, correctTrials: 0, incorrectTrials: 0 };
          }
          currentOnTrialUpdate(perfData.goalId, perfData.studentId, true);
        }
        return;
      }

      if (event.key === '-' || event.key === '_') {
        const targetGoalId = currentFocusedGoalId || currentFormData.goalsTargeted[0];
        const goal = currentGoals.find(g => g.id === targetGoalId);
        if (goal) {
          let perfData = currentFormData.performanceData.find(p => p.goalId === targetGoalId && p.studentId === goal.studentId);
          if (!perfData) {
            currentHandleFormDataChange((prev) => ({
              ...prev,
              performanceData: [
                ...prev.performanceData,
                { goalId: targetGoalId, studentId: goal.studentId, correctTrials: 0, incorrectTrials: 0 },
              ],
            }));
            perfData = { goalId: targetGoalId, studentId: goal.studentId, correctTrials: 0, incorrectTrials: 0 };
          }
          currentOnTrialUpdate(perfData.goalId, perfData.studentId, false);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]); // Only depend on 'open' - use refs for everything else

  // Get last session's plan for the first selected student (for new sessions only, and only if plan is empty)
  // Memoized to prevent expensive recalculation on every render
  const lastSessionPlan = useMemo(() => {
    if (editingSession || editingGroupSessionId || formData.studentIds.length === 0 || (formData.plan || '').trim()) {
      return null;
    }
    
    const firstStudentId = formData.studentIds[0];
    const studentSessions = sessions
      .filter(s => s.studentId === firstStudentId && s.isDirectServices && !s.missedSession && s.plan)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return studentSessions[0]?.plan || null;
  }, [editingSession, editingGroupSessionId, formData.studentIds, formData.plan, sessions]);

  // Get goals for all selected students, grouped by student, separated into active and completed
  // Memoized to prevent expensive recalculation on every render
  const availableGoalsByStudent = useMemo(() => {
    if (formData.studentIds.length === 0) {
      return [];
    }
    
    return formData.studentIds.map(studentId => {
      const studentGoals = goals.filter((g) => g.studentId === studentId);
      const activeGoals = studentGoals.filter(g => !isGoalAchieved(g));
      const completedGoals = studentGoals.filter(g => isGoalAchieved(g));
      const hierarchy = organizeGoalsHierarchy(activeGoals);
      return {
        studentId,
        studentName: students.find(s => s.id === studentId)?.name || 'Unknown',
        goals: activeGoals,
        completedGoals: completedGoals,
        hierarchy,
      };
    });
  }, [formData.studentIds, goals, students, isGoalAchieved]);

  return (
    <Dialog 
      open={open} 
      onClose={(event, reason) => {
        // Always call onClose - the parent's handleCloseDialog will check isDirty
        // and show confirmation if needed, preventing actual close when dirty
        onClose();
      }} 
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: {
          width: '90vw',
          maxWidth: '90vw',
        },
      }}
    >
      <DialogTitle>
        {editingGroupSessionId 
          ? `Edit Group Session${formatStudentNamesForTitle()}${formatScheduledTimeForTitle()}` 
          : editingSession 
            ? `Edit Activity${formatStudentNamesForTitle()}${formatScheduledTimeForTitle()}` 
            : `Log New Activity${formatStudentNamesForTitle()}${formatScheduledTimeForTitle()}`}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <StudentSelector
            students={students}
            selectedStudentIds={formData.studentIds}
            searchTerm={studentSearch}
            onSearchChange={onStudentSearchChange}
            onStudentToggle={onStudentToggle}
            autoFocus={!editingSession && !editingGroupSessionId}
          />

          <ServiceTypeSelector
            isDirectServices={formData.isDirectServices}
            onChange={(isDirect) => handleFormDataChange({ isDirectServices: isDirect })}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Start Time"
              type="datetime-local"
              fullWidth
              value={formData.date}
              onChange={(e) => handleFormDataChange({ date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <Box sx={{ display: 'flex', gap: 1, flex: 1, alignItems: 'flex-end' }}>
              <TextField
                label="End Time"
                type="datetime-local"
                fullWidth
                value={formData.endTime}
                onChange={(e) => handleFormDataChange({ endTime: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              <Button
                variant="outlined"
                size="medium"
                startIcon={<AccessTimeIcon />}
                onClick={() => handleFormDataChange({ endTime: toLocalDateTimeString(new Date()) })}
                sx={{
                  minWidth: 'auto',
                  whiteSpace: 'nowrap',
                  mb: 0.5,
                }}
                title="Set end time to current time"
              >
                Now
              </Button>
            </Box>
          </Box>

          {formData.isDirectServices && (
            <>
              {/* Show last session's plan at the top */}
              {lastSessionPlan && formData.studentIds.length === 1 && (
                <Paper sx={{ p: 2, bgcolor: 'info.light', color: 'info.contrastText' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                      Plan from Last Session:
                    </Typography>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleFormDataChange({ plan: lastSessionPlan })}
                      sx={{ ml: 2, minWidth: 'auto' }}
                    >
                      Use This Plan
                    </Button>
                  </Box>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {lastSessionPlan}
                  </Typography>
                </Paper>
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Checkbox
                    checked={formData.missedSession}
                    onChange={(e) => handleFormDataChange({ missedSession: e.target.checked })}
                  />
                  <Typography variant="body2">Missed Session</Typography>
                </Box>
                {formData.missedSession && formData.studentIds.length > 0 && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<EmailIcon />}
                    onClick={() => {
                      const selectedStudents = students.filter(s => formData.studentIds.includes(s.id));
                      if (selectedStudents.length > 0) {
                        if (selectedStudents.length === 1) {
                          setSelectedStudentForEmail(selectedStudents[0]);
                          setSelectedStudentsForEmail([]);
                        } else {
                          setSelectedStudentForEmail(null);
                          setSelectedStudentsForEmail(selectedStudents);
                        }
                        setEmailTeacherDialogOpen(true);
                      }
                    }}
                  >
                    Email Teacher
                  </Button>
                )}
              </Box>
            </>
          )}

          {formData.isDirectServices ? (
            <>
              {formData.studentIds.length > 0 && (
                <Box>
                  {/* Previous Session Goals */}
                  {!editingSession && !editingGroupSessionId && (
                    <PreviousSessionGoals
                      students={students}
                      goals={goals}
                      sessions={sessions}
                      selectedStudentIds={formData.studentIds}
                      goalsTargeted={formData.goalsTargeted}
                      getRecentPerformance={getRecentPerformance}
                      onGoalToggle={onGoalToggle}
                      isDirectServices={formData.isDirectServices}
                    />
                  )}

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2">
                      Goals Targeted:
                    </Typography>
                    {formData.studentIds.length === 2 && (
                      <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={(_, newMode) => {
                          if (newMode) setViewMode(newMode);
                        }}
                        size="small"
                      >
                        <ToggleButton value="hierarchy">
                          <Tooltip title="Hierarchy View">
                            <ViewListIcon fontSize="small" />
                          </Tooltip>
                        </ToggleButton>
                        <ToggleButton value="matrix">
                          <Tooltip title="Matrix View (Side-by-side for 2 students)">
                            <ViewModuleIcon fontSize="small" />
                          </Tooltip>
                        </ToggleButton>
                      </ToggleButtonGroup>
                    )}
                  </Box>

                  {/* Goal Search Bar */}
                  <Box sx={{ mb: 2 }}>
                    <GoalSearchBar
                      goals={goals}
                      students={students}
                      selectedStudentIds={formData.studentIds}
                      goalsTargeted={formData.goalsTargeted}
                      onGoalSelect={onGoalToggle}
                      inputRef={searchInputRef}
                    />
                  </Box>

                  {/* Active Goals Tracking Panel */}
                  <ActiveGoalsTrackingPanel
                    goals={goals}
                    students={students}
                    goalsTargeted={formData.goalsTargeted}
                    performanceData={formData.performanceData}
                    focusedGoalId={focusedGoalId}
                    getRecentPerformance={getRecentPerformance}
                    onGoalFocus={setFocusedGoalId}
                    onGoalToggle={onGoalToggle}
                    onTrialUpdate={onTrialUpdate}
                    collapsed={trackingPanelCollapsed}
                    onToggleCollapse={() => setTrackingPanelCollapsed(!trackingPanelCollapsed)}
                  />

                  {/* Quick Access Goals Bar */}
                  <QuickAccessGoalsBar
                    goals={goals}
                    students={students}
                    selectedStudentIds={formData.studentIds}
                    goalsTargeted={formData.goalsTargeted}
                    pinnedGoalIds={pinnedGoalIds}
                    onGoalToggle={onGoalToggle}
                    onPinToggle={togglePin}
                    onClearPinned={clearPinned}
                    getRecentPerformance={getRecentPerformance}
                    onGoalFocus={setFocusedGoalId}
                  />

                  {/* Matrix View for 2 students */}
                  {viewMode === 'matrix' && formData.studentIds.length === 2 && (
                    <Box sx={{ mt: 2 }}>
                      <GoalMatrixView
                        students={students.filter(s => formData.studentIds.includes(s.id))}
                        goals={goals}
                        goalsTargeted={formData.goalsTargeted}
                        performanceData={formData.performanceData}
                        getRecentPerformance={getRecentPerformance}
                        onGoalToggle={onGoalToggle}
                        onTrialUpdate={onTrialUpdate}
                        onPerformanceUpdate={onPerformanceUpdate}
                        onCuingLevelToggle={onCuingLevelToggle}
                        onFormDataChange={handleFormDataChange}
                        isGoalAchieved={isGoalAchieved}
                        pinnedGoalIds={pinnedGoalIds}
                        onPinToggle={togglePin}
                      />
                    </Box>
                  )}

                  {/* Hierarchy View (original layout) */}
                  {viewMode === 'hierarchy' && (
                    <Box>
                  {availableGoalsByStudent.length === 0 ? (
                    <Typography color="text.secondary" variant="body2">
                      No students selected. Please select at least one student.
                    </Typography>
                  ) : availableGoalsByStudent.length === 1 ? (
                    // Single student layout (original column layout)
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                      {availableGoalsByStudent.map(({ studentId, studentName, goals: studentGoals, completedGoals, hierarchy }) => (
                        <Box key={studentId}>
                          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
                            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: 'primary.main' }}>
                              {studentName}
                            </Typography>
                            {studentGoals.length === 0 ? (
                              <Typography color="text.secondary" variant="body2">
                                No active goals found for this student. Add goals in the student's detail page.
                              </Typography>
                            ) : (
                              <GoalHierarchy
                                hierarchy={hierarchy}
                                studentId={studentId}
                                goalsTargeted={formData.goalsTargeted}
                                performanceData={formData.performanceData}
                                isCompact={false}
                                getRecentPerformance={getRecentPerformance}
                                onGoalToggle={onGoalToggle}
                                onTrialUpdate={onTrialUpdate}
                                onPerformanceUpdate={onPerformanceUpdate}
                                onCuingLevelToggle={onCuingLevelToggle}
                                onFormDataChange={handleFormDataChange}
                                pinnedGoalIds={pinnedGoalIds}
                                onPinToggle={togglePin}
                              />
                            )}
                          </Box>
                          {completedGoals.length > 0 && (
                            <Accordion sx={{ mt: 2 }}>
                              <AccordionSummary 
                                expandIcon={<ExpandMoreIcon />}
                                slotProps={{
                                  content: {
                                    component: 'div',
                                  },
                                }}
                              >
                                <Typography variant="subtitle2" component="div" color="text.secondary">
                                  Completed Goals ({completedGoals.length})
                                </Typography>
                              </AccordionSummary>
                              <AccordionDetails>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                  {completedGoals.map((goal) => (
                                    <Box key={goal.id} sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                                      <Typography variant="body2">
                                        {goal.description}
                                      </Typography>
                                      {goal.dateAchieved && (
                                        <Typography variant="caption" color="text.secondary">
                                          Achieved: {formatDate(goal.dateAchieved)}
                                        </Typography>
                                      )}
                                    </Box>
                                  ))}
                                </Box>
                              </AccordionDetails>
                            </Accordion>
                          )}
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    // Multiple students layout (side-by-side)
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      {availableGoalsByStudent.map(({ studentId, studentName, goals: studentGoals, completedGoals, hierarchy }) => (
                        <Grid item xs={12} sm={6} md={availableGoalsByStudent.length === 2 ? 6 : 4} key={studentId}>
                          <Box
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1,
                              p: 2,
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              maxHeight: '600px',
                              overflow: 'auto',
                            }}
                          >
                            <Typography
                              variant="subtitle1"
                              sx={{
                                mb: 1,
                                fontWeight: 'bold',
                                color: 'primary.main',
                                position: 'sticky',
                                top: 0,
                                bgcolor: 'background.paper',
                                pb: 1,
                                zIndex: 1,
                              }}
                            >
                              {studentName}
                            </Typography>
                            {studentGoals.length === 0 ? (
                              <Typography color="text.secondary" variant="body2">
                                No active goals found for this student. Add goals in the student's detail page.
                              </Typography>
                            ) : (
                              <GoalHierarchy
                                hierarchy={hierarchy}
                                studentId={studentId}
                                goalsTargeted={formData.goalsTargeted}
                                performanceData={formData.performanceData}
                                isCompact={true}
                                getRecentPerformance={getRecentPerformance}
                                onGoalToggle={onGoalToggle}
                                onTrialUpdate={onTrialUpdate}
                                onPerformanceUpdate={onPerformanceUpdate}
                                onCuingLevelToggle={onCuingLevelToggle}
                                onFormDataChange={handleFormDataChange}
                                pinnedGoalIds={pinnedGoalIds}
                                onPinToggle={togglePin}
                              />
                            )}
                            {completedGoals.length > 0 && (
                              <Accordion sx={{ mt: 2 }}>
                                <AccordionSummary 
                                  expandIcon={<ExpandMoreIcon />}
                                  slotProps={{
                                    content: {
                                      component: 'div',
                                    },
                                  }}
                                >
                                  <Typography variant="subtitle2" component="div" color="text.secondary">
                                    Completed Goals ({completedGoals.length})
                                  </Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {completedGoals.map((goal) => (
                                      <Box key={goal.id} sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                                        <Typography variant="body2">
                                          {goal.description}
                                        </Typography>
                                        {goal.dateAchieved && (
                                          <Typography variant="caption" color="text.secondary">
                                            Achieved: {formatDate(goal.dateAchieved)}
                                          </Typography>
                                        )}
                                      </Box>
                                    ))}
                                  </Box>
                                </AccordionDetails>
                              </Accordion>
                            )}
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                    </Box>
                  )}
                </Box>
              )}

              {formData.isDirectServices && (
                <Accordion>
                  <AccordionSummary 
                    expandIcon={<ExpandMoreIcon />}
                    slotProps={{
                      content: {
                        component: 'div',
                      },
                    }}
                  >
                    <Typography variant="subtitle2" component="div">
                      Subjective Statements (for SOAP notes) *
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        * Required: Select at least one statement or enter a custom statement
                      </Typography>
                      <FormGroup>
                        <Grid container spacing={1}>
                          {COMMON_SUBJECTIVE_STATEMENTS.map((statement) => (
                            <Grid item xs={12} sm={6} key={statement}>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={formData.selectedSubjectiveStatements.includes(statement)}
                                    onChange={(e) => {
                                      const current = formData.selectedSubjectiveStatements;
                                      const updated = e.target.checked
                                        ? [...current, statement]
                                        : current.filter(s => s !== statement);
                                      handleFormDataChange({ selectedSubjectiveStatements: updated });
                                    }}
                                    size="small"
                                  />
                                }
                                label={
                                  <Typography variant="body2">
                                    {statement}
                                  </Typography>
                                }
                              />
                            </Grid>
                          ))}
                        </Grid>
                      </FormGroup>
                      <TextField
                        label="Custom Subjective Statement"
                        fullWidth
                        value={localCustomSubjective}
                        onChange={(e) => setLocalCustomSubjective(e.target.value)}
                        onBlur={() => handleFormDataChange({ customSubjective: localCustomSubjective })}
                        placeholder="Enter your own subjective statement..."
                        error={formData.selectedSubjectiveStatements.length === 0 && localCustomSubjective.trim().length === 0}
                        helperText={formData.selectedSubjectiveStatements.length === 0 && localCustomSubjective.trim().length === 0 ? "Required: Select a statement above or enter a custom statement" : ""}
                      />
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )}

              <TextField
                label="Activities Used (comma-separated)"
                fullWidth
                value={localActivitiesUsed}
                onChange={(e) => setLocalActivitiesUsed(e.target.value)}
                onBlur={() =>
                  handleFormDataChange({
                    activitiesUsed: localActivitiesUsed
                      .split(',')
                      .map((a) => a.trim())
                      .filter((a) => a.length > 0),
                  })
                }
              />

              <TextField
                label="Session Notes"
                fullWidth
                multiline
                rows={4}
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                onBlur={() => handleFormDataChange({ notes: localNotes })}
              />

              <TextField
                label="Plan for Next Session *"
                fullWidth
                multiline
                rows={4}
                value={localPlan}
                onChange={(e) => setLocalPlan(e.target.value)}
                onBlur={() => handleFormDataChange({ plan: localPlan })}
                placeholder="Enter the plan for the next session..."
                required
                error={!localPlan.trim()}
                helperText={!localPlan.trim() ? "Required: Enter a plan for the next session" : ""}
              />
            </>
          ) : (
            <TextField
              label="Indirect Services Notes"
              fullWidth
              multiline
              rows={6}
              value={localIndirectServicesNotes}
              onChange={(e) => setLocalIndirectServicesNotes(e.target.value)}
              onBlur={() => handleFormDataChange({ indirectServicesNotes: localIndirectServicesNotes })}
              placeholder="Enter notes about indirect services provided..."
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        {(editingSession || editingGroupSessionId) && onDelete && (
          <Button
            onClick={onDelete}
            color="error"
            startIcon={<DeleteIcon />}
            sx={{ mr: 'auto' }}
          >
            Delete
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={formData.studentIds.length === 0}
        >
          Save
        </Button>
      </DialogActions>
      <EmailTeacherDialog
        open={emailTeacherDialogOpen}
        onClose={() => {
          setEmailTeacherDialogOpen(false);
          setSelectedStudentForEmail(null);
          setSelectedStudentsForEmail([]);
        }}
        student={selectedStudentForEmail}
        students={selectedStudentsForEmail.length > 0 ? selectedStudentsForEmail : undefined}
        sessionDate={formData.date ? formData.date.split('T')[0] : undefined}
        sessionStartTime={formData.date ? fromLocalDateTimeString(formData.date) : undefined}
        sessionEndTime={formData.endTime ? fromLocalDateTimeString(formData.endTime) : undefined}
      />
    </Dialog>
  );
};

