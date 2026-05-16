import { memo, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
} from '@mui/material';
import type { Icd10CodeEntry } from '../../types';
import { normalizeIcd10Codes } from '../../utils/icd10Codes';

interface StudentInfoCardProps {
  name: string;
  age: number;
  grade: string;
  status: 'active' | 'discharged';
  concerns: string[];
  caseManager?: { name: string; role: string };
  frequencyPerWeek?: number;
  frequencyType?: 'per-week' | 'per-month';
  icd10Codes?: Icd10CodeEntry[] | string[];
  icd10Descriptions?: string[];
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
  icd10Codes,
  icd10Descriptions,
}: StudentInfoCardProps) => {
  const frequencyDisplay = frequencyPerWeek && frequencyType
    ? `${frequencyPerWeek} ${frequencyType === 'per-week' ? 'per week' : 'per month'}`
    : null;

  const normalizedIcd10 = useMemo(
    () => normalizeIcd10Codes(icd10Codes, icd10Descriptions),
    [icd10Codes, icd10Descriptions]
  );

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
        {normalizedIcd10.length > 0 && (
          <Box sx={{ mb: concerns.length > 0 ? 2 : 0 }}>
            <Typography variant="subtitle2" gutterBottom>
              ICD-10 Codes
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {normalizedIcd10.map((entry, index) => (
                <Typography
                  key={`${entry.code}-${index}`}
                  component="li"
                  variant="body2"
                  sx={{
                    fontWeight: entry.primary ? 700 : 400,
                    mb: 0.25,
                  }}
                >
                  {entry.code}
                  {entry.description ? ` — ${entry.description}` : ''}
                  {entry.startDate ? ` (${entry.startDate})` : ''}
                </Typography>
              ))}
            </Box>
          </Box>
        )}
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
