import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Typography,
  Grid,
} from '@mui/material';
import type { School } from '../types';

interface SchoolFormDialogProps {
  open: boolean;
  editingSchool: School | null;
  formData: {
    name: string;
    state: string;
    teletherapy: boolean;
    schoolHours?: {
      startHour: number;
      endHour: number;
    };
    studentTimes?: {
      startTime: string;
      endTime: string;
    };
  };
  states: Array<{ value: string; label: string }>;
  onClose: () => void;
  onSave: () => void;
  onFormDataChange: (data: Partial<{ name: string; state: string; teletherapy: boolean; schoolHours?: { startHour: number; endHour: number }; studentTimes?: { startTime: string; endTime: string } }>) => void;
  // Validation error props
  fieldErrors?: Record<string, string | undefined>;
  onClearError?: (field: string) => void;
}

export const SchoolFormDialog = ({
  open,
  editingSchool,
  formData,
  states,
  onClose,
  onSave,
  onFormDataChange,
  fieldErrors = {},
  onClearError,
}: SchoolFormDialogProps) => {
  const hasError = (field: string) => !!fieldErrors[field];
  const getError = (field: string) => fieldErrors[field];
  const clearError = (field: string) => onClearError?.(field);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {editingSchool ? 'Edit School' : 'Add New School'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="School Name"
            fullWidth
            value={formData.name}
            onChange={(e) => {
              onFormDataChange({ name: e.target.value });
              clearError('name');
            }}
            required
            autoFocus
            margin="normal"
            error={hasError('name')}
            helperText={getError('name')}
          />
          <TextField
            select
            label="State"
            fullWidth
            value={formData.state}
            onChange={(e) => onFormDataChange({ state: e.target.value })}
            SelectProps={{
              native: true,
            }}
            margin="normal"
            InputLabelProps={{
              shrink: true,
            }}
          >
            {states.map((state) => (
              <option key={state.value} value={state.value}>
                {state.label}
              </option>
            ))}
          </TextField>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.teletherapy}
                onChange={(e) => onFormDataChange({ teletherapy: e.target.checked })}
              />
            }
            label="Teletherapy"
            sx={{ mt: 1 }}
          />
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              School Hours (for Calendar)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Start Hour"
                  type="number"
                  fullWidth
                  value={formData.schoolHours?.startHour ?? 8}
                  onChange={(e) => {
                    const startHour = parseInt(e.target.value) || 8;
                    onFormDataChange({
                      schoolHours: {
                        startHour,
                        endHour: formData.schoolHours?.endHour ?? 17,
                      },
                    });
                  }}
                  inputProps={{ min: 0, max: 23, step: 1 }}
                  helperText="24-hour format (0-23)"
                  margin="normal"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="End Hour"
                  type="number"
                  fullWidth
                  value={formData.schoolHours?.endHour ?? 17}
                  onChange={(e) => {
                    const endHour = parseInt(e.target.value) || 17;
                    onFormDataChange({
                      schoolHours: {
                        startHour: formData.schoolHours?.startHour ?? 8,
                        endHour,
                      },
                    });
                  }}
                  inputProps={{ min: 0, max: 23, step: 1 }}
                  helperText="24-hour format (0-23)"
                  margin="normal"
                />
              </Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Defaults to 8 AM - 5 PM if not set. Used for calendar week view time slots.
            </Typography>
          </Box>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              Student Hours (for Email Rescheduling)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Student Start Time"
                  type="time"
                  fullWidth
                  value={formData.studentTimes?.startTime ?? '08:00'}
                  onChange={(e) => {
                    onFormDataChange({
                      studentTimes: {
                        startTime: e.target.value,
                        endTime: formData.studentTimes?.endTime ?? '15:00',
                      },
                    });
                  }}
                  inputProps={{ step: 60 }}
                  helperText="24-hour format (HH:mm)"
                  margin="normal"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Student End Time"
                  type="time"
                  fullWidth
                  value={formData.studentTimes?.endTime ?? '15:00'}
                  onChange={(e) => {
                    onFormDataChange({
                      studentTimes: {
                        startTime: formData.studentTimes?.startTime ?? '08:00',
                        endTime: e.target.value,
                      },
                    });
                  }}
                  inputProps={{ step: 60 }}
                  helperText="24-hour format (HH:mm)"
                  margin="normal"
                />
              </Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Defaults to 8:00 AM - 3:00 PM if not set. Used for finding available times when rescheduling missed sessions.
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={onSave}
          variant="contained"
          disabled={!formData.name.trim()}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

