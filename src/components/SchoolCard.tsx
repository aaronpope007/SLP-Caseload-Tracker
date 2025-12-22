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
  School as SchoolIcon,
  LocationOn as LocationOnIcon,
  Videocam as VideocamIcon,
} from '@mui/icons-material';
import type { School } from '../types';

interface SchoolCardProps {
  school: School;
  getStateLabel: (stateCode: string) => string;
  onEdit: (school: School) => void;
  onDelete: (id: string) => void;
}

export const SchoolCard = ({
  school,
  getStateLabel,
  onEdit,
  onDelete,
}: SchoolCardProps) => {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <SchoolIcon color="primary" />
            <Typography variant="h6" component="div">
              {school.name}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => onEdit(school)}
              aria-label="edit school"
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => onDelete(school.id)}
              aria-label="delete school"
              color="error"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
          {school.state && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocationOnIcon fontSize="small" color="action" />
              <Chip
                label={getStateLabel(school.state)}
                size="small"
                variant="outlined"
                color="primary"
              />
            </Box>
          )}
          {school.teletherapy && (
            <Chip
              icon={<VideocamIcon />}
              label="Teletherapy"
              size="small"
              variant="outlined"
              color="success"
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

