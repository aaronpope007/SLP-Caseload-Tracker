import { memo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
} from '@mui/material';

interface StudentInfoCardProps {
  name: string;
  age: number;
  grade: string;
  status: 'active' | 'discharged';
  concerns: string[];
  caseManager?: { name: string; role: string };
  frequencyPerWeek?: number;
  frequencyType?: 'per-week' | 'per-month';
}

export const StudentInfoCard = memo(({
  name,
  age,
  grade,
  status,
  concerns,
  caseManager,
  frequencyPerWeek,
  frequencyType,
}: StudentInfoCardProps) => {
  const frequencyDisplay = frequencyPerWeek && frequencyType
    ? `${frequencyPerWeek} ${frequencyType === 'per-week' ? 'per week' : 'per month'}`
    : null;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="h4">{name}</Typography>
            <Typography color="text.secondary">
              Age: {age > 0 ? age : 'n/a'} | Grade: {grade}
              {caseManager ? ` | Case Manager: ${caseManager.name} (${caseManager.role})` : ''}
              {frequencyDisplay ? ` | Frequency: ${frequencyDisplay}` : ''}
            </Typography>
          </Box>
          <Chip
            label={status}
            color={status === 'active' ? 'primary' : 'default'}
          />
        </Box>
        {concerns.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Concerns:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {concerns.map((concern, idx) => (
                <Chip key={idx} label={concern} size="small" variant="outlined" />
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
});

