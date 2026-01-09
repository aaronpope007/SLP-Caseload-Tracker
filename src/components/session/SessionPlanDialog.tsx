import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Typography,
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
} from '@mui/icons-material';
import type { Student } from '../../types';

interface SessionPlanDialogProps {
  open: boolean;
  onClose: () => void;
  students: Student[];
  planStudentId: string;
  sessionPlan: string;
  sessionPlanError: string;
  loadingSessionPlan: boolean;
  onStudentChange: (studentId: string) => void;
  onGenerate: () => void;
}

export const SessionPlanDialog = ({
  open,
  onClose,
  students,
  planStudentId,
  sessionPlan,
  sessionPlanError,
  loadingSessionPlan,
  onStudentChange,
  onGenerate,
}: SessionPlanDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>AI Session Planning</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Student</InputLabel>
            <Select
              value={planStudentId}
              onChange={(e) => onStudentChange(e.target.value)}
              label="Student"
            >
              {students.map((student) => (
                <MenuItem key={student.id} value={student.id}>
                  {student.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {sessionPlanError && (
            <Alert severity="error">{sessionPlanError}</Alert>
          )}
          <Button
            variant="contained"
            onClick={onGenerate}
            disabled={loadingSessionPlan || !planStudentId}
            startIcon={loadingSessionPlan ? <CircularProgress size={20} /> : <PsychologyIcon />}
          >
            Generate Session Plan
          </Button>
          {sessionPlan && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>Generated Session Plan:</Typography>
              <Typography
                component="div"
                sx={{
                  whiteSpace: 'pre-wrap',
                  p: 2,
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  maxHeight: '500px',
                  overflow: 'auto',
                }}
              >
                {sessionPlan}
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

