import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionDialog } from '../context/SessionDialogContext';
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
  useTheme,
} from '@mui/material';
import {
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  EventNote as EventNoteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { 
  getStudents, 
  getGoals, 
  getSessions,
  getUpcomingProgressReports,
  getUpcomingDueDateItems,
} from '../utils/storage-api';
import { RemindersCard } from '../components/RemindersCard';
import { formatDate } from '../utils/helpers';
import { useSchool } from '../context/SchoolContext';
import type { Session, Student, ProgressReport, DueDateItem } from '../types';
import {
  DescriptionOutlined as DescriptionOutlinedIcon,
  Event as EventIcon,
} from '@mui/icons-material';

export const Dashboard = () => {
  console.log('Dashboard component rendering');
  const navigate = useNavigate();
  const theme = useTheme();
  const { selectedSchool } = useSchool();
  const { openAddSession } = useSessionDialog();

  const handleDocumentSession = () => {
    // Try to open the dialog, if handler isn't registered, navigate to sessions page
    const opened = openAddSession();
    if (!opened) {
      // Handler not registered (Sessions page not mounted), navigate to sessions page
      navigate('/sessions?add=true');
    }
  };
  const [stats, setStats] = useState({
    activeStudents: 0,
    totalGoals: 0,
    recentSessions: 0,
  });
  const [students, setStudents] = useState<Student[]>([]);
  const [recentStudents, setRecentStudents] = useState<(Session & { student: Student })[]>([]);
  const [upcomingReports, setUpcomingReports] = useState<ProgressReport[]>([]);
  const [upcomingItems, setUpcomingItems] = useState<DueDateItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    console.log('Dashboard useEffect running');
    setLoading(true);
    try {
      const schoolStudents = await getStudents(selectedSchool);
      setStudents(schoolStudents);
      const goals = await getGoals();
      const sessions = await getSessions();
    
    // Filter goals and sessions by school students
    const studentIds = new Set(schoolStudents.map(s => s.id));
    const schoolGoals = goals.filter(g => studentIds.has(g.studentId));
    const schoolSessions = sessions.filter(s => studentIds.has(s.studentId));

    // Filter out archived students (archived is optional for backward compatibility)
    const activeStudents = schoolStudents.filter(s => s.status === 'active' && s.archived !== true);
    const activeStudentIds = new Set(activeStudents.map(s => s.id));
    
    // Filter goals to only include those belonging to active (non-archived) students
    const activeGoals = schoolGoals.filter(g => 
      g.status === 'in-progress' && activeStudentIds.has(g.studentId)
    );
    
    // Filter sessions to only include those belonging to active (non-archived) students
    const activeSessions = schoolSessions.filter(s => activeStudentIds.has(s.studentId));
    const recent = activeSessions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
    
    setStats({
      activeStudents: activeStudents.length,
      totalGoals: activeGoals.length,
      recentSessions: recent.length,
    });

    // Only include non-archived students in the map (archived is optional for backward compatibility)
    const studentMap = new Map(schoolStudents.filter(s => s.archived !== true).map(s => [s.id, s]));
    setRecentStudents(
      recent
        .map(s => ({
          ...s,
          student: studentMap.get(s.studentId),
        }))
        .filter(s => s.student) // Only show sessions for non-archived students
    );

    // Load upcoming progress reports (next 30 days)
    const reports = await getUpcomingProgressReports(30, selectedSchool);
    setUpcomingReports(reports.slice(0, 5));

    // Load upcoming due date items (next 30 days)
    const items = await getUpcomingDueDateItems(30, selectedSchool);
    setUpcomingItems(items.slice(0, 5));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedSchool]);

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
    <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Dashboard
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleDocumentSession}
        >
          Log Activity
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
                  onClick={handleDocumentSession}
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

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6">
                  Upcoming Progress Reports
                </Typography>
                <Button size="small" onClick={() => navigate('/progress-reports')}>
                  View All
                </Button>
              </Box>
              {upcomingReports.length === 0 ? (
                <Typography color="text.secondary">
                  No upcoming reports
                </Typography>
              ) : (
                <List>
                  {upcomingReports.map((report) => {
                    const studentMap = new Map(students.filter(s => s.archived !== true).map(s => [s.id, s]));
                    const student = studentMap.get(report.studentId);
                    const isOverdue = report.status === 'overdue';
                    return (
                      <ListItem 
                        key={report.id}
                        sx={{
                          borderLeft: isOverdue ? '4px solid red' : '4px solid transparent',
                          pl: isOverdue ? 1.5 : 2,
                        }}
                      >
                        <ListItemText
                          primary={student?.name || 'Unknown Student'}
                          secondary={
                            <Box>
                              <Typography variant="caption" display="block">
                                {report.reportType === 'quarterly' ? 'Quarterly' : 'Annual'} • Due: {formatDate(report.dueDate)}
                              </Typography>
                              {isOverdue && (
                                <Chip label="Overdue" size="small" color="error" sx={{ mt: 0.5 }} />
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6">
                  Upcoming Due Date Items
                </Typography>
                <Button size="small" onClick={() => navigate('/due-date-items')}>
                  View All
                </Button>
              </Box>
              {upcomingItems.length === 0 ? (
                <Typography color="text.secondary">
                  No upcoming items
                </Typography>
              ) : (
                <List>
                  {upcomingItems.map((item) => {
                    const isOverdue = item.status === 'overdue';
                    return (
                      <ListItem 
                        key={item.id}
                        sx={{
                          borderLeft: isOverdue ? '4px solid red' : '4px solid transparent',
                          pl: isOverdue ? 1.5 : 2,
                        }}
                      >
                        <ListItemText
                          primary={item.title}
                          secondary={
                            <Box>
                              <Typography variant="caption" display="block">
                                Due: {formatDate(item.dueDate)}
                                {item.category && ` • ${item.category}`}
                              </Typography>
                              {isOverdue && (
                                <Chip label="Overdue" size="small" color="error" sx={{ mt: 0.5 }} />
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <RemindersCard maxItems={10} />
        </Grid>
      </Grid>
    </Box>
  );
};

