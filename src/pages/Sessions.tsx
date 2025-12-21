import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  IconButton,
  Alert,
  CircularProgress,
  Radio,
  RadioGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  InputAdornment,
  Menu,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Remove as RemoveIcon,
  Psychology as PsychologyIcon,
  AccessTime as AccessTimeIcon,
  ExpandMore as ExpandMoreIcon,
  Group as GroupIcon,
  Info as InfoIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  ArrowDropDown as ArrowDropDownIcon,
  Restaurant as RestaurantIcon,
} from '@mui/icons-material';
import type { Session, Student, Goal, Lunch } from '../types';
import {
  getSessions,
  getStudents,
  getGoals,
  addSession,
  updateSession,
  deleteSession,
  getSessionsByStudent,
  addLunch,
} from '../utils/storage-api';
import { generateId, formatDate, formatDateTime, toLocalDateTimeString, fromLocalDateTimeString, getGoalProgressChipProps } from '../utils/helpers';
import { generateSessionPlan } from '../utils/gemini';
import { useSchool } from '../context/SchoolContext';

export const Sessions = () => {
  const navigate = useNavigate();
  const { selectedSchool } = useSchool();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editingGroupSessionId, setEditingGroupSessionId] = useState<string | null>(null);

  // Session Planning State
  const [sessionPlanDialogOpen, setSessionPlanDialogOpen] = useState(false);
  const [planStudentId, setPlanStudentId] = useState('');
  const [sessionPlan, setSessionPlan] = useState('');
  const [loadingSessionPlan, setLoadingSessionPlan] = useState(false);
  const [sessionPlanError, setSessionPlanError] = useState('');
  
  // Student search state
  const [studentSearch, setStudentSearch] = useState('');
  const studentSearchRef = useRef<HTMLInputElement>(null);
  
  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchorEl);
  
  // Lunch dialog state
  const [lunchDialogOpen, setLunchDialogOpen] = useState(false);
  const [lunchFormData, setLunchFormData] = useState({
    startTime: toLocalDateTimeString(new Date()),
    endTime: toLocalDateTimeString(new Date(Date.now() + 30 * 60000)), // Default 30 minutes
  });

  const [formData, setFormData] = useState({
    studentIds: [] as string[], // Changed to support multiple students
    date: toLocalDateTimeString(new Date()),
    endTime: '',
    goalsTargeted: [] as string[],
    activitiesUsed: [] as string[],
    performanceData: [] as { goalId: string; studentId: string; accuracy?: string; correctTrials?: number; incorrectTrials?: number; notes?: string }[], // Added studentId to track which student's goal
    notes: '',
    isDirectServices: true, // Default to Direct Services
    indirectServicesNotes: '',
    missedSession: false, // Whether this was a missed session (only for Direct Services)
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchool]);


  // Auto-focus student search when dialog opens for new activity
  useEffect(() => {
    if (dialogOpen && !editingSession && !editingGroupSessionId) {
      // Small delay to ensure the dialog is fully rendered
      setTimeout(() => {
        studentSearchRef.current?.focus();
      }, 100);
    }
  }, [dialogOpen, editingSession, editingGroupSessionId]);

  // Keyboard shortcuts for menu items
  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if no input/textarea is focused
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 's':
          event.preventDefault();
          setMenuAnchorEl(null);
          handleOpenDialog();
          break;
        case 'e':
          event.preventDefault();
          setMenuAnchorEl(null);
          navigate('/evaluations');
          break;
        case 'l': {
          event.preventDefault();
          setMenuAnchorEl(null);
          const now = new Date();
          const defaultEndTime = new Date(now.getTime() + 30 * 60000);
          setLunchFormData({
            startTime: toLocalDateTimeString(now),
            endTime: toLocalDateTimeString(defaultEndTime),
          });
          setLunchDialogOpen(true);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

  const loadData = async () => {
    try {
      const schoolStudents = await getStudents(selectedSchool);
      const studentIds = new Set(schoolStudents.map(s => s.id));
      const allSessions = await getSessions();
      const schoolSessions = allSessions
        .filter(s => studentIds.has(s.studentId))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSessions(schoolSessions);
      // Filter out archived students (archived is optional for backward compatibility)
      setStudents(schoolStudents.filter(s => s.archived !== true));
      const allGoals = await getGoals();
      setGoals(allGoals.filter(g => studentIds.has(g.studentId)));
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleOpenDialog = async (session?: Session, groupSessionId?: string) => {
    if (session || groupSessionId) {
      // If groupSessionId is provided, load all sessions in the group
      if (groupSessionId) {
        const allSessions = await getSessions();
        const groupSessions = allSessions.filter(s => s.groupSessionId === groupSessionId);
        
        if (groupSessions.length > 0) {
          const firstSession = groupSessions[0];
          setEditingSession(firstSession);
          setEditingGroupSessionId(groupSessionId);
          
          // Collect all student IDs from the group
          const allStudentIds = groupSessions.map(s => s.studentId);
          
          // Collect all goals targeted across all sessions (filter out achieved goals)
          const allGoalsTargeted = new Set<string>();
          groupSessions.forEach(s => {
            s.goalsTargeted.forEach(gId => {
              const goal = goals.find(g => g.id === gId);
              if (goal && !isGoalAchieved(goal)) {
                allGoalsTargeted.add(gId);
              }
            });
          });
          
          // Collect all performance data from all sessions (only for active goals)
          const activeGoalsArray = Array.from(allGoalsTargeted);
          const allPerformanceData: typeof formData.performanceData = [];
          groupSessions.forEach(s => {
            s.performanceData.forEach(p => {
              if (activeGoalsArray.includes(p.goalId)) {
                allPerformanceData.push({
                  goalId: p.goalId,
                  studentId: s.studentId,
                  accuracy: p.accuracy?.toString() || '',
                  correctTrials: p.correctTrials || 0,
                  incorrectTrials: p.incorrectTrials || 0,
                  notes: p.notes || '',
                });
              }
            });
          });
          
          // Use the first session's common data (date, endTime, activities, notes, etc.)
          const startDate = new Date(firstSession.date);
          const endDate = firstSession.endTime ? new Date(firstSession.endTime) : null;
          
          setFormData({
            studentIds: allStudentIds,
            date: toLocalDateTimeString(startDate),
            endTime: endDate ? toLocalDateTimeString(endDate) : '',
            goalsTargeted: activeGoalsArray,
            activitiesUsed: firstSession.activitiesUsed, // Use first session's activities (should be same for all)
            performanceData: allPerformanceData,
            notes: firstSession.notes, // Use first session's notes (should be same for all)
            isDirectServices: firstSession.isDirectServices === true,
            indirectServicesNotes: firstSession.indirectServicesNotes || '',
            missedSession: firstSession.missedSession || false,
          });
        }
      } else if (session) {
        // Editing a single session
        setEditingSession(session);
        setEditingGroupSessionId(null);
        const startDate = new Date(session.date);
        const endDate = session.endTime ? new Date(session.endTime) : null;
        // Filter out achieved goals when editing
        const activeGoalsTargeted = session.goalsTargeted.filter(gId => {
          const goal = goals.find(g => g.id === gId);
          return goal && !isGoalAchieved(goal);
        });
        
        setFormData({
          studentIds: [session.studentId], // Convert single student to array for editing
          date: toLocalDateTimeString(startDate),
          endTime: endDate ? toLocalDateTimeString(endDate) : '',
          goalsTargeted: activeGoalsTargeted,
          activitiesUsed: session.activitiesUsed,
          performanceData: session.performanceData
            .filter(p => activeGoalsTargeted.includes(p.goalId))
            .map(p => ({
              goalId: p.goalId,
              studentId: session.studentId, // Add studentId to performance data
              accuracy: p.accuracy?.toString() || '',
              correctTrials: p.correctTrials || 0,
              incorrectTrials: p.incorrectTrials || 0,
              notes: p.notes || '',
            })),
          notes: session.notes,
          isDirectServices: session.isDirectServices === true, // Explicitly check for true
          indirectServicesNotes: session.indirectServicesNotes || '',
          missedSession: session.missedSession || false,
        });
      }
    } else {
      // Creating a new session
      const now = new Date();
      const defaultEndTime = new Date(now.getTime() + 30 * 60000); // Default to 30 minutes later
      setEditingSession(null);
      setEditingGroupSessionId(null);
      setFormData({
        studentIds: [],
        date: toLocalDateTimeString(now),
        endTime: toLocalDateTimeString(defaultEndTime),
        goalsTargeted: [],
        activitiesUsed: [],
        performanceData: [],
        notes: '',
        isDirectServices: true,
        indirectServicesNotes: '',
        missedSession: false,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSession(null);
    setEditingGroupSessionId(null);
    setStudentSearch(''); // Reset search when dialog closes
  };

  const handleStudentToggle = (studentId: string) => {
    const isSelected = formData.studentIds.includes(studentId);
    let newStudentIds: string[];
    let newGoalsTargeted: string[] = [...formData.goalsTargeted];
    let newPerformanceData = [...formData.performanceData];

    if (isSelected) {
      // Remove student
      newStudentIds = formData.studentIds.filter(id => id !== studentId);
      // Remove goals and performance data for this student
      const studentGoals = goals.filter(g => g.studentId === studentId).map(g => g.id);
      newGoalsTargeted = formData.goalsTargeted.filter(gId => !studentGoals.includes(gId));
      newPerformanceData = formData.performanceData.filter(p => p.studentId !== studentId);
    } else {
      // Add student
      newStudentIds = [...formData.studentIds, studentId];
    }

    setFormData({
      ...formData,
      studentIds: newStudentIds,
      goalsTargeted: newGoalsTargeted,
      performanceData: newPerformanceData,
    });
  };

  const handleGoalToggle = (goalId: string, studentId: string) => {
    const isSelected = formData.goalsTargeted.includes(goalId);
    let newGoalsTargeted: string[];
    let newPerformanceData = [...formData.performanceData];

    if (isSelected) {
      newGoalsTargeted = formData.goalsTargeted.filter((id) => id !== goalId);
      newPerformanceData = newPerformanceData.filter((p) => p.goalId !== goalId || p.studentId !== studentId);
    } else {
      newGoalsTargeted = [...formData.goalsTargeted, goalId];
      newPerformanceData.push({ goalId, studentId, accuracy: '', notes: '' });
    }

    setFormData({
      ...formData,
      goalsTargeted: newGoalsTargeted,
      performanceData: newPerformanceData,
    });
  };

  const handlePerformanceUpdate = (goalId: string, studentId: string, field: 'accuracy' | 'notes', value: string) => {
    setFormData({
      ...formData,
      performanceData: formData.performanceData.map((p) =>
        p.goalId === goalId && p.studentId === studentId ? { ...p, [field]: value } : p
      ),
    });
  };

  const handleTrialUpdate = (goalId: string, studentId: string, isCorrect: boolean) => {
    setFormData({
      ...formData,
      performanceData: formData.performanceData.map((p) => {
        if (p.goalId !== goalId || p.studentId !== studentId) return p;
        const correctTrials = (p.correctTrials || 0) + (isCorrect ? 1 : 0);
        const incorrectTrials = (p.incorrectTrials || 0) + (isCorrect ? 0 : 1);
        const totalTrials = correctTrials + incorrectTrials;
        const accuracy = totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0;
        return {
          ...p,
          correctTrials,
          incorrectTrials,
          accuracy: accuracy.toString(),
        };
      }),
    });
  };

  const handleSave = async () => {
    if (formData.studentIds.length === 0) {
      alert('Please select at least one student');
      return;
    }

    try {
      // If editing a group session, update all sessions in the group
      if (editingGroupSessionId) {
        const allSessions = await getSessions();
      const existingGroupSessions = allSessions.filter(s => s.groupSessionId === editingGroupSessionId);
      
      // Determine the groupSessionId to use (preserve existing or generate new if multiple students)
      const groupSessionId = formData.studentIds.length > 1 
        ? editingGroupSessionId // Preserve existing group ID
        : undefined; // Convert to individual session if only one student
      
      // Update or create sessions for each selected student
      for (const studentId of formData.studentIds) {
        // Find existing session for this student in the group
        const existingSession = existingGroupSessions.find(s => s.studentId === studentId);
        
        // Filter goals and performance data for this student (exclude achieved goals)
        const studentGoals = goals.filter(g => g.studentId === studentId && !isGoalAchieved(g)).map(g => g.id);
        const studentGoalsTargeted = formData.goalsTargeted.filter(gId => studentGoals.includes(gId));
        const studentPerformanceData = formData.performanceData
          .filter(p => p.studentId === studentId && studentGoalsTargeted.includes(p.goalId))
          .map((p) => ({
            goalId: p.goalId,
            accuracy: p.accuracy ? parseFloat(p.accuracy) : undefined,
            correctTrials: p.correctTrials,
            incorrectTrials: p.incorrectTrials,
            notes: p.notes,
          }));

        const sessionData: Session = {
          id: existingSession ? existingSession.id : generateId(),
          studentId: studentId,
          date: fromLocalDateTimeString(formData.date),
          endTime: formData.endTime ? fromLocalDateTimeString(formData.endTime) : undefined,
          goalsTargeted: studentGoalsTargeted,
          activitiesUsed: formData.activitiesUsed,
          performanceData: studentPerformanceData,
          notes: formData.notes,
          isDirectServices: formData.isDirectServices === true,
          indirectServicesNotes: formData.indirectServicesNotes || undefined,
          groupSessionId: groupSessionId,
          missedSession: formData.isDirectServices ? (formData.missedSession || false) : undefined,
        };

        if (existingSession) {
          await updateSession(existingSession.id, sessionData);
        } else {
          await addSession(sessionData);
        }
      }
      
      // Delete sessions for students that were removed from the group
      for (const existingSession of existingGroupSessions) {
        if (!formData.studentIds.includes(existingSession.studentId)) {
          await deleteSession(existingSession.id);
        }
      }
    } else {
      // Editing a single session or creating new
      // Determine groupSessionId:
      // - If multiple students selected, generate a new one
      // - If editing a single session, preserve existing groupSessionId if it exists
      // - Otherwise, undefined (individual session)
      const isEditingSingleSession = editingSession && formData.studentIds.length === 1 && formData.studentIds[0] === editingSession.studentId;
      const groupSessionId = formData.studentIds.length > 1 
        ? generateId() 
        : (isEditingSingleSession && editingSession.groupSessionId) 
          ? editingSession.groupSessionId 
          : undefined;

      // Create a session for each selected student
      for (const studentId of formData.studentIds) {
        // Filter goals and performance data for this student (exclude achieved goals)
        const studentGoals = goals.filter(g => g.studentId === studentId && !isGoalAchieved(g)).map(g => g.id);
        const studentGoalsTargeted = formData.goalsTargeted.filter(gId => studentGoals.includes(gId));
        const studentPerformanceData = formData.performanceData
          .filter(p => p.studentId === studentId && studentGoalsTargeted.includes(p.goalId))
          .map((p) => ({
            goalId: p.goalId,
            accuracy: p.accuracy ? parseFloat(p.accuracy) : undefined,
            correctTrials: p.correctTrials,
            incorrectTrials: p.incorrectTrials,
            notes: p.notes,
          }));

        const sessionData: Session = {
          id: isEditingSingleSession
            ? editingSession.id
            : generateId(),
          studentId: studentId,
          date: fromLocalDateTimeString(formData.date),
          endTime: formData.endTime ? fromLocalDateTimeString(formData.endTime) : undefined,
          goalsTargeted: studentGoalsTargeted,
          activitiesUsed: formData.activitiesUsed,
          performanceData: studentPerformanceData,
          notes: formData.notes,
          isDirectServices: formData.isDirectServices === true, // Explicitly ensure boolean
          indirectServicesNotes: formData.indirectServicesNotes || undefined,
          groupSessionId: groupSessionId, // Link related sessions together
          missedSession: formData.isDirectServices ? (formData.missedSession || false) : undefined, // Only set for Direct Services
        };

        if (isEditingSingleSession) {
          await updateSession(editingSession.id, sessionData);
        } else {
          await addSession(sessionData);
        }
      }
    }

      await loadData();
      handleCloseDialog();
    } catch (error) {
      console.error('Failed to save session:', error);
      alert('Failed to save session. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this session?')) {
      try {
        await deleteSession(id);
        await loadData();
      } catch (error) {
        console.error('Failed to delete session:', error);
        alert('Failed to delete session. Please try again.');
      }
    }
  };

  const handleSaveLunch = async () => {
    const lunch: Lunch = {
      id: generateId(),
      school: selectedSchool,
      startTime: fromLocalDateTimeString(lunchFormData.startTime),
      endTime: fromLocalDateTimeString(lunchFormData.endTime),
      dateCreated: new Date().toISOString(),
    };
    
    await addLunch(lunch);
    setLunchDialogOpen(false);
    // Reset form
    const now = new Date();
    const defaultEndTime = new Date(now.getTime() + 30 * 60000);
    setLunchFormData({
      startTime: toLocalDateTimeString(now),
      endTime: toLocalDateTimeString(defaultEndTime),
    });
  };

  const getStudentName = (studentId: string) => {
    return students.find((s) => s.id === studentId)?.name || 'Unknown';
  };

  const getGoalDescription = (goalId: string) => {
    return goals.find((g) => g.id === goalId)?.description || 'Unknown Goal';
  };

  // Helper to get recent performance for a goal (uses sessions from state)
  const getRecentPerformance = (goalId: string, studentId: string) => {
    const goalSessions = sessions
      .filter(s => s.studentId === studentId && s.goalsTargeted.includes(goalId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);
    
    const recentData = goalSessions.map(s => {
      const perf = s.performanceData.find(p => p.goalId === goalId);
      return perf?.accuracy;
    }).filter((a): a is number => a !== undefined);

    const average = recentData.length > 0
      ? recentData.reduce((sum, a) => sum + a, 0) / recentData.length
      : null;

    return average;
  };

  // Helper function to check if a goal is achieved (either directly or if it's a subgoal with an achieved parent)
  const isGoalAchieved = (goal: Goal): boolean => {
    // Check if goal itself is achieved
    if (goal.status === 'achieved') {
      return true;
    }
    // Check if it's a subgoal with an achieved parent
    if (goal.parentGoalId) {
      const parentGoal = goals.find(g => g.id === goal.parentGoalId);
      if (parentGoal && parentGoal.status === 'achieved') {
        return true;
      }
    }
    return false;
  };

  // Get goals for all selected students, grouped by student, separated into active and completed
  const availableGoalsByStudent = formData.studentIds.length > 0
    ? formData.studentIds.map(studentId => {
        const studentGoals = goals.filter((g) => g.studentId === studentId);
        const activeGoals = studentGoals.filter(g => !isGoalAchieved(g));
        const completedGoals = studentGoals.filter(g => isGoalAchieved(g));
        return {
          studentId,
          studentName: students.find(s => s.id === studentId)?.name || 'Unknown',
          goals: activeGoals,
          completedGoals: completedGoals,
        };
      })
    : [];

  const handleGenerateSessionPlan = async () => {
    if (!planStudentId) {
      setSessionPlanError('Please select a student');
      return;
    }

    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      setSessionPlanError('Please set your Gemini API key in Settings');
      return;
    }

    const student = students.find(s => s.id === planStudentId);
    if (!student) {
      setSessionPlanError('Student not found');
      return;
    }

    const studentGoals = goals.filter(g => g.studentId === planStudentId);
    if (studentGoals.length === 0) {
      setSessionPlanError('Selected student has no goals. Please add goals first.');
      return;
    }

    setLoadingSessionPlan(true);
    setSessionPlanError('');

    try {
      const recentSessions = (await getSessionsByStudent(planStudentId))
        .slice(0, 3)
        .map(s => ({
          date: formatDateTime(s.date),
          activitiesUsed: s.activitiesUsed,
          notes: s.notes,
        }));

      const plan = await generateSessionPlan(
        apiKey,
        student.name,
        student.age,
        studentGoals.map(g => ({
          description: g.description,
          baseline: g.baseline,
          target: g.target,
        })),
        recentSessions
      );
      setSessionPlan(plan);
    } catch (err) {
      setSessionPlanError(err instanceof Error ? err.message : 'Failed to generate session plan');
    } finally {
      setLoadingSessionPlan(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h4" component="h1">
          Sessions
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<PsychologyIcon />}
            onClick={() => {
              setPlanStudentId('');
              setSessionPlan('');
              setSessionPlanError('');
              setSessionPlanDialogOpen(true);
            }}
          >
            Generate Session Plan
          </Button>
          <Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              endIcon={<ArrowDropDownIcon />}
              onClick={(e) => setMenuAnchorEl(e.currentTarget)}
            >
              Log Activity
            </Button>
            <Menu
              anchorEl={menuAnchorEl}
              open={menuOpen}
              onClose={() => setMenuAnchorEl(null)}
            >
              <MenuItem
                onClick={() => {
                  setMenuAnchorEl(null);
                  handleOpenDialog();
                }}
              >
                <AddIcon sx={{ mr: 1 }} /> Add <span style={{ textDecoration: 'underline' }}>S</span>ession
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setMenuAnchorEl(null);
                  navigate('/evaluations');
                }}
              >
                <AddIcon sx={{ mr: 1 }} /> Add <span style={{ textDecoration: 'underline' }}>E</span>valuation
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setMenuAnchorEl(null);
                  const now = new Date();
                  const defaultEndTime = new Date(now.getTime() + 30 * 60000);
                  setLunchFormData({
                    startTime: toLocalDateTimeString(now),
                    endTime: toLocalDateTimeString(defaultEndTime),
                  });
                  setLunchDialogOpen(true);
                }}
              >
                <RestaurantIcon sx={{ mr: 1 }} /> Add <span style={{ textDecoration: 'underline' }}>L</span>unch
              </MenuItem>
            </Menu>
          </Box>
        </Box>
      </Box>

      <Grid container spacing={2}>
        {sessions.length === 0 ? (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" align="center">
                  No sessions logged yet. Click "Log Activity" to get started.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (() => {
          // Group sessions by groupSessionId
          const groupedSessions = new Map<string, Session[]>();
          const individualSessions: Session[] = [];

          sessions.forEach((session) => {
            if (session.groupSessionId) {
              if (!groupedSessions.has(session.groupSessionId)) {
                groupedSessions.set(session.groupSessionId, []);
              }
              groupedSessions.get(session.groupSessionId)!.push(session);
            } else {
              individualSessions.push(session);
            }
          });

          // Create a combined array of all session entries, sorted chronologically (most recent first)
          interface SessionDisplayItem {
            type: 'group' | 'individual';
            groupSessionId?: string;
            groupSessions?: Session[];
            session?: Session;
            date: string; // For sorting
          }

          const allSessionItems: SessionDisplayItem[] = [];

          // Add group sessions (one entry per group)
          groupedSessions.forEach((groupSessions, groupSessionId) => {
            const firstSession = groupSessions[0];
            allSessionItems.push({
              type: 'group',
              groupSessionId,
              groupSessions,
              date: firstSession.date,
            });
          });

          // Add individual sessions
          individualSessions.forEach((session) => {
            allSessionItems.push({
              type: 'individual',
              session,
              date: session.date,
            });
          });

          // Sort all items by date (most recent first)
          allSessionItems.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateB - dateA; // Most recent first
          });

          // Helper function to render a single session
          const renderSession = (session: Session) => (
            <Card key={session.id} sx={{ mb: 1 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="h6">
                        {getStudentName(session.studentId)}
                      </Typography>
                      <Chip
                        label={session.isDirectServices === true ? 'Direct Services' : 'Indirect Services'}
                        size="small"
                        color={session.isDirectServices === true ? 'primary' : 'secondary'}
                      />
                    </Box>
                    <Typography color="text.secondary">
                      {formatDateTime(session.date)}
                      {session.endTime && ` - ${formatDateTime(session.endTime)}`}
                    </Typography>
                  </Box>
                  <Box>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(session)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(session.id)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Box>
                {session.isDirectServices === true ? (
                  <>
                    {session.goalsTargeted.length > 0 && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Goals Targeted:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {session.goalsTargeted.map((goalId) => (
                            <Chip
                              key={goalId}
                              label={getGoalDescription(goalId)}
                              size="small"
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                    {session.activitiesUsed.length > 0 && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Activities:
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {session.activitiesUsed.join(', ')}
                        </Typography>
                      </Box>
                    )}
                    {session.notes && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Notes:
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {session.notes}
                        </Typography>
                      </Box>
                    )}
                  </>
                ) : (
                  session.indirectServicesNotes && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Indirect Services Notes:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {session.indirectServicesNotes}
                      </Typography>
                    </Box>
                  )
                )}
              </CardContent>
            </Card>
          );

          return (
            <>
              {/* All Sessions - Group and Individual intermingled chronologically */}
              {allSessionItems.map((item) => {
                if (item.type === 'group' && item.groupSessions && item.groupSessionId) {
                  const groupSessions = item.groupSessions;
                  const firstSession = groupSessions[0];
                  const studentNames = groupSessions.map(s => getStudentName(s.studentId)).join(', ');
                  return (
                    <Grid item xs={12} key={item.groupSessionId}>
                      <Accordion defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                            <GroupIcon color="primary" />
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="h6">
                                Group Session ({groupSessions.length} {groupSessions.length === 1 ? 'student' : 'students'})
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {formatDateTime(firstSession.date)}
                                {firstSession.endTime && ` - ${formatDateTime(firstSession.endTime)}`}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Students: {studentNames}
                              </Typography>
                            </Box>
                            <Chip
                              label={firstSession.isDirectServices === true ? 'Direct Services' : 'Indirect Services'}
                              size="small"
                              color={firstSession.isDirectServices === true ? 'primary' : 'secondary'}
                              sx={{ mr: 1 }}
                            />
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDialog(undefined, item.groupSessionId);
                              }}
                              sx={{ mr: 1 }}
                            >
                              <EditIcon />
                            </IconButton>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          {groupSessions.map((session) => renderSession(session))}
                        </AccordionDetails>
                      </Accordion>
                    </Grid>
                  );
                } else if (item.type === 'individual' && item.session) {
                  return (
                    <Grid item xs={12} key={item.session.id}>
                      {renderSession(item.session)}
                    </Grid>
                  );
                }
                return null;
              })}
            </>
          );
        })()}
      </Grid>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="lg" fullWidth>
        <DialogTitle>
          {editingGroupSessionId ? 'Edit Group Session' : editingSession ? 'Edit Activity' : 'Log New Activity'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Students (select one or more):
              </Typography>
              <TextField
                inputRef={studentSearchRef}
                fullWidth
                size="small"
                placeholder="Search students..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const filteredStudents = students.filter((student) =>
                      student.name.toLowerCase().includes(studentSearch.toLowerCase())
                    );
                    if (filteredStudents.length === 1 && !formData.studentIds.includes(filteredStudents[0].id)) {
                      handleStudentToggle(filteredStudents[0].id);
                      setStudentSearch('');
                    }
                  }
                }}
                sx={{ mt: 1, mb: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: studentSearch && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setStudentSearch('')}
                        edge="end"
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: '200px', overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                {students
                  .filter((student) =>
                    student.name.toLowerCase().includes(studentSearch.toLowerCase())
                  )
                  .map((student) => (
                    <FormControlLabel
                      key={student.id}
                      control={
                        <Checkbox
                          checked={formData.studentIds.includes(student.id)}
                          onChange={() => handleStudentToggle(student.id)}
                        />
                      }
                      label={student.name}
                    />
                  ))}
                {students.filter((student) =>
                  student.name.toLowerCase().includes(studentSearch.toLowerCase())
                ).length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 1, textAlign: 'center' }}>
                    No students found
                  </Typography>
                )}
              </Box>
            </Box>

            <FormControl component="fieldset">
              <Typography variant="subtitle2" gutterBottom>
                Service Type:
              </Typography>
              <RadioGroup
                row
                value={formData.isDirectServices ? 'direct' : 'indirect'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    isDirectServices: e.target.value === 'direct',
                  })
                }
              >
                <Tooltip
                  title="MN requires that specific start and end times are listed for any direct services provided remotely for each individual session. In the notes section of your entry for the school, list the specific start and end time of each direct telehealth session, with a separate line for each entry. If doing additional duties within a timeframe of billable services, you only need to include specific start/end times for the direct telehealth duties."
                  arrow
                  placement="top"
                >
                  <FormControlLabel 
                    value="direct" 
                    control={<Radio />} 
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <span>Direct Services</span>
                        <InfoIcon sx={{ fontSize: 16, color: 'action.active' }} />
                      </Box>
                    } 
                  />
                </Tooltip>
                <Tooltip
                  title={'Any of the following activities: collaboration with teachers/staff, direct contact with the student to monitor and observe, modifying environment/items, preparation for sessions, or ordering/creation of materials for the student to support their IEP goals, setting up a therapeutic OT space for students, etc. It also includes performing documentation/record-keeping duties, including updating daily notes, scheduling, and updating caseload lists for Indigo sped director group schools. If you see a student for direct services and document "Direct/indirect services," since you did preparation and documentation, you do not need to write "Indirect services" as well. You will only write this if you do other indirect services beyond the preparation and documentation of direct services, such as fulfilling monthly minutes.'}
                  arrow
                  placement="top"
                >
                  <FormControlLabel 
                    value="indirect" 
                    control={<Radio />} 
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <span>Indirect Services</span>
                        <InfoIcon sx={{ fontSize: 16, color: 'action.active' }} />
                      </Box>
                    } 
                  />
                </Tooltip>
              </RadioGroup>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Start Time"
                type="datetime-local"
                fullWidth
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              <Box sx={{ display: 'flex', gap: 1, flex: 1, alignItems: 'flex-end' }}>
                <TextField
                  label="End Time"
                  type="datetime-local"
                  fullWidth
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
                <Button
                  variant="outlined"
                  size="medium"
                  startIcon={<AccessTimeIcon />}
                  onClick={() => setFormData({ ...formData, endTime: toLocalDateTimeString(new Date()) })}
                  sx={{ 
                    minWidth: 'auto',
                    whiteSpace: 'nowrap',
                    mb: 0.5, // Slight bottom margin to align with input baseline
                  }}
                  title="Set end time to current time"
                >
                  Now
                </Button>
              </Box>
            </Box>

            {formData.isDirectServices && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Checkbox
                  checked={formData.missedSession}
                  onChange={(e) => setFormData({ ...formData, missedSession: e.target.checked })}
                />
                <Typography variant="body2">Missed Session</Typography>
              </Box>
            )}

            {formData.isDirectServices ? (
              <>
                {formData.studentIds.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Goals Targeted (by student):
                </Typography>
                {availableGoalsByStudent.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">
                    No students selected. Please select at least one student.
                  </Typography>
                ) : availableGoalsByStudent.length === 1 ? (
                  // Single student layout (original column layout)
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    {availableGoalsByStudent.map(({ studentId, studentName, goals: studentGoals, completedGoals }) => (
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
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              {studentGoals.map((goal) => {
                                const recentAvg = getRecentPerformance(goal.id, studentId);
                                const chipProps = getGoalProgressChipProps(recentAvg, goal.target);
                                return (
                                <Box key={goal.id}>
                                  <FormControlLabel
                                    control={
                                      <Checkbox
                                        checked={formData.goalsTargeted.includes(goal.id)}
                                        onChange={() => handleGoalToggle(goal.id, studentId)}
                                      />
                                    }
                                    label={
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                        <span>{goal.description}</span>
                                        <Chip
                                          label={recentAvg !== null ? `${Math.round(recentAvg)}%` : 'not started'}
                                          size="small"
                                          color={chipProps.color}
                                          variant={chipProps.variant}
                                        />
                                      </Box>
                                    }
                                  />
                                  {formData.goalsTargeted.includes(goal.id) && (() => {
                                    const perfData = formData.performanceData.find((p) => p.goalId === goal.id && p.studentId === studentId);
                                    const correctTrials = perfData?.correctTrials || 0;
                                    const incorrectTrials = perfData?.incorrectTrials || 0;
                                    const totalTrials = correctTrials + incorrectTrials;
                                    const calculatedAccuracy = totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0;
                                    const displayText = totalTrials > 0 ? `${correctTrials}/${totalTrials} trials (${calculatedAccuracy}%)` : '0/0 trials (0%)';
                                    
                                    return (
                                      <Box sx={{ ml: 4, display: 'flex', gap: 1, mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          <IconButton
                                            size="small"
                                            onClick={() => handleTrialUpdate(goal.id, studentId, false)}
                                            color="error"
                                            sx={{ border: '1px solid', borderColor: 'error.main' }}
                                          >
                                            <RemoveIcon fontSize="small" />
                                          </IconButton>
                                          <IconButton
                                            size="small"
                                            onClick={() => handleTrialUpdate(goal.id, studentId, true)}
                                            color="success"
                                            sx={{ border: '1px solid', borderColor: 'success.main' }}
                                          >
                                            <AddIcon fontSize="small" />
                                          </IconButton>
                                          <Typography variant="body2" sx={{ ml: 1, minWidth: '140px' }}>
                                            {displayText}
                                          </Typography>
                                        </Box>
                                        <TextField
                                          label="Accuracy %"
                                          type="number"
                                          size="small"
                                          value={totalTrials > 0 ? calculatedAccuracy.toString() : (perfData?.accuracy || '')}
                                          onChange={(e) => {
                                            // When manually entering, clear trials to allow manual override
                                            setFormData({
                                              ...formData,
                                              performanceData: formData.performanceData.map((p) =>
                                                p.goalId === goal.id && p.studentId === studentId
                                                  ? { ...p, accuracy: e.target.value, correctTrials: 0, incorrectTrials: 0 }
                                                  : p
                                              ),
                                            });
                                          }}
                                          helperText={totalTrials > 0 ? 'Auto-calculated from trials (clear to enter manually)' : 'Enter manually or use +/- buttons'}
                                          sx={{ width: 140 }}
                                        />
                                        <TextField
                                          label="Notes"
                                          size="small"
                                          fullWidth
                                          value={perfData?.notes || ''}
                                          onChange={(e) =>
                                            handlePerformanceUpdate(goal.id, studentId, 'notes', e.target.value)
                                          }
                                        />
                                      </Box>
                                    );
                                  })()}
                                </Box>
                              );
                              })}
                            </Box>
                          )}
                        </Box>
                        {completedGoals.length > 0 && (
                          <Accordion sx={{ mt: 2 }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                              <Typography variant="subtitle2" color="text.secondary">
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
                    {availableGoalsByStudent.map(({ studentId, studentName, goals: studentGoals, completedGoals }) => (
                      <Grid item xs={12} sm={6} md={availableGoalsByStudent.length === 2 ? 6 : 4} key={studentId}>
                        <Box sx={{ 
                          border: '1px solid', 
                          borderColor: 'divider', 
                          borderRadius: 1, 
                          p: 2,
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          maxHeight: '600px',
                          overflow: 'auto'
                        }}>
                          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: 'primary.main', position: 'sticky', top: 0, bgcolor: 'background.paper', pb: 1, zIndex: 1 }}>
                            {studentName}
                          </Typography>
                          {studentGoals.length === 0 ? (
                            <Typography color="text.secondary" variant="body2">
                              No active goals found for this student. Add goals in the student's detail page.
                            </Typography>
                          ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              {studentGoals.map((goal) => {
                                const recentAvg = getRecentPerformance(goal.id, studentId);
                                const chipProps = getGoalProgressChipProps(recentAvg, goal.target);
                                return (
                                <Box key={goal.id}>
                                  <FormControlLabel
                                    control={
                                      <Checkbox
                                        checked={formData.goalsTargeted.includes(goal.id)}
                                        onChange={() => handleGoalToggle(goal.id, studentId)}
                                      />
                                    }
                                    label={
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                        <Typography variant="body2">{goal.description}</Typography>
                                        <Chip
                                          label={recentAvg !== null ? `${Math.round(recentAvg)}%` : 'not started'}
                                          size="small"
                                          color={chipProps.color}
                                          variant={chipProps.variant}
                                        />
                                      </Box>
                                    }
                                  />
                                  {formData.goalsTargeted.includes(goal.id) && (() => {
                                    const perfData = formData.performanceData.find((p) => p.goalId === goal.id && p.studentId === studentId);
                                    const correctTrials = perfData?.correctTrials || 0;
                                    const incorrectTrials = perfData?.incorrectTrials || 0;
                                    const totalTrials = correctTrials + incorrectTrials;
                                    const calculatedAccuracy = totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0;
                                    const displayText = totalTrials > 0 ? `${correctTrials}/${totalTrials} trials (${calculatedAccuracy}%)` : '0/0 trials (0%)';
                                    
                                    return (
                                      <Box sx={{ ml: 3, display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                                          <IconButton
                                            size="small"
                                            onClick={() => handleTrialUpdate(goal.id, studentId, false)}
                                            color="error"
                                            sx={{ border: '1px solid', borderColor: 'error.main' }}
                                          >
                                            <RemoveIcon fontSize="small" />
                                          </IconButton>
                                          <IconButton
                                            size="small"
                                            onClick={() => handleTrialUpdate(goal.id, studentId, true)}
                                            color="success"
                                            sx={{ border: '1px solid', borderColor: 'success.main' }}
                                          >
                                            <AddIcon fontSize="small" />
                                          </IconButton>
                                          <Typography variant="body2" sx={{ ml: 1, minWidth: '120px', fontSize: '0.75rem' }}>
                                            {displayText}
                                          </Typography>
                                        </Box>
                                        <TextField
                                          label="Accuracy %"
                                          type="number"
                                          size="small"
                                          value={totalTrials > 0 ? calculatedAccuracy.toString() : (perfData?.accuracy || '')}
                                          onChange={(e) => {
                                            // When manually entering, clear trials to allow manual override
                                            setFormData({
                                              ...formData,
                                              performanceData: formData.performanceData.map((p) =>
                                                p.goalId === goal.id && p.studentId === studentId
                                                  ? { ...p, accuracy: e.target.value, correctTrials: 0, incorrectTrials: 0 }
                                                  : p
                                              ),
                                            });
                                          }}
                                          helperText={totalTrials > 0 ? 'Auto-calculated' : 'Manual entry'}
                                          sx={{ width: '100%' }}
                                        />
                                        <TextField
                                          label="Notes"
                                          size="small"
                                          fullWidth
                                          multiline
                                          rows={2}
                                          value={perfData?.notes || ''}
                                          onChange={(e) =>
                                            handlePerformanceUpdate(goal.id, studentId, 'notes', e.target.value)
                                          }
                                        />
                                      </Box>
                                    );
                                  })()}
                                </Box>
                              );
                              })}
                            </Box>
                          )}
                          {completedGoals.length > 0 && (
                            <Accordion sx={{ mt: 2 }}>
                              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle2" color="text.secondary">
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

                <TextField
                  label="Activities Used (comma-separated)"
                  fullWidth
                  value={formData.activitiesUsed.join(', ')}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      activitiesUsed: e.target.value
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
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </>
            ) : (
              <TextField
                label="Indirect Services Notes"
                fullWidth
                multiline
                rows={6}
                value={formData.indirectServicesNotes}
                onChange={(e) => setFormData({ ...formData, indirectServicesNotes: e.target.value })}
                placeholder="Enter notes about indirect services provided..."
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={formData.studentIds.length === 0}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Session Plan Dialog */}
      <Dialog open={sessionPlanDialogOpen} onClose={() => setSessionPlanDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>AI Session Planning</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Student</InputLabel>
              <Select
                value={planStudentId}
                onChange={(e) => setPlanStudentId(e.target.value)}
                label="Student"
              >
                {students.map((student) => (
                  <MenuItem key={student.id} value={student.id}>
                    {student.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {sessionPlanError && (
              <Alert severity="error">{sessionPlanError}</Alert>
            )}
            <Button
              variant="contained"
              onClick={handleGenerateSessionPlan}
              disabled={loadingSessionPlan || !planStudentId}
              startIcon={loadingSessionPlan ? <CircularProgress size={20} /> : <PsychologyIcon />}
            >
              Generate Session Plan
            </Button>
            {sessionPlan && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>Generated Session Plan:</Typography>
                <Typography
                  component="div"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    p: 2,
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    maxHeight: '500px',
                    overflow: 'auto',
                  }}
                >
                  {sessionPlan}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSessionPlanDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Lunch Dialog */}
      <Dialog open={lunchDialogOpen} onClose={() => setLunchDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Lunch</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Start Time"
                type="datetime-local"
                fullWidth
                value={lunchFormData.startTime}
                onChange={(e) => setLunchFormData({ ...lunchFormData, startTime: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              <Box sx={{ display: 'flex', gap: 1, flex: 1, alignItems: 'flex-end' }}>
                <TextField
                  label="End Time"
                  type="datetime-local"
                  fullWidth
                  value={lunchFormData.endTime}
                  onChange={(e) => setLunchFormData({ ...lunchFormData, endTime: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
                <Button
                  variant="outlined"
                  size="medium"
                  startIcon={<AccessTimeIcon />}
                  onClick={() => setLunchFormData({ ...lunchFormData, endTime: toLocalDateTimeString(new Date()) })}
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLunchDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveLunch}
            variant="contained"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

