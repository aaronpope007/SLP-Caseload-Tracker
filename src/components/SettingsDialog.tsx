import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Divider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { ExportDialog } from './ExportDialog';
import { useTheme } from '../context/ThemeContext';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsDialog = ({ open, onClose }: SettingsDialogProps) => {
  const [apiKey, setApiKey] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const { mode, toggleMode } = useTheme();

  useEffect(() => {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved) {
      setApiKey(saved);
    }
  }, []);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey.trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Settings</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Appearance
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={mode === 'dark'}
                onChange={toggleMode}
                color="primary"
              />
            }
            label="Dark Mode"
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Toggle between light and dark theme.
          </Typography>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ mt: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Google Gemini API Key
          </Typography>
          <TextField
            fullWidth
            type="password"
            label="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            helperText="Required for AI treatment idea generation. Get your key from Google AI Studio."
            margin="normal"
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Your API key is stored locally and never sent to any server except Google's Gemini API.
          </Typography>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Data Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            All data is stored locally in your browser. Use the export feature to backup your data.
          </Typography>
          <Button variant="outlined" fullWidth onClick={() => setExportOpen(true)}>
            Export / Import Data
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save
        </Button>
      </DialogActions>
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
      />
    </Dialog>
  );
};

