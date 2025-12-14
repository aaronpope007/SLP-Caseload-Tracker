import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  EventNote as EventNoteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { getStudents, getGoals, getSessions } from '../utils/storage';
import { formatDate } from '../utils/helpers';

export const Dashboard = () => {
  console.log('Dashboard component rendering');
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    activeStudents: 0,
    totalGoals: 0,
    recentSessions: 0,
  });
  const [recentStudents, setRecentStudents] = useState<any[]>([]);

  useEffect(() => {
    console.log('Dashboard useEffect running');
    const students = getStudents();
    const goals = getGoals();
    const sessions = getSessions();

    // Filter out archived students (archived is optional for backward compatibility)
    const activeStudents = students.filter(s => s.status === 'active' && s.archived !== true);
    const activeStudentIds = new Set(activeStudents.map(s => s.id));
    
    // Filter goals to only include those belonging to active (non-archived) students
    const activeGoals = goals.filter(g => 
      g.status === 'in-progress' && activeStudentIds.has(g.studentId)
    );
    
    // Filter sessions to only include those belonging to active (non-archived) students
    const activeSessions = sessions.filter(s => activeStudentIds.has(s.studentId));
    const recent = activeSessions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
    
    setStats({
      activeStudents: activeStudents.length,
      totalGoals: activeGoals.length,
      recentSessions: recent.length,
    });

    // Only include non-archived students in the map (archived is optional for backward compatibility)
    const studentMap = new Map(students.filter(s => s.archived !== true).map(s => [s.id, s]));
    setRecentStudents(
      recent
        .map(s => ({
          ...s,
          student: studentMap.get(s.studentId),
        }))
        .filter(s => s.student) // Only show sessions for non-archived students
    );
  }, []);

  const statCards = [
    {
      title: 'Active Students',
      value: stats.activeStudents,
      icon: <PeopleIcon sx={{ fontSize: 40 }} />,
      color: '#1976d2',
      action: () => navigate('/students'),
    },
    {
      title: 'Active Goals',
      value: stats.totalGoals,
      icon: <AssignmentIcon sx={{ fontSize: 40 }} />,
      color: '#2e7d32',
      action: () => navigate('/students'),
    },
    {
      title: 'Recent Sessions',
      value: stats.recentSessions,
      icon: <EventNoteIcon sx={{ fontSize: 40 }} />,
      color: '#ed6c02',
      action: () => navigate('/sessions'),
    },
  ];

  console.log('Dashboard render - stats:', stats, 'recentStudents:', recentStudents.length);
  
  return (
    <Box sx={{ backgroundColor: 'white', minHeight: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Dashboard
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/sessions')}
        >
          Log Session
        </Button>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {statCards.map((card) => (
          <Grid item xs={12} sm={6} md={4} key={card.title}>
            <Card
              sx={{
                height: '100%',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                '&:hover': { transform: 'translateY(-4px)' },
              }}
              onClick={card.action}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ color: card.color, mr: 2 }}>{card.icon}</Box>
                  <Typography variant="h3" component="div">
                    {card.value}
                  </Typography>
                </Box>
                <Typography color="text.secondary">{card.title}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/students')}
                >
                  Add New Student
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<EventNoteIcon />}
                  onClick={() => navigate('/sessions')}
                >
                  Document Session
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<AssignmentIcon />}
                  onClick={() => navigate('/ideas')}
                >
                  Generate Treatment Ideas
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Sessions
              </Typography>
              {recentStudents.length === 0 ? (
                <Typography color="text.secondary">
                  No sessions logged yet
                </Typography>
              ) : (
                <List>
                  {recentStudents.map((session) => (
                    <ListItem key={session.id}>
                      <ListItemText
                        primary={session.student?.name || 'Unknown Student'}
                        secondary={formatDate(session.date)}
                      />
                      <Chip
                        label={`${session.goalsTargeted.length} goals`}
                        size="small"
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

