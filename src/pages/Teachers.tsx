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
  TextField,
  Typography,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  UnfoldMore as UnfoldMoreIcon,
  UnfoldLess as UnfoldLessIcon,
} from '@mui/icons-material';
import type { Teacher } from '../types';
import {
  getTeachers,
  addTeacher,
  updateTeacher,
  deleteTeacher,
} from '../utils/storage-api';
import { generateId } from '../utils/helpers';
import { useConfirm } from '../hooks/useConfirm';
import { useDirty } from '../hooks/useDirty';
import { useSchool } from '../context/SchoolContext';
import { SearchBar } from '../components/SearchBar';
import { TeacherAccordionCard } from '../components/TeacherAccordionCard';

// Format phone number as user types: (XXX) XXX-XXXX
const formatPhoneNumber = (value: string): string => {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Limit to 10 digits
  const limitedDigits = digits.slice(0, 10);
  
  // Format based on length
  if (limitedDigits.length === 0) return '';
  if (limitedDigits.length <= 3) return `(${limitedDigits}`;
  if (limitedDigits.length <= 6) return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
  return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`;
};

// Strip formatting to get just digits
const stripPhoneFormatting = (value: string): string => {
  return value.replace(/\D/g, '');
};

// Format phone number for display: (XXX) XXX-XXXX
const formatPhoneForDisplay = (phoneNumber: string | undefined): string => {
  if (!phoneNumber) return '';
  const digits = stripPhoneFormatting(phoneNumber);
  if (digits.length !== 10) return phoneNumber; // Return as-is if not 10 digits
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export const Teachers = () => {
  const { selectedSchool, availableSchools } = useSchool();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<Teacher[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [formData, setFormData] = useState({
    name: '',
    grade: '',
    school: '',
    phoneNumber: '',
    emailAddress: '',
  });
  const [initialFormData, setInitialFormData] = useState(formData);
  const { confirm, ConfirmDialog } = useConfirm();

  // Check if form is dirty
  const isFormDirty = () => {
    if (!dialogOpen) return false;
    return (
      formData.name !== initialFormData.name ||
      formData.grade !== initialFormData.grade ||
      formData.school !== initialFormData.school ||
      formData.phoneNumber !== initialFormData.phoneNumber ||
      formData.emailAddress !== initialFormData.emailAddress
    );
  };

  // Use dirty hook to block navigation
  const { blocker, reset: resetDirty } = useDirty({
    isDirty: isFormDirty(),
    message: 'You have unsaved changes to this teacher. Are you sure you want to leave?',
  });

  const filterTeachers = () => {
    let filtered = teachers;
    
    // Filter by search term if provided
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const searchDigits = stripPhoneFormatting(term);
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(term) ||
          t.grade.toLowerCase().includes(term) ||
          (t.phoneNumber && (
            t.phoneNumber.toLowerCase().includes(term) ||
            stripPhoneFormatting(t.phoneNumber).includes(searchDigits)
          )) ||
          (t.emailAddress && t.emailAddress.toLowerCase().includes(term))
      );
    }
    
    // Maintain alphabetical order by name
    filtered.sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    setFilteredTeachers(filtered);
  };

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
      console.error('Failed to load teachers:', error);
    }
  };

  useEffect(() => {
    loadTeachers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchool]);

  useEffect(() => {
    filterTeachers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      };
    } else {
      setEditingTeacher(null);
      newFormData = {
        name: '',
        grade: '',
        school: selectedSchool,
        phoneNumber: '',
        emailAddress: '',
      };
    }
    setFormData(newFormData);
    setInitialFormData(newFormData);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    if (isFormDirty()) {
      confirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to close?',
        confirmText: 'Discard Changes',
        cancelText: 'Cancel',
        onConfirm: () => {
          setDialogOpen(false);
          setEditingTeacher(null);
          resetDirty();
        },
      });
    } else {
      setDialogOpen(false);
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
      };

      if (editingTeacher) {
        await updateTeacher(editingTeacher.id, teacherData);
        setSnackbar({
          open: true,
          message: 'Teacher updated successfully',
          severity: 'success',
        });
      } else {
        await addTeacher({
          id: generateId(),
          ...teacherData,
          dateCreated: new Date().toISOString(),
        });
        setSnackbar({
          open: true,
          message: 'Teacher created successfully',
          severity: 'success',
        });
      }
      await loadTeachers();
      resetDirty();
      setDialogOpen(false);
      setEditingTeacher(null);
    } catch (error: any) {
      console.error('Failed to save teacher:', error);
      const errorMessage = error?.message || 'Unknown error';
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

  const handleDelete = (id: string) => {
    const teacher = teachers.find(t => t.id === id);
    setConfirmDialog({
      open: true,
      title: 'Delete Teacher',
      message: `Are you sure you want to delete ${teacher?.name || 'this teacher'}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteTeacher(id);
          await loadTeachers();
          setConfirmDialog({ ...confirmDialog, open: false });
          setSnackbar({
            open: true,
            message: 'Teacher deleted successfully',
            severity: 'success',
          });
        } catch (error) {
          console.error('Failed to delete teacher:', error);
          alert('Failed to delete teacher. Please try again.');
        }
      },
    });
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

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              confirmDialog.onConfirm();
              setConfirmDialog({ ...confirmDialog, open: false });
            }}
            variant="contained"
            color="error"
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation dialog for unsaved changes */}
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
    </Box>
  );
};

