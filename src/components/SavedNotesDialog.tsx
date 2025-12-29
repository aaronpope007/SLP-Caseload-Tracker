import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { formatDateTime, formatDate } from '../utils/helpers';

import type { TimesheetNote } from '../types';

interface SavedNotesDialogProps {
  open: boolean;
  notes: TimesheetNote[];
  onClose: () => void;
  onLoadNote: (note: TimesheetNote) => void;
  onDeleteNote: (id: string) => void;
}

export const SavedNotesDialog = ({
  open,
  notes,
  onClose,
  onLoadNote,
  onDeleteNote,
}: SavedNotesDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Saved Timesheet Notes</DialogTitle>
      <DialogContent>
        {notes.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
            No saved notes yet.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {notes.map((note) => (
              <Card key={note.id}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        {formatDateTime(note.dateCreated)}
                        {note.dateFor && ` • For: ${formatDate(note.dateFor)}`}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          mt: 1,
                          whiteSpace: 'pre-wrap',
                          maxHeight: '150px',
                          overflow: 'auto',
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          bgcolor: 'background.default',
                          p: 1,
                          borderRadius: 1,
                        }}
                      >
                        {note.content}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => onLoadNote(note)}
                      startIcon={<DescriptionIcon />}
                    >
                      Load
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => onDeleteNote(note.id)}
                      startIcon={<DeleteIcon />}
                    >
                      Delete
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

