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
}

export const StudentInfoCard = ({
  name,
  age,
  grade,
  status,
  concerns,
}: StudentInfoCardProps) => {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="h4">{name}</Typography>
            <Typography color="text.secondary">
              Age: {age} | Grade: {grade}
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
};

