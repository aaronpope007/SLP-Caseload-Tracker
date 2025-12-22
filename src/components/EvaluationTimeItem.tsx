import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import type { Evaluation } from '../types';
import { formatDateTime } from '../utils/helpers';

interface EvaluationTimeItemProps {
  evaluation: Evaluation;
  getStudentName: (studentId: string) => string;
}

export const EvaluationTimeItem = ({
  evaluation,
  getStudentName,
}: EvaluationTimeItemProps) => {
  const studentName = getStudentName(evaluation.studentId);

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <DescriptionIcon color="primary" />
              <Typography variant="h6">
                {studentName} - Evaluation
              </Typography>
              <Chip
                label={evaluation.evaluationType}
                size="small"
                color="info"
              />
            </Box>
            <Typography color="text.secondary" variant="body2">
              <AccessTimeIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
              {formatDateTime(evaluation.dateCreated)}
            </Typography>
            {evaluation.areasOfConcern && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Areas of Concern: {evaluation.areasOfConcern}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

