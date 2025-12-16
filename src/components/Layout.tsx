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
} from '@mui/icons-material';
import { SettingsDialog } from './SettingsDialog';
import { useSchool } from '../context/SchoolContext';

const drawerWidth = 240;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'Students', icon: <PeopleIcon />, path: '/students' },
  { text: 'Sessions', icon: <EventNoteIcon />, path: '/sessions' },
  { text: 'Progress', icon: <TrendingUpIcon />, path: '/progress' },
  { text: 'Treatment Ideas', icon: <LightbulbIcon />, path: '/ideas' },
  { text: 'Documentation', icon: <DescriptionIcon />, path: '/documentation' },
];

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addSchoolOpen, setAddSchoolOpen] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
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
  };

  const handleSaveNewSchool = () => {
    if (newSchoolName.trim()) {
      addSchool(newSchoolName.trim());
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
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: '#fafafa' }}>
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
          <TextField
            autoFocus
            margin="dense"
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
            sx={{ mt: 2 }}
          />
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

