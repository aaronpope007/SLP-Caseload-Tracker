import { useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
} from '@mui/icons-material';
import type { Student, Goal, Session } from '../../types';

interface PreviousSessionGoalsProps {
  students: Student[];
  goals: Goal[];
  sessions: Session[];
  selectedStudentIds: string[];
  goalsTargeted: string[];
  getRecentPerformance: (goalId: string, studentId: string) => number | null;
  onGoalToggle: (goalId: string, studentId: string) => void;
  isDirectServices?: boolean;
}

interface PreviousGoalData {
  goal: Goal;
  student: Student;
  previousSessionPerformance: number | null;
  averagePerformance: number | null;
}

export const PreviousSessionGoals = ({
  students,
  goals,
  sessions,
  selectedStudentIds,
  goalsTargeted,
  getRecentPerformance,
  onGoalToggle,
  isDirectServices = true,
}: PreviousSessionGoalsProps) => {
  // Find the most recent previous session(s) for the selected students
  const previousSessionGoals = useMemo(() => {
    if (selectedStudentIds.length === 0 || !isDirectServices) {
      return [];
    }

    // Filter sessions to only direct services, non-missed sessions
    const validSessions = sessions.filter(
      s => s.isDirectServices && !s.missedSession
    );

    // Find previous sessions for each student
    const previousSessions: Session[] = [];
    
    if (selectedStudentIds.length === 1) {
      // Single student: find the most recent session for that student
      const studentId = selectedStudentIds[0];
      const studentSessions = validSessions
        .filter(s => s.studentId === studentId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      if (studentSessions.length > 0) {
        previousSessions.push(studentSessions[0]);
      }
    } else {
      // Multiple students: find the most recent group session that matches all selected students
      // Group sessions by groupSessionId
      const groupSessionsMap = new Map<string, Session[]>();
      validSessions.forEach(session => {
        if (session.groupSessionId) {
          if (!groupSessionsMap.has(session.groupSessionId)) {
            groupSessionsMap.set(session.groupSessionId, []);
          }
          groupSessionsMap.get(session.groupSessionId)!.push(session);
        }
      });

      // Find the most recent group session that includes all selected students
      const matchingGroups: { groupId: string; sessions: Session[]; date: Date }[] = [];
      
      groupSessionsMap.forEach((groupSessions, groupId) => {
        const groupStudentIds = groupSessions.map(s => s.studentId);
        const allStudentsMatch = selectedStudentIds.every(id => groupStudentIds.includes(id)) &&
                                 groupStudentIds.length === selectedStudentIds.length;
        
        if (allStudentsMatch && groupSessions.length > 0) {
          // Use the date from the first session in the group
          matchingGroups.push({
            groupId,
            sessions: groupSessions,
            date: new Date(groupSessions[0].date),
          });
        }
      });

      // Sort by date descending and take the most recent
      matchingGroups.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      if (matchingGroups.length > 0) {
        previousSessions.push(...matchingGroups[0].sessions);
      }
    }

    if (previousSessions.length === 0) {
      return [];
    }

    // Extract unique goals from previous sessions
    const goalMap = new Map<string, PreviousGoalData>();
    
    previousSessions.forEach(session => {
      (session.goalsTargeted || []).forEach(goalId => {
        const goal = goals.find(g => g.id === goalId);
        if (!goal) return;
        
        // Skip if goal is already in current session
        if (goalsTargeted.includes(goalId)) return;
        
        // Skip if goal is achieved
        if (goal.status === 'achieved') return;
        
        const student = students.find(s => s.id === goal.studentId);
        if (!student) return;
        
        // Get performance from previous session
        const perfData = session.performanceData.find(p => p.goalId === goalId);
        let previousSessionPerformance: number | null = null;
        if (perfData?.accuracy !== undefined && perfData.accuracy !== null) {
          const accuracy = typeof perfData.accuracy === 'string' ? parseFloat(perfData.accuracy) : perfData.accuracy;
          if (!isNaN(accuracy) && isFinite(accuracy)) {
            previousSessionPerformance = Math.round(accuracy);
          }
        }
        
        // Get average performance from last 3 times
        const averagePerformance = getRecentPerformance(goalId, goal.studentId);
        
        // Use goalId as key to avoid duplicates
        if (!goalMap.has(goalId)) {
          goalMap.set(goalId, {
            goal,
            student,
            previousSessionPerformance,
            averagePerformance,
          });
        }
      });
    });

    return Array.from(goalMap.values());
  }, [students, goals, sessions, selectedStudentIds, goalsTargeted, getRecentPerformance, isDirectServices]);

  if (previousSessionGoals.length === 0) {
    return null;
  }

  const handleGoalClick = (goalId: string, studentId: string) => {
    onGoalToggle(goalId, studentId);
  };

  return (
    <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
          Goals from Previous Session:
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {previousSessionGoals.map(({ goal, student, previousSessionPerformance, averagePerformance }) => {
          const chipLabel = (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                {student.name}:
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  maxWidth: '200px', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  flexShrink: 1,
                }}
              >
                {goal.description}
              </Typography>
              {previousSessionPerformance !== null && (
                <Typography variant="body2" sx={{ ml: 0.5, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                  ({previousSessionPerformance}%)
                </Typography>
              )}
              {averagePerformance !== null && (
                <Typography variant="body2" sx={{ ml: 0.5, opacity: 0.9, whiteSpace: 'nowrap' }}>
                  [Avg: {averagePerformance}%]
                </Typography>
              )}
            </Box>
          );

          return (
            <Tooltip
              key={goal.id}
              title={goal.description}
              arrow
              placement="top"
            >
              <Chip
                label={chipLabel}
                onClick={() => handleGoalClick(goal.id, student.id)}
                icon={<AddIcon />}
                sx={{
                  bgcolor: 'background.paper',
                  color: 'text.primary',
                  '&:hover': {
                    bgcolor: 'action.hover',
                    cursor: 'pointer',
                  },
                }}
              />
            </Tooltip>
          );
        })}
      </Box>
    </Paper>
  );
};

