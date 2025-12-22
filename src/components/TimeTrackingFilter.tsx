import {
  Box,
  Button,
  Grid,
  Paper,
  TextField,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';

interface TimeTrackingFilterProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onGenerateTimesheet: () => void;
  onOpenSavedNotes: () => void;
  hasItems: boolean;
}

export const TimeTrackingFilter = ({
  selectedDate,
  onDateChange,
  onGenerateTimesheet,
  onOpenSavedNotes,
  hasItems,
}: TimeTrackingFilterProps) => {
  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            label="Filter by Date"
            type="date"
            fullWidth
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<DescriptionIcon />}
              onClick={onGenerateTimesheet}
              disabled={!hasItems}
              sx={{ flex: 1 }}
            >
              Generate Timesheet Note
            </Button>
            <Button
              variant="outlined"
              startIcon={<FolderIcon />}
              onClick={onOpenSavedNotes}
            >
              Saved Notes
            </Button>
          </Box>
        </Grid>
        {selectedDate && (
          <Grid item xs={12}>
            <Button variant="text" size="small" onClick={() => onDateChange('')}>
              Clear Date Filter
            </Button>
          </Grid>
        )}
      </Grid>
    </Paper>
  );
};

