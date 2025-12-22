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
} from '@mui/material';
import type { School } from '../types';

interface SchoolFormDialogProps {
  open: boolean;
  editingSchool: School | null;
  formData: {
    name: string;
    state: string;
    teletherapy: boolean;
  };
  states: Array<{ value: string; label: string }>;
  onClose: () => void;
  onSave: () => void;
  onFormDataChange: (data: Partial<{ name: string; state: string; teletherapy: boolean }>) => void;
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

