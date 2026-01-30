import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Box,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';

const BOLD_HEADERS = new Set([
  'Offsite Direct Services:',
  'Direct services:',
  'Offsite Indirect Services Including:',
  'Indirect services including:',
]);

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
  const lines = note.split('\n');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Timesheet Note</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
          {lines.map((line, i) => (
            <Typography
              key={i}
              component="span"
              variant="body1"
              sx={{
                fontWeight: BOLD_HEADERS.has(line.trim()) ? 'bold' : undefined,
                display: 'block',
              }}
            >
              {line || '\u00A0'}
            </Typography>
          ))}
        </Box>
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

