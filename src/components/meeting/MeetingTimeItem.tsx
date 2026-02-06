import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  Event as EventIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import type { Meeting } from '../../types';
import { formatDateTime } from '../../utils/helpers';

interface MeetingTimeItemProps {
  meeting: Meeting;
  getStudentName: (studentId: string) => string;
}

export const MeetingTimeItem = ({
  meeting,
  getStudentName,
}: MeetingTimeItemProps) => {
  const isIEP = meeting.category === 'IEP';
  const studentName = meeting.studentId ? getStudentName(meeting.studentId) : null;

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
              <EventIcon color="action" />
              <Typography variant="h6">
                {meeting.title}
              </Typography>
              {meeting.category && (
                <Chip
                  label={meeting.category}
                  size="small"
                  color={isIEP ? 'secondary' : 'default'}
                  variant="outlined"
                />
              )}
            </Box>
            <Typography color="text.secondary" variant="body2" sx={{ mb: 1 }}>
              <AccessTimeIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
              {formatDateTime(meeting.date)}
              {meeting.endTime && ` - ${formatDateTime(meeting.endTime)}`}
            </Typography>
            {studentName && (
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PersonIcon sx={{ fontSize: 16 }} />
                <strong>Student:</strong> {studentName}
              </Typography>
            )}
          </Box>
        </Box>
        {meeting.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {meeting.description}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};
