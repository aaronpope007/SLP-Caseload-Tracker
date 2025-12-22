import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Chip,
  IconButton,
  Typography,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Group as GroupIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import type { Session } from '../types';
import { formatDateTime } from '../utils/helpers';

interface GroupSessionAccordionProps {
  groupSessionId: string;
  groupSessions: Session[];
  getStudentName: (studentId: string) => string;
  renderSession: (session: Session) => React.ReactNode;
  onEdit: (groupSessionId: string) => void;
}

export const GroupSessionAccordion = ({
  groupSessionId,
  groupSessions,
  getStudentName,
  renderSession,
  onEdit,
}: GroupSessionAccordionProps) => {
  const firstSession = groupSessions[0];
  const studentNames = groupSessions.map(s => getStudentName(s.studentId)).join(', ');

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
          <GroupIcon color="primary" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">
              Group Session ({groupSessions.length} {groupSessions.length === 1 ? 'student' : 'students'})
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatDateTime(firstSession.date)}
              {firstSession.endTime && ` - ${formatDateTime(firstSession.endTime)}`}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Students: {studentNames}
            </Typography>
          </Box>
          <Chip
            label={firstSession.isDirectServices === true ? 'Direct Services' : 'Indirect Services'}
            size="small"
            color={firstSession.isDirectServices === true ? 'primary' : 'secondary'}
            sx={{ mr: 1 }}
          />
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(groupSessionId);
            }}
            sx={{ mr: 1 }}
          >
            <EditIcon />
          </IconButton>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        {groupSessions.map((session) => renderSession(session))}
      </AccordionDetails>
    </Accordion>
  );
};

