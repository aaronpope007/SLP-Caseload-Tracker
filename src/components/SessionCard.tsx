import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Typography,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import type { Session } from '../types';
import { formatDateTime } from '../utils/helpers';

interface SessionCardProps {
  session: Session;
  getStudentName: (studentId: string) => string;
  getGoalDescription: (goalId: string) => string;
  onEdit: (session: Session) => void;
  onDelete: (sessionId: string) => void;
}

export const SessionCard = ({
  session,
  getStudentName,
  getGoalDescription,
  onEdit,
  onDelete,
}: SessionCardProps) => {
  return (
    <Card sx={{ mb: 1 }}>
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
              onClick={() => onEdit(session)}
            >
              <EditIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => onDelete(session.id)}
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
};

