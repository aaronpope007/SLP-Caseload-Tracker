import {
  Box,
  Card,
  CardContent,
  Typography,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  Email as EmailIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import type { Communication } from '../../types';
import { formatDateTime } from '../../utils/helpers';

interface CommunicationTimeItemProps {
  communication: Communication;
  getStudentName: (studentId: string) => string;
}

export const CommunicationTimeItem = ({
  communication,
  getStudentName,
}: CommunicationTimeItemProps) => {
  const studentName = communication.studentId
    ? getStudentName(communication.studentId)
    : null;

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
          <EmailIcon color="action" />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6">
              Email to Teacher
            </Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mb: 1 }}>
              <AccessTimeIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
              {communication.date ? formatDateTime(communication.date) : 'N/A'}
            </Typography>
            {studentName && (
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <PersonIcon sx={{ fontSize: 16 }} />
                <strong>Student:</strong> {studentName}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              <strong>To:</strong> {communication.contactName}
              {communication.contactEmail && ` (${communication.contactEmail})`}
            </Typography>
            {communication.subject && (
              <Typography variant="body2" sx={{ mt: 1 }} noWrap>
                <strong>Subject:</strong> {communication.subject}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};
