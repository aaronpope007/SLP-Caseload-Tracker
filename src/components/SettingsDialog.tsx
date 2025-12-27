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
  const [userName, setUserName] = useState('');
  const [zoomLink, setZoomLink] = useState('');
  const { mode, toggleMode } = useTheme();

  useEffect(() => {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved) {
      setApiKey(saved);
    }
    const savedUserName = localStorage.getItem('user_name');
    if (savedUserName) {
      setUserName(savedUserName);
    } else {
      // Set default
      setUserName('Aaron Pope');
    }
    const savedZoomLink = localStorage.getItem('zoom_link');
    if (savedZoomLink) {
      setZoomLink(savedZoomLink);
    } else {
      // Set default
      setZoomLink(`Aaron Pope is inviting you to a scheduled Zoom meeting.

Topic: Aaron Pope's Personal Meeting Room

Join Zoom Meeting

https://zoom.us/j/3185217495?pwd=UEJrubV03AKwCET0Vm0A0X717mqa2l.1

Meeting ID: 318 521 7495
Passcode: PhjfJ2

---

Join by SIP
• 3185217495@zoomcrc.com

Join instructions
https://zoom.us/meetings/3185217495/invitations?signature=VXHC8Lky81IvfhAC-MjZnRBWgZj9Itl7ZZxepgETBLE`);
    }
  }, []);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey.trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }
    localStorage.setItem('user_name', userName.trim() || 'Aaron Pope');
    // Don't trim zoom link - preserve newlines and formatting
    localStorage.setItem('zoom_link', zoomLink);
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
        <Box sx={{ mt: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            User Profile
          </Typography>
          <TextField
            fullWidth
            label="Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            helperText="Your name for email signatures"
            margin="normal"
          />
          <TextField
            fullWidth
            label="Zoom Link"
            multiline
            rows={8}
            value={zoomLink}
            onChange={(e) => setZoomLink(e.target.value)}
            helperText="Your Zoom meeting invitation text"
            margin="normal"
          />
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

