import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDialog } from '../hooks';
import { useAuth } from '../context/AuthContext';
import {
  AppBar,
  Box,
  Collapse,
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
  TrendingUp as TrendingUpIcon,
  Settings as SettingsIcon,
  Description as DescriptionIcon,
  School as SchoolIcon,
  Add as AddIcon,
  Assessment as AssessmentIcon,
  AccessTime as AccessTimeIcon,
  CalendarToday as CalendarTodayIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Logout as LogoutIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
} from '@mui/icons-material';
import { SettingsDialog } from './settings/SettingsDialog';
import { useSchool } from '../context/SchoolContext';

const drawerWidth = 240;

// Menu item: either a link (path) or a section with sub-items
type MenuLink = { text: string; icon?: React.ReactNode; path: string };
type MenuSection = {
  text: string;
  icon: React.ReactNode;
  items: { text: string; path: string }[];
};
type MenuItem = MenuLink | MenuSection;

const isSection = (item: MenuItem): item is MenuSection => 'items' in item;

const menuStructure: MenuItem[] = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  {
    text: 'Planning',
    icon: <CalendarTodayIcon />,
    items: [
      { text: 'Calendar', path: '/session-calendar' },
      { text: 'Session History', path: '/sessions' },
    ],
  },
  {
    text: 'People',
    icon: <PeopleIcon />,
    items: [
      { text: 'Students', path: '/students' },
      { text: 'Teachers', path: '/teachers' },
      { text: 'Case Managers', path: '/case-managers' },
      { text: 'Schools', path: '/schools' },
    ],
  },
  {
    text: 'Clinical',
    icon: <AssessmentIcon />,
    items: [
      { text: 'Evaluations', path: '/evaluations' },
      { text: 'SOAP Notes', path: '/soap-notes' },
      { text: 'IEP Notes', path: '/iep-notes' },
      { text: 'Treatment Ideas', path: '/ideas' },
    ],
  },
  {
    text: 'Progress & Reporting',
    icon: <TrendingUpIcon />,
    items: [
      { text: 'Progress Tracking', path: '/progress' },
      { text: 'Progress Reports', path: '/progress-reports' },
      { text: 'Due Date Items', path: '/due-date-items' },
    ],
  },
  {
    text: 'Administrative',
    icon: <AdminPanelSettingsIcon />,
    items: [
      { text: 'Documentation', path: '/documentation' },
      { text: 'Communications', path: '/communications' },
      { text: 'Time Tracking', path: '/time-tracking' },
    ],
  },
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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    // Initialize all sections expanded
    const initial: Record<string, boolean> = {};
    menuStructure.forEach((item, idx) => {
      if (isSection(item)) {
        initial[item.text] = true;
      }
    });
    return initial;
  });
  const settingsDialog = useDialog();
  const addSchoolDialog = useDialog();
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolState, setNewSchoolState] = useState('');
  const [newSchoolTeletherapy, setNewSchoolTeletherapy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { logout, authStatus } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };
  const { selectedSchool, setSelectedSchool, availableSchools, addSchool } = useSchool();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleAddSchool = () => {
    addSchoolDialog.openDialog();
  };

  const handleCloseAddSchool = () => {
    addSchoolDialog.closeDialog();
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

  // Auto-expand section containing current path
  useEffect(() => {
    const path = location.pathname;
    menuStructure.forEach((item) => {
      if (isSection(item) && item.items.some((sub) => path === sub.path || path.startsWith(sub.path + '/'))) {
        setExpandedSections((prev) => ({ ...prev, [item.text]: true }));
      }
    });
  }, [location.pathname]);

  const toggleSection = (sectionText: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionText]: !prev[sectionText] }));
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
        {menuStructure.map((item) => {
          if (isSection(item)) {
            const isExpanded = expandedSections[item.text] !== false;
            const hasActiveChild = item.items.some(
              (sub) => location.pathname === sub.path || location.pathname.startsWith(sub.path + '/')
            );
            return (
              <Box key={item.text}>
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => toggleSection(item.text)}
                    sx={{ py: 0.5 }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{ variant: 'body2', fontWeight: hasActiveChild ? 600 : 400 }}
                    />
                    {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </ListItemButton>
                </ListItem>
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {item.items.map((sub) => (
                      <ListItem key={sub.path} disablePadding>
                        <ListItemButton
                          selected={location.pathname === sub.path}
                          onClick={() => {
                            navigate(sub.path);
                            if (isMobile) setMobileOpen(false);
                          }}
                          sx={{ pl: 4, py: 0.5 }}
                        >
                          <ListItemText primary={sub.text} primaryTypographyProps={{ variant: 'body2' }} />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </Box>
            );
          }
          const linkItem = item as MenuLink;
          return (
            <ListItem key={linkItem.text} disablePadding>
              <ListItemButton
                selected={location.pathname === linkItem.path}
                onClick={() => {
                  navigate(linkItem.path);
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{ py: 0.5 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{linkItem.icon}</ListItemIcon>
                <ListItemText primary={linkItem.text} primaryTypographyProps={{ variant: 'body2' }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
  
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
            onClick={settingsDialog.openDialog}
          >
            Settings
          </Button>
          {authStatus?.enabled && (
            <Button
              color="inherit"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              sx={{ ml: 1 }}
            >
              Logout
            </Button>
          )}
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
        open={settingsDialog.open}
        onClose={settingsDialog.closeDialog}
      />
      <Dialog open={addSchoolDialog.open} onClose={handleCloseAddSchool} maxWidth="sm" fullWidth>
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

