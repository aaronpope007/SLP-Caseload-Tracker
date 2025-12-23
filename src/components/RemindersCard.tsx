import { useEffect, useState } from 'react';
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
} from '@mui/icons-material';
import { getReminders } from '../utils/storage-api';
import { formatDate } from '../utils/helpers';
import type { Reminder } from '../types';
import { useSchool } from '../context/SchoolContext';
import { PriorityChip } from './PriorityChip';

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
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReminders = async () => {
      setLoading(true);
      try {
        const allReminders = await getReminders(selectedSchool);
        setReminders(allReminders.slice(0, maxItems));
      } catch (error) {
        console.error('Failed to load reminders:', error);
      } finally {
        setLoading(false);
      }
    };

    loadReminders();
  }, [selectedSchool, maxItems]);

  const handleReminderClick = (reminder: Reminder) => {
    const path = getReminderPath(reminder);
    navigate(path);
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight="medium">
                        {reminder.title}
                      </Typography>
                      <PriorityChip 
                        priority={reminder.priority} 
                        size="small"
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption" display="block">
                        {reminder.studentName}
                      </Typography>
                      <Typography variant="caption" display="block" color="text.secondary">
                        {reminder.description}
                      </Typography>
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
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                          Due: {formatDate(reminder.dueDate)}
                        </Typography>
                      )}
                    </Box>
                  }
                />
                <Tooltip title="View details">
                  <IconButton size="small" edge="end">
                    <NavigateNextIcon />
                  </IconButton>
                </Tooltip>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

