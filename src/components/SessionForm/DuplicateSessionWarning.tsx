import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface Props {
  open: boolean;
  /** When true, copy mentions that at least one student in a group save may already have a session at this time. */
  groupConflictHint?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DuplicateSessionWarning({
  open,
  groupConflictHint,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color="warning" />
        Possible Duplicate Session
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          A session for this student already exists at this start time on this date. Saving a duplicate may
          result in a double billing entry in MA / SpedForms.
        </DialogContentText>
        {groupConflictHint ? (
          <DialogContentText sx={{ mt: 1 }}>
            At least one student in this save has a conflicting session at this time.
          </DialogContentText>
        ) : null}
        <DialogContentText sx={{ mt: 1 }}>Are you sure you want to save this session?</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} variant="outlined">
          Cancel
        </Button>
        <Button onClick={onConfirm} variant="contained" color="warning">
          Save Anyway
        </Button>
      </DialogActions>
    </Dialog>
  );
}
