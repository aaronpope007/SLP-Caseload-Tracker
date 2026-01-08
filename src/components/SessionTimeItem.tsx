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
  "Per SSG SLP-SLPA billing rules: For tele services, you must list the exact time in/out for each direct session. Direct services notes will include specific start and end times for each individual session. For any indirect services, you do not need to list specific in/out times.";

const INDIRECT_SERVICES_INFO =
  'Per SSG SLP-SLPA billing rules: Indirect services typically include lesson planning, documentation, and collaboration. For email correspondence, the coding depends on content: IEP emails are coded as IEP, Evaluation emails are coded as Evaluation, while scheduling/collaboration/intervention-based emails are coded as indirect services. Missed sessions are not billed; instead, replace that work with indirect work (documentation/lesson planning).';

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

