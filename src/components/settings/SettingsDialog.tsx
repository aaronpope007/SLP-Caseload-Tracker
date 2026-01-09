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
  Alert,
  CircularProgress,
} from '@mui/material';
import { ExportDialog } from './ExportDialog';
import { BackupManager } from './BackupManager';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { logError } from '../../utils/logger';

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
  const { authStatus, changePassword } = useAuth();
  const [testDataExists, setTestDataExists] = useState(false);
  const [testDataLoading, setTestDataLoading] = useState(false);
  const [testDataMessage, setTestDataMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  // Check if test data exists when dialog opens
  useEffect(() => {
    if (open) {
      checkTestDataExists();
    }
  }, [open]);

  const checkTestDataExists = async () => {
    try {
      const result = await api.seedTestData.exists();
      setTestDataExists(result.exists);
    } catch (error) {
      logError('Error checking test data', error);
    }
  };

  const handleSeedTestData = async () => {
    setTestDataLoading(true);
    setTestDataMessage(null);
    try {
      const result = await api.seedTestData.create();
      setTestDataExists(true);
      setTestDataMessage({
        type: 'success',
        text: `Test data created successfully! Created ${result.studentCount} students and ${result.teacherCount} teachers.`,
      });
      // Refresh after a short delay to show the message
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      setTestDataMessage({
        type: 'error',
        text: error.message || 'Failed to create test data. Please try again.',
      });
    } finally {
      setTestDataLoading(false);
    }
  };

  const handleDeleteTestData = async () => {
    if (!window.confirm('Are you sure you want to delete all test data? This action cannot be undone.')) {
      return;
    }
    setTestDataLoading(true);
    setTestDataMessage(null);
    try {
      await api.seedTestData.delete();
      setTestDataExists(false);
      setTestDataMessage({
        type: 'success',
        text: 'Test data deleted successfully!',
      });
      // Refresh after a short delay to show the message
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      setTestDataMessage({
        type: 'error',
        text: error.message || 'Failed to delete test data. Please try again.',
      });
    } finally {
      setTestDataLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordMessage(null);
    
    if (!currentPassword || !newPassword) {
      setPasswordMessage({ type: 'error', text: 'Please fill in all password fields' });
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    
    setPasswordLoading(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (result.success) {
        setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setPasswordMessage({ type: 'error', text: result.error || 'Failed to change password' });
      }
    } catch (error: any) {
      setPasswordMessage({ type: 'error', text: error.message || 'Failed to change password' });
    } finally {
      setPasswordLoading(false);
    }
  };

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
        {authStatus?.enabled && authStatus?.setup && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Security
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Change your password to keep your data secure.
              </Typography>
              {passwordMessage && (
                <Alert severity={passwordMessage.type} sx={{ mb: 2 }} onClose={() => setPasswordMessage(null)}>
                  {passwordMessage.text}
                </Alert>
              )}
              <form onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }}>
                <TextField
                  fullWidth
                  type="password"
                  label="Current Password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  margin="normal"
                  size="small"
                  autoComplete="current-password"
                />
                <TextField
                  fullWidth
                  type="password"
                  label="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  margin="normal"
                  size="small"
                  helperText="Minimum 6 characters"
                  autoComplete="new-password"
                />
                <TextField
                  fullWidth
                  type="password"
                  label="Confirm New Password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  margin="normal"
                  size="small"
                  autoComplete="new-password"
                />
                <Button
                  type="submit"
                  variant="outlined"
                  disabled={passwordLoading}
                  sx={{ mt: 1 }}
                  startIcon={passwordLoading ? <CircularProgress size={16} /> : null}
                >
                  Change Password
                </Button>
              </form>
            </Box>
          </>
        )}
        <Divider sx={{ my: 2 }} />
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Data Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Export your data for sharing or backup purposes.
          </Typography>
          <Button variant="outlined" fullWidth onClick={() => setExportOpen(true)} sx={{ mb: 2 }}>
            Export / Import Data
          </Button>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Database Backups
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Create and manage database backups. Backups are stored on the server.
          </Typography>
          <BackupManager />
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Test Data
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Create sample test data to help you explore the app. This will create a test school with teachers and students for grades K-5.
          </Typography>
          {testDataMessage && (
            <Alert severity={testDataMessage.type} sx={{ mb: 2 }} onClose={() => setTestDataMessage(null)}>
              {testDataMessage.text}
            </Alert>
          )}
          {testDataExists ? (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Test data already exists. You can delete it to create fresh test data.
              </Alert>
              <Button
                variant="outlined"
                color="error"
                fullWidth
                onClick={handleDeleteTestData}
                disabled={testDataLoading}
                startIcon={testDataLoading ? <CircularProgress size={16} /> : null}
              >
                Delete Test Data
              </Button>
            </Box>
          ) : (
            <Button
              variant="outlined"
              fullWidth
              onClick={handleSeedTestData}
              disabled={testDataLoading}
              startIcon={testDataLoading ? <CircularProgress size={16} /> : null}
            >
              Create Test Data
            </Button>
          )}
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

