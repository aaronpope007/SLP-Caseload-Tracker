import {
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
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
  People as PeopleIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import type { School } from '../types';

interface SchoolCardProps {
  school: School;
  getStateLabel: (stateCode: string) => string;
  onEdit: (school: School) => void;
  onDelete: (id: string) => void;
  onViewStudents: (school: School) => void;
  onPrintStudents: (school: School) => void;
}

export const SchoolCard = ({
  school,
  getStateLabel,
  onEdit,
  onDelete,
  onViewStudents,
  onPrintStudents,
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
          {school.studentCount !== undefined && (
            <Chip
              label={`${school.studentCount} student${school.studentCount !== 1 ? 's' : ''}`}
              size="small"
              variant="outlined"
              color={school.studentCount === 0 ? 'default' : 'primary'}
            />
          )}
        </Box>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2, pt: 0, display: 'flex', justifyContent: 'space-between' }}>
        <Button
          size="small"
          startIcon={<PeopleIcon />}
          onClick={() => onViewStudents(school)}
        >
          View Students
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<PrintIcon />}
          onClick={() => onPrintStudents(school)}
        >
          Print List
        </Button>
      </CardActions>
    </Card>
  );
};

