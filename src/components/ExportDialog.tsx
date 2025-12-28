import { useState } from 'react';
import { logError } from '../utils/logger';
import { getErrorMessage } from '../utils/validators';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Alert,
} from '@mui/material';
import { exportData, importData, getStudents, getGoals, getSessions } from '../utils/storage-api';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
}

export const ExportDialog = ({ open, onClose, onImportSuccess }: ExportDialogProps) => {
  const [mode, setMode] = useState<'export' | 'import'>('export');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  const handleExport = async () => {
    try {
      const data = await exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `slp-caseload-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      logError('Failed to export data', error);
      setImportError('Failed to export data. Please try again.');
    }
  };

  const handleExportCSV = async () => {
    try {
      // Simple CSV export for students
      const students = await getStudents();
      const goals = await getGoals();
      const sessions = await getSessions();

    let csv = 'Type,ID,Name,Age,Grade,Status,Date\n';
    students.forEach((s) => {
      csv += `Student,${s.id},${s.name},${s.age > 0 ? s.age : 'n/a'},${s.grade},${s.status},${s.dateAdded}\n`;
    });
    goals.forEach((g) => {
      csv += `Goal,${g.id},"${g.description.replace(/"/g, '""')}",,,${g.status},${g.dateCreated}\n`;
    });
    sessions.forEach((s) => {
      csv += `Session,${s.id},,${s.date},,,${s.date}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slp-caseload-backup-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      logError('Failed to export CSV', error);
      setImportError('Failed to export CSV. Please try again.');
    }
  };

  const handleImport = async () => {
    try {
      await importData(importText);
      setImportText('');
      setImportError('');
      if (onImportSuccess) {
        onImportSuccess();
      }
      onClose();
      window.location.reload(); // Reload to refresh all data
    } catch (error: unknown) {
      setImportError(getErrorMessage(error) || 'Invalid JSON data');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Export / Import Data</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            variant={mode === 'export' ? 'contained' : 'outlined'}
            onClick={() => setMode('export')}
          >
            Export
          </Button>
          <Button
            variant={mode === 'import' ? 'contained' : 'outlined'}
            onClick={() => setMode('import')}
          >
            Import
          </Button>
        </Box>

        {mode === 'export' ? (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Export your data to backup or transfer to another device.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button variant="contained" onClick={handleExport} fullWidth>
                Export as JSON
              </Button>
              <Button variant="outlined" onClick={handleExportCSV} fullWidth>
                Export as CSV
              </Button>
            </Box>
          </Box>
        ) : (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Import previously exported data. This will replace all current data.
            </Typography>
            {importError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {importError}
              </Alert>
            )}
            <TextField
              fullWidth
              multiline
              rows={10}
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportError('');
              }}
              placeholder="Paste your exported JSON data here..."
              sx={{ mt: 2 }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {mode === 'import' && (
          <Button
            onClick={handleImport}
            variant="contained"
            disabled={!importText.trim()}
          >
            Import
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

