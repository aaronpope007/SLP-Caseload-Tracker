import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';

interface TimesheetNoteDialogProps {
  open: boolean;
  note: string;
  onClose: () => void;
  onSave: () => void;
  onNoteChange: (value: string) => void;
}

export const TimesheetNoteDialog = ({
  open,
  note,
  onClose,
  onSave,
  onNoteChange,
}: TimesheetNoteDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Timesheet Note</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          multiline
          rows={15}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            navigator.clipboard.writeText(note);
          }}
        >
          Copy to Clipboard
        </Button>
        <Button onClick={onSave} startIcon={<SaveIcon />} variant="outlined">
          Save Note
        </Button>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

