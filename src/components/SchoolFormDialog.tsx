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
  };
  states: Array<{ value: string; label: string }>;
  onClose: () => void;
  onSave: () => void;
  onFormDataChange: (data: Partial<{ name: string; state: string; teletherapy: boolean; schoolHours?: { startHour: number; endHour: number } }>) => void;
}

export const SchoolFormDialog = ({
  open,
  editingSchool,
  formData,
  states,
  onClose,
  onSave,
  onFormDataChange,
}: SchoolFormDialogProps) => {
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
            onChange={(e) => onFormDataChange({ name: e.target.value })}
            required
            autoFocus
            margin="normal"
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

