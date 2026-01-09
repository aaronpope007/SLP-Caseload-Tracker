/**
 * Backup Manager Component
 * 
 * Provides UI for managing database backups:
 * - Create new backups
 * - List existing backups
 * - Download backups
 * - Delete backups
 * - Restore from backups
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Paper,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Backup as BackupIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Restore as RestoreIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { api } from '../../utils/api';
import { formatDistanceToNow } from 'date-fns';
import { logError } from '../../utils/logger';

interface BackupInfo {
  filename: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
}

export function BackupManager() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [restoreDialog, setRestoreDialog] = useState<{
    open: boolean;
    filename: string;
  }>({ open: false, filename: '' });

  const loadBackups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.backup.list();
      setBackups(response.backups);
    } catch (err) {
      setError('Failed to load backups');
      logError('Failed to load backups', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  const handleCreateBackup = async () => {
    try {
      setCreating(true);
      setError(null);
      const response = await api.backup.create();
      setSuccess(`Backup created: ${response.filename} (${response.sizeFormatted})`);
      await loadBackups();
    } catch (err) {
      setError('Failed to create backup');
      logError('Failed to create backup', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = (filename: string) => {
    const url = api.backup.getDownloadUrl(filename);
    window.open(url, '_blank');
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete backup "${filename}"?`)) {
      return;
    }

    try {
      setError(null);
      await api.backup.delete(filename);
      setSuccess('Backup deleted');
      await loadBackups();
    } catch (err) {
      setError('Failed to delete backup');
      logError('Failed to delete backup', err);
    }
  };

  const handleRestore = async () => {
    try {
      setError(null);
      await api.backup.restore(restoreDialog.filename);
      setSuccess('Database restored! Please refresh the page to see changes.');
      setRestoreDialog({ open: false, filename: '' });
    } catch (err) {
      setError('Failed to restore backup');
      logError('Failed to restore backup', err);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString()} (${formatDistanceToNow(date, { addSuffix: true })})`;
    } catch {
      return dateString;
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">
          <BackupIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Database Backups
        </Typography>
        <Box>
          <Tooltip title="Refresh list">
            <IconButton onClick={loadBackups} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={creating ? <CircularProgress size={16} /> : <BackupIcon />}
            onClick={handleCreateBackup}
            disabled={creating}
            sx={{ ml: 1 }}
          >
            {creating ? 'Creating...' : 'Create Backup'}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Divider sx={{ mb: 2 }} />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : backups.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
          No backups found. Create your first backup to protect your data.
        </Typography>
      ) : (
        <List dense>
          {backups.map((backup) => (
            <ListItem key={backup.filename} divider>
              <ListItemText
                primary={backup.filename}
                secondary={
                  <>
                    {backup.sizeFormatted} • {formatDate(backup.createdAt)}
                  </>
                }
              />
              <ListItemSecondaryAction>
                <Tooltip title="Download">
                  <IconButton
                    edge="end"
                    onClick={() => handleDownload(backup.filename)}
                    sx={{ mr: 1 }}
                  >
                    <DownloadIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Restore">
                  <IconButton
                    edge="end"
                    onClick={() => setRestoreDialog({ open: true, filename: backup.filename })}
                    sx={{ mr: 1 }}
                    color="warning"
                  >
                    <RestoreIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    edge="end"
                    onClick={() => handleDelete(backup.filename)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
        Backups are stored on the server. Download backups regularly for offsite storage.
      </Typography>

      {/* Restore Confirmation Dialog */}
      <Dialog
        open={restoreDialog.open}
        onClose={() => setRestoreDialog({ open: false, filename: '' })}
      >
        <DialogTitle>⚠️ Restore Database</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to restore the database from{' '}
            <strong>{restoreDialog.filename}</strong>?
            <br /><br />
            <strong>Warning:</strong> This will replace all current data with the backup.
            A backup of the current database will be created before restoring.
            <br /><br />
            After restoring, you may need to refresh the page or restart the application.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialog({ open: false, filename: '' })}>
            Cancel
          </Button>
          <Button onClick={handleRestore} color="warning" variant="contained">
            Restore
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default BackupManager;

