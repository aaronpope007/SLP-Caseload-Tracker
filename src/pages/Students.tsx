import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  IconButton,
  TextField,
  Typography,
  Menu,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  ExpandMore as ExpandMoreIcon,
  UnfoldMore as UnfoldMoreIcon,
  UnfoldLess as UnfoldLessIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import type { Student } from '../types';
import {
  getStudents,
  addStudent,
  updateStudent,
  deleteStudent,
} from '../utils/storage-api';
import { generateId } from '../utils/helpers';
import { useSchool } from '../context/SchoolContext';
import { useConfirm } from '../hooks/useConfirm';
import { useDirty } from '../hooks/useDirty';

export const Students = () => {
  const navigate = useNavigate();
  const { selectedSchool, availableSchools } = useSchool();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
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
    age: '',
    grade: '',
    concerns: '',
    exceptionality: '',
    status: 'active' as 'active' | 'discharged',
    school: '',
  });
  const [initialFormData, setInitialFormData] = useState(formData);
  const { confirm, ConfirmDialog } = useConfirm();

  // Check if form is dirty
  const isFormDirty = () => {
    if (!dialogOpen) return false;
    return (
      formData.name !== initialFormData.name ||
      formData.age !== initialFormData.age ||
      formData.grade !== initialFormData.grade ||
      formData.concerns !== initialFormData.concerns ||
      formData.exceptionality !== initialFormData.exceptionality ||
      formData.status !== initialFormData.status ||
      formData.school !== initialFormData.school
    );
  };

  // Use dirty hook to block navigation
  const { blocker, reset: resetDirty } = useDirty({
    isDirty: isFormDirty(),
    message: 'You have unsaved changes to this student. Are you sure you want to leave?',
  });

  const filterStudents = () => {
    // First filter by archived status (archived is optional for backward compatibility)
    let filtered = students.filter(s => showArchived ? s.archived === true : !s.archived);
    
    // Then filter by search term if provided
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.grade.toLowerCase().includes(term) ||
          s.concerns.some((c) => c.toLowerCase().includes(term))
      );
    }
    
    // Maintain alphabetical order by first name
    filtered.sort((a, b) => {
      const firstNameA = a.name.split(' ')[0].toLowerCase();
      const firstNameB = b.name.split(' ')[0].toLowerCase();
      return firstNameA.localeCompare(firstNameB);
    });
    
    setFilteredStudents(filtered);
  };

  const loadStudents = async () => {
    if (!selectedSchool) {
      console.warn('No school selected, cannot load students');
      setStudents([]);
      return;
    }
    console.log('Loading students for school:', selectedSchool);
    
    try {
      // First, check if ANY students exist (without school filter)
      const allStudentsUnfiltered = await getStudents();
      console.log('Total students in storage (no filter):', allStudentsUnfiltered.length);
      
      // Then filter by school
      const allStudents = await getStudents(selectedSchool);
      console.log('Found students:', allStudents.length, 'for school:', selectedSchool);
      
      // If no students found for this school but students exist, show a warning
      if (allStudents.length === 0 && allStudentsUnfiltered.length > 0) {
        console.warn('⚠️ Students exist but none match the selected school!');
        console.log('Selected school:', selectedSchool);
        console.log('Available school names in students:', [...new Set(allStudentsUnfiltered.map(s => s.school || 'NO SCHOOL'))]);
      }
      
      // Sort alphabetically by first name
      const sortedStudents = [...allStudents].sort((a, b) => {
        const firstNameA = a.name.split(' ')[0].toLowerCase();
        const firstNameB = b.name.split(' ')[0].toLowerCase();
        return firstNameA.localeCompare(firstNameB);
      });
      setStudents(sortedStudents);
    } catch (error) {
      console.error('Failed to load students:', error);
    }
  };

  useEffect(() => {
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchool]);

  useEffect(() => {
    filterStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, students, showArchived]);

  useEffect(() => {
    // Clean up expanded state for students that are no longer visible
    setExpandedStudents((prev) => {
      const visibleIds = new Set(filteredStudents.map((s) => s.id));
      return new Set([...prev].filter((id) => visibleIds.has(id)));
    });
  }, [filteredStudents]);

  const handleOpenDialog = (student?: Student, prefillName?: string) => {
    let newFormData: typeof formData;
    if (student) {
      setEditingStudent(student);
      newFormData = {
        name: student.name,
        age: student.age > 0 ? student.age.toString() : '',
        grade: student.grade,
        concerns: student.concerns.join(', '),
        exceptionality: (student.exceptionality || []).join(', '),
        status: student.status,
        school: student.school || selectedSchool,
      };
    } else {
      setEditingStudent(null);
      newFormData = {
        name: prefillName || '',
        age: '',
        grade: '',
        concerns: '',
        exceptionality: '',
        status: 'active' as 'active' | 'discharged',
        school: selectedSchool,
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
          setEditingStudent(null);
          resetDirty();
        },
      });
    } else {
      setDialogOpen(false);
      setEditingStudent(null);
      resetDirty();
    }
  };

  const handleSave = async () => {
    // Age is optional - only validate if provided
    const ageValue = formData.age.trim() === '' ? undefined : parseInt(formData.age);
    if (ageValue !== undefined && (isNaN(ageValue) || ageValue < 1)) {
      alert('Please enter a valid age of 1 or greater, or leave it blank');
      return;
    }

    const concernsArray = formData.concerns
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    const exceptionalityArray = formData.exceptionality
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    try {
      if (editingStudent) {
        await updateStudent(editingStudent.id, {
          name: formData.name,
          age: ageValue ?? 0,
          grade: formData.grade,
          concerns: concernsArray,
          exceptionality: exceptionalityArray.length > 0 ? exceptionalityArray : undefined,
          status: formData.status,
          school: formData.school || selectedSchool,
        });
      } else {
        await addStudent({
          id: generateId(),
          name: formData.name,
          age: ageValue ?? 0,
          grade: formData.grade,
          concerns: concernsArray,
          exceptionality: exceptionalityArray.length > 0 ? exceptionalityArray : undefined,
          status: formData.status,
          dateAdded: new Date().toISOString(),
          school: formData.school || selectedSchool,
        });
      }
      await loadStudents();
      resetDirty();
      setDialogOpen(false);
      setEditingStudent(null);
    } catch (error: any) {
      console.error('Failed to save student:', error);
      const errorMessage = error?.message || 'Unknown error';
      alert(`Failed to save student: ${errorMessage}\n\nMake sure the API server is running on http://localhost:3001`);
    }
  };

  const handleDelete = (id: string) => {
    const student = students.find(s => s.id === id);
    handleMenuClose(); // Close menu when dialog opens
    setConfirmDialog({
      open: true,
      title: 'Delete Student',
      message: `Are you sure you want to delete ${student?.name || 'this student'}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteStudent(id);
          await loadStudents();
          setConfirmDialog({ ...confirmDialog, open: false });
        } catch (error) {
          console.error('Failed to delete student:', error);
          alert('Failed to delete student. Please try again.');
        }
      },
    });
  };

  const handleArchive = (id: string, archive: boolean) => {
    const student = students.find(s => s.id === id);
    handleMenuClose(); // Close menu when dialog opens
    setConfirmDialog({
      open: true,
      title: archive ? 'Archive Student' : 'Unarchive Student',
      message: archive
        ? `Are you sure you want to archive ${student?.name || 'this student'}? Archived students can be viewed in the Archived view.`
        : `Are you sure you want to unarchive ${student?.name || 'this student'}?`,
      onConfirm: async () => {
        try {
          await updateStudent(id, {
            archived: archive,
            dateArchived: archive ? new Date().toISOString() : undefined,
          });
          await loadStudents();
          setConfirmDialog({ ...confirmDialog, open: false });
        } catch (error) {
          console.error('Failed to archive student:', error);
          alert('Failed to archive student. Please try again.');
        }
      },
    });
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, studentId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedStudent(studentId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedStudent(null);
  };

  const handleViewDetails = (studentId: string) => {
    navigate(`/students/${studentId}`);
    handleMenuClose();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredStudents.length === 1) {
      handleViewDetails(filteredStudents[0].id);
    }
  };

  const handleAccordionChange = (studentId: string) => {
    setExpandedStudents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const handleExpandAll = () => {
    if (expandedStudents.size === filteredStudents.length) {
      // Collapse all
      setExpandedStudents(new Set());
    } else {
      // Expand all
      setExpandedStudents(new Set(filteredStudents.map((s) => s.id)));
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" component="h1">
          {showArchived ? 'Archived Students' : 'Students'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant={showArchived ? 'outlined' : 'contained'}
            onClick={() => setShowArchived(false)}
          >
            Active
          </Button>
          <Button
            variant={showArchived ? 'contained' : 'outlined'}
            startIcon={<ArchiveIcon />}
            onClick={() => setShowArchived(true)}
          >
            Archived
          </Button>
          {filteredStudents.length > 0 && (
            <Button
              variant="outlined"
              startIcon={expandedStudents.size === filteredStudents.length ? <UnfoldLessIcon /> : <UnfoldMoreIcon />}
              onClick={handleExpandAll}
            >
              {expandedStudents.size === filteredStudents.length ? 'Collapse All' : 'Expand All'}
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Student
          </Button>
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder={`Search ${showArchived ? 'archived ' : ''}students by name, grade, or concerns...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleSearchKeyDown}
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
        {filteredStudents.length === 0 ? (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <Typography color="text.secondary" gutterBottom>
                    {searchTerm
                      ? `No ${showArchived ? 'archived ' : ''}students found matching "${searchTerm}"`
                      : showArchived
                      ? 'No archived students'
                      : 'No students added yet. Click "Add Student" to get started.'}
                  </Typography>
                  {searchTerm && searchTerm.trim().length > 0 && !showArchived && (
                    <Box sx={{ mt: 2 }}>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => {
                          setFormData({
                            name: searchTerm.trim(),
                            age: '',
                            grade: '',
                            concerns: '',
                            exceptionality: '',
                            status: 'active',
                            school: selectedSchool,
                          });
                          setEditingStudent(null);
                          setDialogOpen(true);
                        }}
                      >
                        Create New Student: {searchTerm.trim()}
                      </Button>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          filteredStudents.map((student) => (
            <Grid item xs={12} sm={6} md={4} key={student.id}>
              <Accordion
                expanded={expandedStudents.has(student.id)}
                onChange={() => handleAccordionChange(student.id)}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    '& .MuiAccordionSummary-content': {
                      alignItems: 'center',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 1 }}>
                    <Typography variant="h6">{student.name}</Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuOpen(e, student.id);
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    <Typography color="text.secondary" gutterBottom>
                      {student.age > 0 ? `Age: ${student.age}` : ''}{student.age > 0 && student.grade ? ' | ' : ''}{student.grade ? `Grade: ${student.grade}` : ''}
                    </Typography>
                    <Box sx={{ mt: 1, mb: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      <Chip
                        label={student.status}
                        size="small"
                        color={student.status === 'active' ? 'primary' : 'default'}
                      />
                      {student.archived && (
                        <Chip
                          label="Archived"
                          size="small"
                          color="default"
                          variant="outlined"
                        />
                      )}
                    </Box>
                    {student.concerns.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Concerns:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                          {student.concerns.map((concern, idx) => (
                            <Chip
                              key={idx}
                              label={concern}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                    {student.exceptionality && student.exceptionality.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Exceptionality:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                          {student.exceptionality.map((except, idx) => (
                            <Chip
                              key={idx}
                              label={except}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>
            </Grid>
          ))
        )}
      </Grid>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingStudent ? 'Edit Student' : 'Add New Student'}
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
              label="Age (optional)"
              type="number"
              fullWidth
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              inputProps={{ min: 1 }}
              helperText={formData.age && parseInt(formData.age) < 1 ? 'Age must be at least 1' : 'Leave blank if unknown'}
              error={formData.age !== '' && parseInt(formData.age) < 1}
            />
            <TextField
              label="Grade"
              fullWidth
              value={formData.grade}
              onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
            />
            <TextField
              label="Concerns (comma-separated)"
              fullWidth
              multiline
              rows={3}
              value={formData.concerns}
              onChange={(e) => setFormData({ ...formData, concerns: e.target.value })}
              helperText="e.g., Articulation, Language, Fluency"
            />
            <TextField
              label="Exceptionality (comma-separated)"
              fullWidth
              multiline
              rows={2}
              value={formData.exceptionality}
              onChange={(e) => setFormData({ ...formData, exceptionality: e.target.value })}
              helperText="e.g., ASD, DD, SLI"
            />
            <TextField
              select
              label="Status"
              fullWidth
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as 'active' | 'discharged',
                })
              }
              SelectProps={{
                native: true,
              }}
            >
              <option value="active">Active</option>
              <option value="discharged">Discharged</option>
            </TextField>
            <TextField
              select
              label="School"
              fullWidth
              value={formData.school}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  school: e.target.value,
                })
              }
              SelectProps={{
                native: true,
              }}
            >
              {availableSchools.map((school) => (
                <option key={school} value={school}>
                  {school}
                </option>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            disabled={!formData.name}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => selectedStudent && handleViewDetails(selectedStudent)}>
          <EditIcon sx={{ mr: 1 }} /> View and Edit Goals
        </MenuItem>
        <MenuItem
          onClick={() => selectedStudent && handleOpenDialog(students.find(s => s.id === selectedStudent))}
        >
          <EditIcon sx={{ mr: 1 }} /> Edit
        </MenuItem>
        {selectedStudent && students.find(s => s.id === selectedStudent)?.archived ? (
          <MenuItem
            onClick={() => selectedStudent && handleArchive(selectedStudent, false)}
          >
            <UnarchiveIcon sx={{ mr: 1 }} /> Unarchive
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => selectedStudent && handleArchive(selectedStudent, true)}
          >
            <ArchiveIcon sx={{ mr: 1 }} /> Archive
          </MenuItem>
        )}
        <MenuItem
          onClick={() => selectedStudent && handleDelete(selectedStudent)}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>

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
            color={confirmDialog.title.includes('Delete') ? 'error' : 'primary'}
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
              You have unsaved changes to this student. Are you sure you want to leave?
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

