import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useTheme,
  useMediaQuery,
  Button,
  FormControl,
  Select,
  MenuItem,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  EventNote as EventNoteIcon,
  TrendingUp as TrendingUpIcon,
  Lightbulb as LightbulbIcon,
  Settings as SettingsIcon,
  Description as DescriptionIcon,
  School as SchoolIcon,
  Add as AddIcon,
  Assessment as AssessmentIcon,
  AccessTime as AccessTimeIcon,
  Note as NoteIcon,
  DescriptionOutlined as DescriptionOutlinedIcon,
  Event as EventIcon,
  CalendarToday as CalendarTodayIcon,
} from '@mui/icons-material';
import { SettingsDialog } from './SettingsDialog';
import { useSchool } from '../context/SchoolContext';

const drawerWidth = 240;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'Students', icon: <PeopleIcon />, path: '/students' },
  { text: 'Schools', icon: <SchoolIcon />, path: '/schools' },
  { text: 'Sessions', icon: <EventNoteIcon />, path: '/sessions' },
  { text: 'Session Calendar', icon: <CalendarTodayIcon />, path: '/session-calendar' },
  { text: 'SOAP Notes', icon: <NoteIcon />, path: '/soap-notes' },
  { text: 'Progress', icon: <TrendingUpIcon />, path: '/progress' },
  { text: 'Progress Reports', icon: <DescriptionOutlinedIcon />, path: '/progress-reports' },
  { text: 'Due Date Items', icon: <EventIcon />, path: '/due-date-items' },
  { text: 'Evaluations', icon: <AssessmentIcon />, path: '/evaluations' },
  { text: 'Treatment Ideas', icon: <LightbulbIcon />, path: '/ideas' },
  { text: 'Documentation', icon: <DescriptionIcon />, path: '/documentation' },
  { text: 'Time Tracking', icon: <AccessTimeIcon />, path: '/time-tracking' },
];

interface LayoutProps {
  children: React.ReactNode;
}

// US State abbreviations
const US_STATES = [
  { value: '', label: 'Select State' },
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

export const Layout = ({ children }: LayoutProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addSchoolOpen, setAddSchoolOpen] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolState, setNewSchoolState] = useState('');
  const [newSchoolTeletherapy, setNewSchoolTeletherapy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { selectedSchool, setSelectedSchool, availableSchools, addSchool } = useSchool();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleAddSchool = () => {
    setAddSchoolOpen(true);
  };

  const handleCloseAddSchool = () => {
    setAddSchoolOpen(false);
    setNewSchoolName('');
    setNewSchoolState('');
    setNewSchoolTeletherapy(false);
  };

  const handleSaveNewSchool = async () => {
    if (newSchoolName.trim()) {
      await addSchool(newSchoolName.trim(), newSchoolState, newSchoolTeletherapy);
      handleCloseAddSchool();
    }
  };

  const handleSchoolChange = (value: string) => {
    if (value === '__add_school__') {
      handleAddSchool();
    } else {
      setSelectedSchool(value);
    }
  };

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          SLP Tracker
        </Typography>
      </Toolbar>
      <Divider />
      <Box sx={{ p: 2 }}>
        <FormControl fullWidth size="small">
          <Select
            value={selectedSchool}
            onChange={(e) => handleSchoolChange(e.target.value)}
            sx={{ fontSize: '0.875rem' }}
          >
            {availableSchools.map((school) => (
              <MenuItem key={school} value={school}>
                <SchoolIcon sx={{ mr: 1, fontSize: '1rem' }} />
                {school}
              </MenuItem>
            ))}
            <Divider />
            <MenuItem value="__add_school__">
              <AddIcon sx={{ mr: 1, fontSize: '1rem' }} />
              Add School
            </MenuItem>
          </Select>
        </FormControl>
      </Box>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                if (isMobile) setMobileOpen(false);
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  console.log('Layout rendering, mobileOpen:', mobileOpen, 'location:', location.pathname);
  
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: theme.palette.background.default }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            SLP Caseload Tracker
          </Typography>
          <Button
            color="inherit"
            startIcon={<SettingsIcon />}
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </Button>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
        }}
      >
        {children}
      </Box>
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <Dialog open={addSchoolOpen} onClose={handleCloseAddSchool} maxWidth="sm" fullWidth>
        <DialogTitle>Add New School</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              autoFocus
              margin="normal"
              label="School Name"
              fullWidth
              variant="outlined"
              value={newSchoolName}
              onChange={(e) => setNewSchoolName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newSchoolName.trim()) {
                  handleSaveNewSchool();
                }
              }}
            />
            <TextField
              select
              margin="normal"
              label="State"
              fullWidth
              variant="outlined"
              value={newSchoolState}
              onChange={(e) => setNewSchoolState(e.target.value)}
              SelectProps={{
                native: true,
              }}
              InputLabelProps={{
                shrink: true,
              }}
            >
              {US_STATES.map((state) => (
                <option key={state.value} value={state.value}>
                  {state.label}
                </option>
              ))}
            </TextField>
            <FormControlLabel
              control={
                <Checkbox
                  checked={newSchoolTeletherapy}
                  onChange={(e) => setNewSchoolTeletherapy(e.target.checked)}
                />
              }
              label="Teletherapy"
              sx={{ mt: 1 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddSchool}>Cancel</Button>
          <Button onClick={handleSaveNewSchool} variant="contained" disabled={!newSchoolName.trim()}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

