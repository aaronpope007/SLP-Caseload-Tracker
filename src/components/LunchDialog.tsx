import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import { toLocalDateTimeString } from '../utils/helpers';

interface LunchDialogProps {
  open: boolean;
  onClose: () => void;
  startTime: string;
  endTime: string;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onSave: () => void;
}

export const LunchDialog = ({
  open,
  onClose,
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  onSave,
}: LunchDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Lunch</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Start Time"
              type="datetime-local"
              fullWidth
              value={startTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Box sx={{ display: 'flex', gap: 1, flex: 1, alignItems: 'flex-end' }}>
              <TextField
                label="End Time"
                type="datetime-local"
                fullWidth
                value={endTime}
                onChange={(e) => onEndTimeChange(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <Button
                variant="outlined"
                size="medium"
                startIcon={<AccessTimeIcon />}
                onClick={() => onEndTimeChange(toLocalDateTimeString(new Date()))}
                sx={{ 
                  minWidth: 'auto',
                  whiteSpace: 'nowrap',
                  mb: 0.5,
                }}
                title="Set end time to current time"
              >
                Now
              </Button>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={onSave}
          variant="contained"
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

