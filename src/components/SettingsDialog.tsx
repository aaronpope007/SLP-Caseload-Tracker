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
  const [emailAddress, setEmailAddress] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
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
      // Set default template (user should replace with their own Zoom link)
      setZoomLink(`[Your Name] is inviting you to a scheduled Zoom meeting.

Topic: [Your Meeting Topic]

Join Zoom Meeting
[Your Zoom Meeting Link]

Meeting ID: [Your Meeting ID]
Passcode: [Your Passcode]

---

Join instructions
[Your join instructions]`);
    }
    const savedEmailAddress = localStorage.getItem('email_address');
    if (savedEmailAddress) {
      setEmailAddress(savedEmailAddress);
    }
    const savedEmailPassword = localStorage.getItem('email_password');
    if (savedEmailPassword) {
      setEmailPassword(savedEmailPassword);
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
    if (emailAddress.trim()) {
      localStorage.setItem('email_address', emailAddress.trim());
    } else {
      localStorage.removeItem('email_address');
    }
    if (emailPassword.trim()) {
      localStorage.setItem('email_password', emailPassword.trim());
    } else {
      localStorage.removeItem('email_password');
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
        <Box sx={{ mt: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Email Settings (Gmail SMTP)
          </Typography>
          <TextField
            fullWidth
            type="email"
            label="Email Address"
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
            helperText="Your Gmail address for sending emails"
            margin="normal"
          />
          <TextField
            fullWidth
            type="password"
            label="App Password"
            value={emailPassword}
            onChange={(e) => setEmailPassword(e.target.value)}
            helperText="Gmail App Password (not your regular password). Generate one in your Google Account settings."
            margin="normal"
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Your email credentials are stored locally and only used to send emails through the app. 
            For Gmail, you'll need to create an App Password in your Google Account settings.
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

