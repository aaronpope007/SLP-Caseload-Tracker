import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
  Tooltip,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import type { Session } from '../types';
import { formatDateTime } from '../utils/helpers';

interface SessionTimeItemProps {
  session: Session;
  isGroup: boolean;
  groupSessions?: Session[];
  getStudentName: (studentId: string) => string;
}

const DIRECT_SERVICES_INFO =
  "MN requires that specific start and end times are listed for any direct services provided remotely for each individual session. In the notes section of your entry for the school, list the specific start and end time of each direct telehealth session, with a separate line for each entry. If doing additional duties within a timeframe of billable services, you only need to include specific start/end times for the direct telehealth duties.";

const INDIRECT_SERVICES_INFO =
  'Any of the following activities: collaboration with teachers/staff, direct contact with the student to monitor and observe, modifying environment/items, preparation for sessions, or ordering/creation of materials for the student to support their IEP goals, setting up a therapeutic OT space for students, etc. It also includes performing documentation/record-keeping duties, including updating daily notes, scheduling, and updating caseload lists for Indigo sped director group schools. If you see a student for direct services and document "Direct/indirect services," since you did preparation and documentation, you do not need to write "Indirect services" as well. You will only write this if you do other indirect services beyond the preparation and documentation of direct services, such as fulfilling monthly minutes.';

export const SessionTimeItem = ({
  session,
  isGroup,
  groupSessions,
  getStudentName,
}: SessionTimeItemProps) => {
  const serviceType = session.isDirectServices
    ? session.missedSession
      ? 'Missed Direct Services'
      : 'Direct Services'
    : 'Indirect Services';

  if (isGroup && groupSessions) {
    const studentNames = groupSessions.map(s => getStudentName(s.studentId)).join(', ');

    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                <GroupIcon color="primary" />
                <Typography variant="h6">
                  Group Session ({groupSessions.length} {groupSessions.length === 1 ? 'student' : 'students'})
                </Typography>
                <Chip
                  label="Group"
                  size="small"
                  color="primary"
                  variant="outlined"
                />
                <Tooltip
                  title={session.isDirectServices ? DIRECT_SERVICES_INFO : INDIRECT_SERVICES_INFO}
                  arrow
                  placement="top"
                >
                  <Chip
                    label={serviceType}
                    size="small"
                    color={session.isDirectServices ? 'primary' : 'secondary'}
                    icon={<InfoIcon sx={{ fontSize: 16 }} />}
                  />
                </Tooltip>
              </Box>
              <Typography color="text.secondary" variant="body2" sx={{ mb: 1 }}>
                <AccessTimeIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                {formatDateTime(session.date)}
                {session.endTime && ` - ${formatDateTime(session.endTime)}`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Students:</strong> {studentNames}
              </Typography>
            </Box>
          </Box>
          {session.notes && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {session.notes}
            </Typography>
          )}
        </CardContent>
      </Card>
    );
  }

  const studentName = getStudentName(session.studentId);

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <PersonIcon color="primary" />
              <Typography variant="h6">
                {studentName}
              </Typography>
              <Chip
                label="Individual"
                size="small"
                color="primary"
                variant="outlined"
              />
              <Tooltip
                title={session.isDirectServices ? DIRECT_SERVICES_INFO : INDIRECT_SERVICES_INFO}
                arrow
                placement="top"
              >
                <Chip
                  label={serviceType}
                  size="small"
                  color={session.isDirectServices ? 'primary' : 'secondary'}
                  icon={<InfoIcon sx={{ fontSize: 16 }} />}
                />
              </Tooltip>
            </Box>
            <Typography color="text.secondary" variant="body2">
              <AccessTimeIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
              {formatDateTime(session.date)}
              {session.endTime && ` - ${formatDateTime(session.endTime)}`}
            </Typography>
          </Box>
        </Box>
        {session.notes && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {session.notes}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

