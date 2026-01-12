import { useEffect, useState, useCallback, useRef } from 'react';
import { logError } from '../utils/logger';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  Box,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Assessment as AssessmentIcon,
  DescriptionOutlined as DescriptionOutlinedIcon,
  Event as EventIcon,
  NavigateNext as NavigateNextIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { getReminders, dismissReminder } from '../utils/storage-api';
import { formatDate } from '../utils/helpers';
import type { Reminder } from '../types';
import { useSchool } from '../context/SchoolContext';
import { PriorityChip } from './common/PriorityChip';
import { useSnackbar } from '../hooks';

const getReminderIcon = (type: Reminder['type']) => {
  switch (type) {
    case 'goal-review':
      return <AssignmentIcon fontSize="small" />;
    case 're-evaluation':
      return <AssessmentIcon fontSize="small" />;
    case 'report-deadline':
      return <DescriptionOutlinedIcon fontSize="small" />;
    case 'annual-review':
      return <EventIcon fontSize="small" />;
    case 'frequency-alert':
      return <EventIcon fontSize="small" />;
    case 'no-goals':
      return <AssignmentIcon fontSize="small" />;
    case 'no-target':
      return <AssignmentIcon fontSize="small" />;
    default:
      return null;
  }
};


const getReminderPath = (reminder: Reminder): string => {
  switch (reminder.type) {
    case 'goal-review':
      return `/students/${reminder.studentId}`;
    case 're-evaluation':
      return '/evaluations';
    case 'report-deadline':
      return '/progress-reports';
    case 'annual-review':
      return `/students/${reminder.studentId}`;
    case 'frequency-alert':
      return `/students/${reminder.studentId}`;
    case 'no-goals':
      return `/students/${reminder.studentId}?addGoal=true`;
    case 'no-target':
      return `/students/${reminder.studentId}?goalId=${reminder.relatedId || ''}`;
    default:
      return '/';
  }
};

interface RemindersCardProps {
  maxItems?: number;
  showViewAll?: boolean;
}

export const RemindersCard = ({ maxItems = 5, showViewAll = true }: RemindersCardProps) => {
  const navigate = useNavigate();
  const { selectedSchool } = useSchool();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadReminders = useCallback(async () => {
    if (!isMountedRef.current) return;
    setLoading(true);
    try {
      const allReminders = await getReminders(selectedSchool);
      if (!isMountedRef.current) return;
      setReminders(allReminders.slice(0, maxItems));
    } catch (error) {
      logError('Failed to load reminders', error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [selectedSchool, maxItems]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const handleReminderClick = (reminder: Reminder) => {
    const path = getReminderPath(reminder);
    navigate(path);
  };

  const handleDismiss = async (e: React.MouseEvent, reminder: Reminder) => {
    e.stopPropagation(); // Prevent navigation when clicking dismiss
    
    if (!isMountedRef.current) return;
    setDismissingId(reminder.id);
    try {
      await dismissReminder(reminder);
      if (!isMountedRef.current) return;
      showSnackbar('Reminder dismissed', 'success');
      // Reload reminders to update the list
      await loadReminders();
    } catch (error) {
      if (!isMountedRef.current) return;
      logError('Failed to dismiss reminder', error);
      showSnackbar('Failed to dismiss reminder. Please try again.', 'error');
    } finally {
      if (isMountedRef.current) {
        setDismissingId(null);
      }
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Smart Reminders
          </Typography>
          <Typography color="text.secondary">Loading reminders...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6">
              Smart Reminders
            </Typography>
            {showViewAll && reminders.length > 0 && (
              <Button size="small" onClick={() => navigate('/reminders')}>
                View All
              </Button>
            )}
          </Box>
          {reminders.length === 0 ? (
            <Typography color="text.secondary">
              No reminders at this time
            </Typography>
          ) : (
            <List>
              {reminders.map((reminder) => (
                <ListItem
                  key={reminder.id}
                  sx={{
                    borderLeft: reminder.priority === 'high' ? '4px solid' : '4px solid transparent',
                    borderLeftColor: reminder.priority === 'high' ? 'error.main' : 'transparent',
                    pl: reminder.priority === 'high' ? 1.5 : 2,
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                  onClick={() => handleReminderClick(reminder)}
                >
                  <Box sx={{ mr: 1, color: 'text.secondary' }}>
                    {getReminderIcon(reminder.type)}
                  </Box>
                  <ListItemText
                    primary={
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box component="span" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
                          {reminder.title}
                        </Box>
                        <PriorityChip 
                          priority={reminder.priority} 
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <>
                        <Box component="span" sx={{ fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                          {reminder.studentName}
                        </Box>
                        <Box component="span" sx={{ fontSize: '0.75rem', display: 'block', color: 'text.secondary', mb: 0.5 }}>
                          {reminder.description}
                        </Box>
                        {reminder.daysUntilDue !== undefined && (
                          <Chip
                            label={
                              reminder.daysUntilDue < 0
                                ? `Overdue by ${Math.abs(reminder.daysUntilDue)} days`
                                : reminder.daysUntilDue === 0
                                ? 'Due today'
                                : `${reminder.daysUntilDue} days remaining`
                            }
                            size="small"
                            color={reminder.daysUntilDue < 0 ? 'error' : reminder.daysUntilDue <= 7 ? 'warning' : 'default'}
                            sx={{ mt: 0.5, height: 18, fontSize: '0.6rem' }}
                          />
                        )}
                        {reminder.dueDate && (
                          <Box component="span" sx={{ fontSize: '0.75rem', display: 'block', color: 'text.secondary', mt: 0.5 }}>
                            Due: {formatDate(reminder.dueDate)}
                          </Box>
                        )}
                      </>
                    }
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Tooltip title="Dismiss reminder">
                      <IconButton
                        size="small"
                        edge="end"
                        onClick={(e) => handleDismiss(e, reminder)}
                        disabled={dismissingId === reminder.id}
                        sx={{ color: 'success.main' }}
                      >
                        <CheckCircleIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View details">
                      <IconButton size="small" edge="end">
                        <NavigateNextIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
      <SnackbarComponent />
    </>
  );
};

