import { useState, useEffect } from 'react';
import { logError } from '../utils/logger';
import { getErrorMessage } from '../utils/validators';
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
  TextField,
  Typography,
  Snackbar,
  Alert,
  FormControlLabel,
  Checkbox,
  FormGroup,
  FormLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  UnfoldMore as UnfoldMoreIcon,
  UnfoldLess as UnfoldLessIcon,
  UploadFile as UploadFileIcon,
} from '@mui/icons-material';
import type { Teacher, CaseManager } from '../types';
import {
  getTeachers,
  addTeacher,
  updateTeacher,
  deleteTeacher,
  addCaseManager,
} from '../utils/storage-api';
import { ImportTeachersDialog } from '../components/ImportTeachersDialog';
import { generateId } from '../utils/helpers';
import { useConfirm, useDialog, useSnackbar, useFormValidation } from '../hooks';
import { useDirty } from '../hooks/useDirty';
import { useSchool } from '../context/SchoolContext';
import { SearchBar } from '../components/common/SearchBar';
import { TeacherAccordionCard } from '../components/TeacherAccordionCard';
import { formatPhoneNumber, formatPhoneForDisplay, stripPhoneFormatting } from '../utils/formatters';

export const Teachers = () => {
  const { selectedSchool, availableSchools } = useSchool();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<Teacher[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    grade: '',
    school: '',
    phoneNumber: '',
    emailAddress: '',
    gender: '' as '' | 'male' | 'female' | 'non-binary',
  });
  const [initialFormData, setInitialFormData] = useState(formData);
  
  // Dialog and snackbar hooks
  const teacherDialog = useDialog();
  const importDialog = useDialog();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const { confirm, ConfirmDialog } = useConfirm();
  const { hasError, getError, clearError, clearAllErrors, handleApiError } = useFormValidation();

  // Check if form is dirty
  const isFormDirty = () => {
    if (!teacherDialog.open) return false;
    return (
      formData.name !== initialFormData.name ||
      formData.grade !== initialFormData.grade ||
      formData.school !== initialFormData.school ||
      formData.phoneNumber !== initialFormData.phoneNumber ||
      formData.emailAddress !== initialFormData.emailAddress ||
      formData.gender !== initialFormData.gender
    );
  };

  // Use dirty hook to block navigation
  const { blocker, reset: resetDirty } = useDirty({
    isDirty: isFormDirty(),
    message: 'You have unsaved changes to this teacher. Are you sure you want to leave?',
  });

  const loadTeachers = async () => {
    if (!selectedSchool) {
      setTeachers([]);
      return;
    }
    try {
      const allTeachers = await getTeachers(selectedSchool);
      // Sort alphabetically by name
      const sortedTeachers = [...allTeachers].sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        return nameA.localeCompare(nameB);
      });
      setTeachers(sortedTeachers);
    } catch (error) {
      logError('Failed to load teachers', error);
    }
  };

  useEffect(() => {
    loadTeachers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchool]);

  useEffect(() => {
    // Filter by search term if provided
    const trimmedSearch = searchTerm?.trim() || '';
    
    if (trimmedSearch) {
      const term = trimmedSearch.toLowerCase();
      const searchDigits = stripPhoneFormatting(term);
      const beforeFilter = teachers.length;
      
      const filtered = teachers.filter((t) => {
        const name = (t.name || '').toLowerCase();
        const grade = (t.grade || '').toLowerCase();
        const phone = t.phoneNumber ? t.phoneNumber.toLowerCase() : '';
        const email = (t.emailAddress || '').toLowerCase();
        
        const nameMatch = name.includes(term);
        const gradeMatch = grade.includes(term);
        // Only check phone digits if search term contains digits (empty string .includes() always returns true)
        const phoneMatch = phone.includes(term) || (t.phoneNumber && searchDigits && stripPhoneFormatting(t.phoneNumber).includes(searchDigits));
        const emailMatch = email.includes(term);
        
        return nameMatch || gradeMatch || phoneMatch || emailMatch;
      });
      
      // Maintain alphabetical order by name
      filtered.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      setFilteredTeachers(filtered);
    } else {
      // No search term - show all teachers, sorted alphabetically
      const sorted = [...teachers].sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      setFilteredTeachers(sorted);
    }
  }, [searchTerm, teachers]);

  useEffect(() => {
    // Clean up expanded state for teachers that are no longer visible
    setExpandedTeachers((prev) => {
      const visibleIds = new Set(filteredTeachers.map((t) => t.id));
      return new Set([...prev].filter((id) => visibleIds.has(id)));
    });
  }, [filteredTeachers]);

  const handleOpenDialog = (teacher?: Teacher) => {
    let newFormData: typeof formData;
    if (teacher) {
      setEditingTeacher(teacher);
      newFormData = {
        name: teacher.name,
        grade: teacher.grade,
        school: teacher.school || selectedSchool,
        phoneNumber: teacher.phoneNumber ? formatPhoneForDisplay(teacher.phoneNumber) : '',
        emailAddress: teacher.emailAddress || '',
        gender: teacher.gender || '',
      };
    } else {
      setEditingTeacher(null);
      newFormData = {
        name: '',
        grade: '',
        school: selectedSchool,
        phoneNumber: '',
        emailAddress: '',
        gender: '' as '' | 'male' | 'female' | 'non-binary',
      };
    }
    setFormData(newFormData);
    setInitialFormData(newFormData);
    clearAllErrors();
    teacherDialog.openDialog();
  };

  const handleCloseDialog = () => {
    if (isFormDirty()) {
      confirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to close?',
        confirmText: 'Discard Changes',
        cancelText: 'Cancel',
        onConfirm: () => {
          teacherDialog.closeDialog();
          setEditingTeacher(null);
          resetDirty();
        },
      });
    } else {
      teacherDialog.closeDialog();
      setEditingTeacher(null);
      resetDirty();
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a teacher name');
      return;
    }

    // Validate phone number if provided
    const phoneDigits = stripPhoneFormatting(formData.phoneNumber);
    if (formData.phoneNumber.trim() && phoneDigits.length !== 10) {
      alert('Phone number must be exactly 10 digits');
      return;
    }

    // Validate email if provided
    const emailTrimmed = formData.emailAddress.trim();
    if (emailTrimmed && !emailTrimmed.includes('@')) {
      alert('Email address must contain an @ sign');
      return;
    }

    try {
      const teacherData = {
        name: formData.name.trim(),
        grade: formData.grade.trim(),
        school: formData.school.trim() || selectedSchool,
        phoneNumber: phoneDigits || undefined,
        emailAddress: emailTrimmed || undefined,
        gender: formData.gender || undefined,
      };

      if (editingTeacher) {
        await updateTeacher(editingTeacher.id, teacherData);
        showSnackbar('Teacher updated successfully', 'success');
      } else {
        await addTeacher({
          id: generateId(),
          ...teacherData,
          dateCreated: new Date().toISOString(),
        });
        showSnackbar('Teacher created successfully', 'success');
      }
      await loadTeachers();
      resetDirty();
      teacherDialog.closeDialog();
      setEditingTeacher(null);
    } catch (error: unknown) {
      if (handleApiError(error)) {
        // Validation errors are now displayed inline
        return;
      }
      logError('Failed to save teacher', error);
      const errorMessage = getErrorMessage(error);
      alert(`Failed to save teacher: ${errorMessage}\n\nMake sure the API server is running on http://localhost:3001`);
    }
  };

  const handleAccordionChange = (teacherId: string) => {
    setExpandedTeachers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(teacherId)) {
        newSet.delete(teacherId);
      } else {
        newSet.add(teacherId);
      }
      return newSet;
    });
  };

  const handleExpandAll = () => {
    if (expandedTeachers.size === filteredTeachers.length) {
      // Collapse all
      setExpandedTeachers(new Set());
    } else {
      // Expand all
      setExpandedTeachers(new Set(filteredTeachers.map((t) => t.id)));
    }
  };

  const handleDelete = (id: string, relatedStudents: any[]) => {
    const teacher = teachers.find(t => t.id === id);
    
    // Use the passed students (they should be loaded by the component)
    const students = relatedStudents || [];

    const hasRelatedStudents = students && students.length > 0;
    
    confirm({
      title: 'Delete Teacher',
      message: (
        <>
          {hasRelatedStudents ? (
            <>
              <strong>Warning:</strong> This teacher is assigned to {students.length} {students.length === 1 ? 'student' : 'students'}:
              <ul style={{ marginTop: '8px', marginBottom: '8px', paddingLeft: '20px' }}>
                {students.slice(0, 5).map((s: any) => (
                  <li key={s.id}>{s.name} ({s.grade})</li>
                ))}
                {students.length > 5 && <li>...and {students.length - 5} more</li>}
              </ul>
              Deleting this teacher will remove the assignment from all related students. Are you sure you want to proceed?
            </>
          ) : (
            `Are you sure you want to delete ${teacher?.name || 'this teacher'}? This action cannot be undone.`
          )}
        </>
      ),
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmColor: hasRelatedStudents ? 'warning' : 'error',
      onConfirm: async () => {
        try {
          await deleteTeacher(id);
          await loadTeachers();
          showSnackbar('Teacher deleted successfully', 'success');
        } catch (error) {
          logError('Failed to delete teacher', error);
          alert('Failed to delete teacher. Please try again.');
        }
      },
    });
  };

  const handleImport = async (importedTeachers: Teacher[], importedCaseManagers: CaseManager[]) => {
    try {
      // Add all teachers
      for (const teacher of importedTeachers) {
        await addTeacher(teacher);
      }
      
      // Add all case managers
      for (const caseManager of importedCaseManagers) {
        await addCaseManager(caseManager);
      }
      
      await loadTeachers();
      const totalImported = importedTeachers.length + importedCaseManagers.length;
      showSnackbar(
        `Successfully imported ${totalImported} ${totalImported === 1 ? 'person' : 'people'}`,
        'success'
      );
    } catch (error) {
      logError('Failed to import teachers', error);
      throw error;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" component="h1">
          Teachers
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {filteredTeachers.length > 0 && (
            <Button
              variant="outlined"
              startIcon={expandedTeachers.size === filteredTeachers.length ? <UnfoldLessIcon /> : <UnfoldMoreIcon />}
              onClick={handleExpandAll}
            >
              {expandedTeachers.size === filteredTeachers.length ? 'Collapse All' : 'Expand All'}
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => importDialog.openDialog()}
          >
            Import from Document
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Teacher
          </Button>
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search teachers by name, grade, phone, or email..."
        />
      </Box>

      <Grid container spacing={2}>
        {filteredTeachers.length === 0 ? (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <Typography color="text.secondary" gutterBottom>
                    {searchTerm
                      ? `No teachers found matching "${searchTerm}"`
                      : 'No teachers added yet. Click "Add Teacher" to get started.'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          filteredTeachers.map((teacher) => (
            <Grid item xs={12} sm={6} md={4} key={teacher.id}>
              <TeacherAccordionCard
                teacher={teacher}
                expanded={expandedTeachers.has(teacher.id)}
                onToggleExpand={() => handleAccordionChange(teacher.id)}
                onEdit={handleOpenDialog}
                onDelete={handleDelete}
                formatPhoneForDisplay={formatPhoneForDisplay}
              />
            </Grid>
          ))
        )}
      </Grid>

      <Dialog open={teacherDialog.open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              fullWidth
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                clearError('name');
              }}
              error={hasError('name')}
              helperText={getError('name')}
              required
              autoFocus
            />
            <TextField
              label="Grade"
              fullWidth
              value={formData.grade}
              onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
            />
            <TextField
              select
              label="School"
              fullWidth
              value={formData.school}
              onChange={(e) => setFormData({ ...formData, school: e.target.value })}
              SelectProps={{
                native: true,
              }}
              InputLabelProps={{
                shrink: true,
              }}
            >
              {availableSchools.map((school) => (
                <option key={school} value={school}>
                  {school}
                </option>
              ))}
            </TextField>
            <TextField
              label="Phone Number (Optional)"
              fullWidth
              value={formData.phoneNumber}
              onChange={(e) => {
                const formatted = formatPhoneNumber(e.target.value);
                setFormData({ ...formData, phoneNumber: formatted });
              }}
              placeholder="(612) 555-5555"
              helperText={formData.phoneNumber.trim() && stripPhoneFormatting(formData.phoneNumber).length !== 10 
                ? 'Phone number must be 10 digits' 
                : 'Enter 10-digit phone number'}
              error={formData.phoneNumber.trim() !== '' && stripPhoneFormatting(formData.phoneNumber).length !== 10}
            />
            <TextField
              label="Email Address (Optional)"
              fullWidth
              type="email"
              value={formData.emailAddress}
              onChange={(e) => setFormData({ ...formData, emailAddress: e.target.value })}
              placeholder="teacher@example.com"
              helperText={formData.emailAddress.trim() && !formData.emailAddress.includes('@')
                ? 'Email must contain an @ sign'
                : ''}
              error={formData.emailAddress.trim() !== '' && !formData.emailAddress.includes('@')}
            />
            <Box>
              <FormLabel component="legend">Gender (Optional)</FormLabel>
              <FormGroup row>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.gender === 'male'}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          gender: e.target.checked ? 'male' : '',
                        });
                      }}
                    />
                  }
                  label="Male"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.gender === 'female'}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          gender: e.target.checked ? 'female' : '',
                        });
                      }}
                    />
                  }
                  label="Female"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.gender === 'non-binary'}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          gender: e.target.checked ? 'non-binary' : '',
                        });
                      }}
                    />
                  }
                  label="Non-binary"
                />
              </FormGroup>
            </Box>
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

      {/* Navigation blocker confirmation */}
      {blocker.state === 'blocked' && (
        <Dialog open={true} onClose={() => blocker.reset?.()}>
          <DialogTitle>Unsaved Changes</DialogTitle>
          <DialogContent>
            <Typography>
              You have unsaved changes to this teacher. Are you sure you want to leave?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => blocker.reset?.()}>Cancel</Button>
            <Button
              onClick={() => {
                resetDirty();
                blocker.proceed?.();
              }}
              variant="contained"
              color="primary"
            >
              Discard Changes
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <SnackbarComponent />

      <ImportTeachersDialog
        open={importDialog.open}
        onClose={importDialog.closeDialog}
        onImport={handleImport}
      />
    </Box>
  );
};

