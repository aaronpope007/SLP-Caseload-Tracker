import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  RecordVoiceOver as RecordVoiceOverIcon,
} from '@mui/icons-material';
import type { ArticulationScreener } from '../types';
import { formatDateTime } from '../utils/helpers';

interface ArticulationScreenerTimeItemProps {
  screener: ArticulationScreener;
  getStudentName: (studentId: string) => string;
}

export const ArticulationScreenerTimeItem = ({
  screener,
  getStudentName,
}: ArticulationScreenerTimeItemProps) => {
  const studentName = getStudentName(screener.studentId);
  const disorderedCount = screener.disorderedPhonemes?.length || 0;

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <RecordVoiceOverIcon color="primary" />
              <Typography variant="h6">
                {studentName} - Articulation Screening
              </Typography>
              {disorderedCount > 0 && (
                <Chip
                  label={`${disorderedCount} phoneme${disorderedCount !== 1 ? 's' : ''}`}
                  size="small"
                  color="warning"
                />
              )}
            </Box>
            <Typography color="text.secondary" variant="body2">
              <AccessTimeIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
              {formatDateTime(screener.date)}
            </Typography>
            {screener.disorderedPhonemes && screener.disorderedPhonemes.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Disordered Phonemes: {screener.disorderedPhonemes.map(dp => dp.phoneme).join(', ')}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

