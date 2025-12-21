import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  IconButton,
  TextField,
  Typography,
  Chip,
  InputAdornment,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  School as SchoolIcon,
  LocationOn as LocationOnIcon,
  Videocam as VideocamIcon,
} from '@mui/icons-material';
import type { School } from '../types';
import {
  getSchools,
  addSchool,
  updateSchool,
  deleteSchool,
} from '../utils/storage-api';
import { generateId } from '../utils/helpers';
import { useSchool } from '../context/SchoolContext';
import { useConfirm } from '../hooks/useConfirm';
import { getStudents } from '../utils/storage-api';

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

export const Schools = () => {
  const { } = useSchool();
  const [schools, setSchools] = useState<School[]>([]);
  const [filteredSchools, setFilteredSchools] = useState<School[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const [formData, setFormData] = useState({
    name: '',
    state: '',
    teletherapy: false,
  });

  const loadSchools = async () => {
    try {
      const allSchoolObjects = await getSchools();
    const schoolNames = new Set(allSchoolObjects.map(s => s.name.toLowerCase()));
    
      // Also check for schools that exist in students but not as School objects
      // and create School objects for them
      const students = await getStudents();
      for (const student of students) {
        if (student.school && student.school.trim()) {
          const schoolName = student.school.trim();
          if (!schoolNames.has(schoolName.toLowerCase())) {
            // This school exists in students but not as a School object
            // Create a School object for it
            const newSchool: School = {
              id: generateId(),
              name: schoolName,
              state: '',
              teletherapy: false,
              dateCreated: new Date().toISOString(),
            };
            await addSchool(newSchool);
            schoolNames.add(schoolName.toLowerCase());
          }
        }
      }
      
      // Reload to get the newly created schools
      const allSchools = await getSchools();
      // Sort alphabetically by name
      const sorted = [...allSchools].sort((a, b) => 
        a.name.localeCompare(b.name)
      );
      setSchools(sorted);
    } catch (error) {
      console.error('Failed to load schools:', error);
    }
  };

  useEffect(() => {
    loadSchools();
  }, []);

  useEffect(() => {
    filterSchools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, schools]);

  const filterSchools = () => {
    let filtered = schools;
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.state.toLowerCase().includes(term)
      );
    }
    
    setFilteredSchools(filtered);
  };


  const handleOpenDialog = (school?: School) => {
    if (school) {
      setEditingSchool(school);
      setFormData({
        name: school.name,
        state: school.state || '',
        teletherapy: school.teletherapy || false,
      });
    } else {
      setEditingSchool(null);
      setFormData({
        name: '',
        state: '',
        teletherapy: false,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSchool(null);
    setFormData({
      name: '',
      state: '',
      teletherapy: false,
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      return;
    }

    if (editingSchool) {
      await updateSchool(editingSchool.id, {
        name: formData.name.trim(),
        state: formData.state,
        teletherapy: formData.teletherapy,
      });
    } else {
      await addSchool({
        id: generateId(),
        name: formData.name.trim(),
        state: formData.state,
        teletherapy: formData.teletherapy,
        dateCreated: new Date().toISOString(),
      });
    }
    loadSchools();
    handleCloseDialog();
  };

  const handleDelete = (id: string) => {
    const school = schools.find(s => s.id === id);
    confirm({
      title: 'Delete School',
      message: `Are you sure you want to delete ${school?.name || 'this school'}? This will not delete students associated with this school.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        await deleteSchool(id);
        loadSchools();
      },
    });
  };

  const getStateLabel = (stateCode: string): string => {
    const state = US_STATES.find(s => s.value === stateCode);
    return state ? state.label : stateCode;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" component="h1">
          Schools
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add School
        </Button>
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search schools by name or state..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton
                  edge="end"
                  onClick={() => setSearchTerm('')}
                  size="small"
                  aria-label="clear search"
                >
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Grid container spacing={2}>
        {filteredSchools.length === 0 ? (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <Typography color="text.secondary" gutterBottom>
                    {searchTerm
                      ? `No schools found matching "${searchTerm}"`
                      : 'No schools added yet. Click "Add School" to get started.'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          filteredSchools.map((school) => (
            <Grid item xs={12} sm={6} md={4} key={school.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                      <SchoolIcon color="primary" />
                      <Typography variant="h6" component="div">
                        {school.name}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(school)}
                        aria-label="edit school"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(school.id)}
                        aria-label="delete school"
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                    {school.state && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <LocationOnIcon fontSize="small" color="action" />
                        <Chip
                          label={getStateLabel(school.state)}
                          size="small"
                          variant="outlined"
                          color="primary"
                        />
                      </Box>
                    )}
                    {school.teletherapy && (
                      <Chip
                        icon={<VideocamIcon />}
                        label="Teletherapy"
                        size="small"
                        variant="outlined"
                        color="success"
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingSchool ? 'Edit School' : 'Add New School'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="School Name"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              autoFocus
              margin="normal"
            />
            <TextField
              select
              label="State"
              fullWidth
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              SelectProps={{
                native: true,
              }}
              margin="normal"
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
                  checked={formData.teletherapy}
                  onChange={(e) => setFormData({ ...formData, teletherapy: e.target.checked })}
                />
              }
              label="Teletherapy"
              sx={{ mt: 1 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!formData.name.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog />
    </Box>
  );
};

