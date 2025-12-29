import { useEffect, useState } from 'react';
import { logError } from '../utils/logger';
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
  getUpcomingProgressReports,
  getUpcomingDueDateItems,
} from '../utils/storage-api';
import { RemindersCard } from '../components/RemindersCard';
import { formatDate } from '../utils/helpers';
import { useSchool } from '../context/SchoolContext';
import { useAsyncOperation } from '../hooks';
import type { Student, ProgressReport, DueDateItem } from '../types';

interface DashboardData {
  stats: {
    activeStudents: number;
    totalGoals: number;
  };
  students: Student[];
  upcomingReports: ProgressReport[];
  upcomingItems: DueDateItem[];
}

export const Dashboard = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { selectedSchool } = useSchool();

  const handleDocumentSession = () => {
    // Always navigate to sessions page to log activity
    navigate('/sessions?add=true');
  };

  const { loading, execute } = useAsyncOperation<DashboardData>();

  const [stats, setStats] = useState({
    activeStudents: 0,
    totalGoals: 0,
  });
  const [students, setStudents] = useState<Student[]>([]);
  const [upcomingReports, setUpcomingReports] = useState<ProgressReport[]>([]);
  const [upcomingItems, setUpcomingItems] = useState<DueDateItem[]>([]);

  const loadDashboardData = async () => {
    try {
      await execute(async () => {
        const schoolStudents = await getStudents(selectedSchool);
        const goals = await getGoals();
      
        // Filter goals by school students
        const studentIds = new Set(schoolStudents.map(s => s.id));
        const schoolGoals = goals.filter(g => studentIds.has(g.studentId));

        // Filter out archived students (archived is optional for backward compatibility)
        const activeStudents = schoolStudents.filter(s => s.status === 'active' && s.archived !== true);
        const activeStudentIds = new Set(activeStudents.map(s => s.id));
        
        // Filter goals to only include those belonging to active (non-archived) students
        const activeGoals = schoolGoals.filter(g => 
          g.status === 'in-progress' && activeStudentIds.has(g.studentId)
        );
        
        const statsData = {
          activeStudents: activeStudents.length,
          totalGoals: activeGoals.length,
        };

        // Load upcoming progress reports (next 30 days)
        const reports = await getUpcomingProgressReports(30, selectedSchool);

        // Load upcoming due date items (next 30 days)
        const items = await getUpcomingDueDateItems(30, selectedSchool);

        const dashboardData: DashboardData = {
          stats: statsData,
          students: schoolStudents,
          upcomingReports: reports.slice(0, 5),
          upcomingItems: items.slice(0, 5),
        };

        // Update state with the loaded data
        setStats(dashboardData.stats);
        setStudents(dashboardData.students);
        setUpcomingReports(dashboardData.upcomingReports);
        setUpcomingItems(dashboardData.upcomingItems);

        return dashboardData;
      });
    } catch (error) {
      logError('Failed to load dashboard data', error);
    }
  };

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  ];
  
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

