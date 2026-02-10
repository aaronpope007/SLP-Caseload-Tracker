import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Typography,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  Edit as EditIcon,
  Event as EventIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import type { Meeting } from '../../types';
import { formatDateTime } from '../../utils/helpers';

interface MeetingTimeItemProps {
  meeting: Meeting;
  getStudentName: (studentId: string) => string;
  /** When provided, the card is clickable and shows an edit button to open the meeting in the edit dialog */
  onEdit?: (meeting: Meeting) => void;
}

export const MeetingTimeItem = ({
  meeting,
  getStudentName,
  onEdit,
}: MeetingTimeItemProps) => {
  const isIEP = meeting.category === 'IEP';
  const studentName = meeting.studentId ? getStudentName(meeting.studentId) : null;

  return (
    <Card
      sx={{
        mb: 2,
        ...(onEdit && {
          cursor: 'pointer',
          '&:hover': { boxShadow: 2 },
        }),
      }}
      onClick={onEdit ? () => onEdit(meeting) : undefined}
    >
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
          {onEdit && (
            <IconButton
              size="small"
              aria-label="Edit meeting"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(meeting);
              }}
              sx={{ ml: 0.5 }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          )}
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
