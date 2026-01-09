import { useState, useEffect } from 'react';
import { logError, logWarn } from '../utils/logger';
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
  Snackbar,
  Alert,
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
import { useConfirm, useDialog, useSnackbar, useFormValidation } from '../hooks';
import { ApiError } from '../utils/api';
import { getStudents } from '../utils/storage-api';
import { SchoolCard } from '../components/SchoolCard';
import { SchoolFormDialog } from '../components/SchoolFormDialog';
import { SchoolSearchBar } from '../components/SchoolSearchBar';

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
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  
  // Dialog and snackbar hooks
  const schoolDialog = useDialog();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const { confirm, ConfirmDialog } = useConfirm();
  const { fieldErrors, hasError, getError, clearError, handleApiError, clearAllErrors } = useFormValidation();

  const [formData, setFormData] = useState({
    name: '',
    state: '',
    teletherapy: false,
    schoolHours: {
      startHour: 8,
      endHour: 17,
    },
  });

  const loadSchools = async () => {
    try {
      // Get all existing schools first
      let allSchoolObjects = await getSchools();
      const schoolNames = new Set(allSchoolObjects.map(s => s.name.toLowerCase()));
      
      // Also check for schools that exist in students but not as School objects
      // and create School objects for them (but check for duplicates case-insensitively)
      const students = await getStudents();
      const schoolsToCreate = new Set<string>();
      
      for (const student of students) {
        if (student.school && student.school.trim()) {
          const schoolName = student.school.trim();
          const schoolNameLower = schoolName.toLowerCase();
          
          // Check if a school with this name (case-insensitive) already exists
          const existingSchool = allSchoolObjects.find(
            s => s.name.toLowerCase() === schoolNameLower
          );
          
          if (!existingSchool && !schoolsToCreate.has(schoolNameLower)) {
            // This school exists in students but not as a School object
            // Add to set to prevent duplicates in this batch
            schoolsToCreate.add(schoolNameLower);
          }
        }
      }
      
      // Create all new schools (but check again after each creation to avoid duplicates)
      for (const schoolNameLower of schoolsToCreate) {
        // Re-check if school exists (in case it was just created or already exists)
        allSchoolObjects = await getSchools();
        const existingSchool = allSchoolObjects.find(
          s => s.name.toLowerCase() === schoolNameLower
        );
        
        if (existingSchool) {
          // School already exists, skip creation
          continue;
        }
        
        // Find the original case from students
        const studentWithSchool = students.find(
          s => s.school && s.school.trim().toLowerCase() === schoolNameLower
        );
        if (studentWithSchool && studentWithSchool.school) {
          const schoolName = studentWithSchool.school.trim();
          const newSchool: School = {
            id: generateId(),
            name: schoolName,
            state: '',
            teletherapy: false,
            dateCreated: new Date().toISOString(),
          };
          try {
            await addSchool(newSchool);
            // Reload schools after creation to get updated list
            allSchoolObjects = await getSchools();
          } catch (error) {
            // If school creation fails (e.g., duplicate), just continue
            logWarn(`Failed to create school ${schoolName}`, error);
          }
        }
      }
      
      // Final reload to get all schools
      allSchoolObjects = await getSchools();
      // Sort alphabetically by name
      const sorted = [...allSchoolObjects].sort((a, b) => 
        a.name.localeCompare(b.name)
      );
      setSchools(sorted);
    } catch (error) {
      logError('Failed to load schools', error);
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
        schoolHours: school.schoolHours || { startHour: 8, endHour: 17 },
      });
    } else {
      setEditingSchool(null);
      setFormData({
        name: '',
        state: '',
        teletherapy: false,
        schoolHours: {
          startHour: 8,
          endHour: 17,
        },
      });
    }
    clearAllErrors(); // Clear any previous validation errors
    schoolDialog.openDialog();
  };

  const handleCloseDialog = () => {
    schoolDialog.closeDialog();
    setEditingSchool(null);
    setFormData({
      name: '',
      state: '',
      teletherapy: false,
      schoolHours: {
        startHour: 8,
        endHour: 17,
      },
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      return;
    }

    try {
      const schoolData = {
        name: formData.name.trim(),
        state: formData.state,
        teletherapy: formData.teletherapy,
        schoolHours: formData.schoolHours,
      };
      
      if (editingSchool) {
        await updateSchool(editingSchool.id, schoolData);
        showSnackbar('School updated successfully', 'success');
      } else {
        await addSchool({
          id: generateId(),
          ...schoolData,
          dateCreated: new Date().toISOString(),
        });
        showSnackbar('School created successfully', 'success');
      }
      await loadSchools();
      handleCloseDialog();
    } catch (error) {
      logError('Failed to save school', error);
      
      // Handle validation errors from the API
      if (error instanceof ApiError && handleApiError(error)) {
        showSnackbar('Please fix the validation errors', 'error');
        return;
      }
      
      showSnackbar(`Failed to save school: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const school = schools.find(s => s.id === id);
    confirm({
      title: 'Delete School',
      message: `Are you sure you want to delete ${school?.name || 'this school'}? This will not delete students associated with this school.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await deleteSchool(id);
          // Reload schools after deletion
          await loadSchools();
          showSnackbar('School deleted successfully', 'success');
        } catch (error) {
          logError('Failed to delete school', error);
          alert(`Failed to delete school: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
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

      <SchoolSearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />

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
              <SchoolCard
                school={school}
                getStateLabel={getStateLabel}
                onEdit={handleOpenDialog}
                onDelete={handleDelete}
              />
            </Grid>
          ))
        )}
      </Grid>

      <SchoolFormDialog
        open={schoolDialog.open}
        editingSchool={editingSchool}
        formData={formData}
        states={US_STATES}
        onClose={handleCloseDialog}
        onSave={handleSave}
        onFormDataChange={(updates) => setFormData({ ...formData, ...updates })}
        fieldErrors={fieldErrors}
        onClearError={clearError}
      />

      <ConfirmDialog />

      <SnackbarComponent />
    </Box>
  );
};

