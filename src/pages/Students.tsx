import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Archive as ArchiveIcon,
  UnfoldMore as UnfoldMoreIcon,
  UnfoldLess as UnfoldLessIcon,
} from '@mui/icons-material';
import type { Student, Teacher, CaseManager } from '../types';
import {
  getStudents,
  addStudent,
  updateStudent,
  deleteStudent,
  getTeachers,
  getCaseManagers,
  getGoalsByStudent,
} from '../utils/storage-api';
import { generateId } from '../utils/helpers';
import { useSchool } from '../context/SchoolContext';
import { useConfirm, useDialog, useSnackbar, useFormValidation } from '../hooks';
import { useDirty } from '../hooks/useDirty';
import { ApiError } from '../utils/api';
import { SearchBar } from '../components/common/SearchBar';
import { StudentAccordionCard } from '../components/student/StudentAccordionCard';
import { logError, logWarn } from '../utils/logger';
import { getErrorMessage } from '../utils/validators';

export const Students = () => {
  const navigate = useNavigate();
  const { selectedSchool, availableSchools } = useSchool();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [caseManagers, setCaseManagers] = useState<CaseManager[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [studentsWithNoGoals, setStudentsWithNoGoals] = useState<Set<string>>(new Set());
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  
  // Dialog and snackbar hooks
  const studentDialog = useDialog();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const { fieldErrors, hasError, getError, clearError, handleApiError, clearAllErrors } = useFormValidation();

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    grade: '',
    concerns: '',
    exceptionality: '',
    status: 'active' as 'active' | 'discharged',
    school: '',
    teacherId: '',
    caseManagerId: '',
    iepDate: '',
    annualReviewDate: '',
    progressReportFrequency: 'quarterly' as 'quarterly' | 'annual',
    frequencyPerWeek: '',
    frequencyType: 'per-week' as 'per-week' | 'per-month',
  });
  const [initialFormData, setInitialFormData] = useState(formData);
  const { confirm, ConfirmDialog } = useConfirm();

  // Check if form is dirty
  const isFormDirty = () => {
    if (!studentDialog.open) return false;
    return (
      formData.name !== initialFormData.name ||
      formData.age !== initialFormData.age ||
      formData.grade !== initialFormData.grade ||
      formData.concerns !== initialFormData.concerns ||
      formData.exceptionality !== initialFormData.exceptionality ||
      formData.status !== initialFormData.status ||
      formData.school !== initialFormData.school ||
      formData.teacherId !== initialFormData.teacherId ||
      formData.caseManagerId !== initialFormData.caseManagerId ||
      formData.iepDate !== initialFormData.iepDate ||
      formData.annualReviewDate !== initialFormData.annualReviewDate ||
      formData.progressReportFrequency !== initialFormData.progressReportFrequency ||
      formData.frequencyPerWeek !== initialFormData.frequencyPerWeek ||
      formData.frequencyType !== initialFormData.frequencyType
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

  const loadTeachers = async () => {
    if (!selectedSchool) {
      setTeachers([]);
      return;
    }
    try {
      const allTeachers = await getTeachers(selectedSchool);
      // Deduplicate teachers by ID to prevent duplicate key warnings
      const uniqueTeachers = Array.from(
        new Map(allTeachers.map(teacher => [teacher.id, teacher])).values()
      );
      setTeachers(uniqueTeachers);
    } catch (error) {
      logError('Failed to load teachers', error);
    }
  };

  const loadCaseManagers = async () => {
    if (!selectedSchool) {
      setCaseManagers([]);
      return;
    }
    try {
      const allCaseManagers = await getCaseManagers(selectedSchool);
      // Deduplicate case managers by ID to prevent duplicate key warnings
      const uniqueCaseManagers = Array.from(
        new Map(allCaseManagers.map(caseManager => [caseManager.id, caseManager])).values()
      );
      setCaseManagers(uniqueCaseManagers);
    } catch (error) {
      logError('Failed to load case managers', error);
    }
  };

  const loadStudents = async () => {
    if (!selectedSchool) {
      logWarn('No school selected, cannot load students');
      setStudents([]);
      return;
    }
    try {
      // First, check if ANY students exist (without school filter)
      const allStudentsUnfiltered = await getStudents();
      
      // Then filter by school
      const allStudents = await getStudents(selectedSchool);
      
      // If no students found for this school but students exist, show a warning
      if (process.env.NODE_ENV === 'development' && allStudents.length === 0 && allStudentsUnfiltered.length > 0) {
        logWarn('⚠️ Students exist but none match the selected school!', {
          selectedSchool,
          availableSchools: [...new Set(allStudentsUnfiltered.map(s => s.school || 'NO SCHOOL'))]
        });
      }
      
      // Deduplicate students by ID to prevent duplicate key warnings
      const uniqueStudents = Array.from(
        new Map(allStudents.map(student => [student.id, student])).values()
      );
      
      // Sort alphabetically by first name
      const sortedStudents = [...uniqueStudents].sort((a, b) => {
        const firstNameA = a.name.split(' ')[0].toLowerCase();
        const firstNameB = b.name.split(' ')[0].toLowerCase();
        return firstNameA.localeCompare(firstNameB);
      });
      setStudents(sortedStudents);
      
      // Check which students have no goals
      const noGoalsSet = new Set<string>();
      for (const student of sortedStudents) {
        const goals = await getGoalsByStudent(student.id, selectedSchool);
        if (goals.length === 0) {
          noGoalsSet.add(student.id);
        }
      }
      setStudentsWithNoGoals(noGoalsSet);
    } catch (error) {
      logError('Failed to load students', error);
    }
  };

  useEffect(() => {
    loadStudents();
    loadTeachers();
    loadCaseManagers();
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

  const handleOpenDialog = async (student?: Student, prefillName?: string) => {
    // Ensure teachers and case managers are loaded before opening dialog
    if (teachers.length === 0) {
      await loadTeachers();
    }
    if (caseManagers.length === 0) {
      await loadCaseManagers();
    }
    
    let newFormData: typeof formData;
    if (student) {
      setEditingStudent(student);
      // Validate teacherId exists in teachers list, if not reset to empty
      const teacherId = student.teacherId && teachers.find(t => t.id === student.teacherId) 
        ? student.teacherId 
        : '';
      // Validate caseManagerId exists in case managers list, if not reset to empty
      const caseManagerId = student.caseManagerId && caseManagers.find(cm => cm.id === student.caseManagerId)
        ? student.caseManagerId
        : '';
      
      newFormData = {
        name: student.name,
        age: student.age > 0 ? student.age.toString() : '',
        grade: student.grade,
        concerns: student.concerns.join(', '),
        exceptionality: (student.exceptionality || []).join(', '),
        status: student.status,
        school: student.school || selectedSchool,
        teacherId: teacherId,
        caseManagerId: caseManagerId,
        iepDate: student.iepDate ? student.iepDate.split('T')[0] : '',
        annualReviewDate: student.annualReviewDate ? student.annualReviewDate.split('T')[0] : '',
        progressReportFrequency: student.progressReportFrequency || 'quarterly',
        frequencyPerWeek: student.frequencyPerWeek ? student.frequencyPerWeek.toString() : '',
        frequencyType: student.frequencyType || 'per-week',
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
        teacherId: '',
        caseManagerId: '',
        iepDate: '',
        annualReviewDate: '',
        progressReportFrequency: 'quarterly' as 'quarterly' | 'annual',
        frequencyPerWeek: '',
        frequencyType: 'per-week' as 'per-week' | 'per-month',
      };
    }
    setFormData(newFormData);
    setInitialFormData(newFormData);
    clearAllErrors(); // Clear any previous validation errors
    studentDialog.openDialog();
  };

  const handleCloseDialog = () => {
    if (isFormDirty()) {
      confirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to close?',
        confirmText: 'Discard Changes',
        cancelText: 'Cancel',
        onConfirm: () => {
          studentDialog.closeDialog();
          setEditingStudent(null);
          resetDirty();
        },
      });
    } else {
      studentDialog.closeDialog();
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
      const frequencyPerWeekValue = formData.frequencyPerWeek.trim() === '' ? undefined : parseInt(formData.frequencyPerWeek);
      if (frequencyPerWeekValue !== undefined && (isNaN(frequencyPerWeekValue) || frequencyPerWeekValue < 1)) {
        alert('Please enter a valid frequency of 1 or greater, or leave it blank');
        return;
      }

      const studentData = {
        name: formData.name,
        age: ageValue ?? 0,
        grade: formData.grade,
        concerns: concernsArray,
        exceptionality: exceptionalityArray.length > 0 ? exceptionalityArray : undefined,
        status: formData.status,
        school: formData.school || selectedSchool,
        teacherId: formData.teacherId || undefined,
        caseManagerId: formData.caseManagerId || undefined,
        iepDate: formData.iepDate ? new Date(formData.iepDate).toISOString() : undefined,
        annualReviewDate: formData.annualReviewDate ? new Date(formData.annualReviewDate).toISOString() : undefined,
        progressReportFrequency: formData.progressReportFrequency,
        frequencyPerWeek: frequencyPerWeekValue,
        frequencyType: frequencyPerWeekValue ? formData.frequencyType : undefined,
      };

      if (editingStudent) {
        await updateStudent(editingStudent.id, studentData);
        showSnackbar('Student updated successfully', 'success');
      } else {
        await addStudent({
          id: generateId(),
          ...studentData,
          dateAdded: new Date().toISOString(),
        });
        showSnackbar('Student created successfully', 'success');
      }
      await loadStudents(); // This will also update the studentsWithNoGoals set
      resetDirty();
      studentDialog.closeDialog();
      setEditingStudent(null);
    } catch (error: unknown) {
      logError('Failed to save student', error);
      
      // Handle validation errors from the API
      if (error instanceof ApiError && handleApiError(error)) {
        // Field errors are now set, form will show them inline
        showSnackbar('Please fix the validation errors', 'error');
        return;
      }
      
      // For other errors, show a general message
      const errorMessage = getErrorMessage(error);
      showSnackbar(`Failed to save student: ${errorMessage}`, 'error');
    }
  };

  const handleDelete = (id: string) => {
    const student = students.find(s => s.id === id);
    confirm({
      title: 'Delete Student',
      message: `Are you sure you want to delete ${student?.name || 'this student'}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await deleteStudent(id);
          await loadStudents();
          showSnackbar('Student deleted successfully', 'success');
        } catch (error) {
          logError('Failed to delete student', error);
          alert('Failed to delete student. Please try again.');
        }
      },
    });
  };

  const handleArchive = (id: string, archive: boolean) => {
    const student = students.find(s => s.id === id);
    confirm({
      title: archive ? 'Archive Student' : 'Unarchive Student',
      message: archive
        ? `Are you sure you want to archive ${student?.name || 'this student'}? Archived students can be viewed in the Archived view.`
        : `Are you sure you want to unarchive ${student?.name || 'this student'}?`,
      confirmText: archive ? 'Archive' : 'Unarchive',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await updateStudent(id, {
            archived: archive,
            dateArchived: archive ? new Date().toISOString() : undefined,
          });
          await loadStudents();
        } catch (error) {
          logError('Failed to archive student', error);
          alert('Failed to archive student. Please try again.');
        }
      },
    });
  };

  const handleViewDetails = (studentId: string) => {
    navigate(`/students/${studentId}`);
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
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder={`Search ${showArchived ? 'archived ' : ''}students by name, grade, or concerns...`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filteredStudents.length === 1) {
              handleViewDetails(filteredStudents[0].id);
            }
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
                            teacherId: '',
                            caseManagerId: '',
                          });
                          setEditingStudent(null);
                          studentDialog.openDialog();
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
              <StudentAccordionCard
                student={student}
                teachers={teachers}
                caseManagers={caseManagers}
                expanded={expandedStudents.has(student.id)}
                onToggleExpand={() => handleAccordionChange(student.id)}
                onEdit={handleOpenDialog}
                onDelete={handleDelete}
                onArchive={handleArchive}
                onViewDetails={handleViewDetails}
                hasNoGoals={studentsWithNoGoals.has(student.id)}
              />
            </Grid>
          ))
        )}
      </Grid>

      <Dialog open={studentDialog.open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingStudent ? 'Edit Student' : 'Add New Student'}
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
              required
              autoFocus
              error={hasError('name')}
              helperText={getError('name')}
            />
            <TextField
              label="Age (optional)"
              type="number"
              fullWidth
              value={formData.age}
              onChange={(e) => {
                setFormData({ ...formData, age: e.target.value });
                clearError('age');
              }}
              inputProps={{ min: 1 }}
              helperText={getError('age') || (formData.age && parseInt(formData.age) < 1 ? 'Age must be at least 1' : 'Leave blank if unknown')}
              error={hasError('age') || (formData.age !== '' && parseInt(formData.age) < 1)}
            />
            <TextField
              label="Grade"
              fullWidth
              value={formData.grade}
              onChange={(e) => {
                setFormData({ ...formData, grade: e.target.value });
                clearError('grade');
              }}
              error={hasError('grade')}
              helperText={getError('grade')}
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
            <Autocomplete
              options={[...teachers.map(t => ({ ...t, __type: 'teacher' as const })), ...caseManagers.map(cm => ({ ...cm, __type: 'caseManager' as const }))]}
              getOptionLabel={(option) => {
                if (!option) return '';
                if (option.__type === 'teacher') {
                  // Teacher
                  return `${option.name}${option.grade ? ` - ${option.grade}` : ''}`;
                } else {
                  // Case Manager
                  return `${option.name}${option.role ? ` - ${option.role}` : ''}`;
                }
              }}
              filterOptions={(options, { inputValue }) => {
                if (!inputValue) return options;
                const searchTerm = inputValue.toLowerCase().trim();
                return options.filter((contact) => {
                  const nameMatch = (contact.name || '').toLowerCase().includes(searchTerm);
                  const gradeMatch = contact.__type === 'teacher' && (contact.grade || '').toLowerCase().includes(searchTerm);
                  const roleMatch = contact.__type === 'caseManager' && (contact.role || '').toLowerCase().includes(searchTerm);
                  return nameMatch || gradeMatch || roleMatch;
                });
              }}
              value={[
                ...teachers.filter(t => t.id === formData.teacherId).map(t => ({ ...t, __type: 'teacher' as const })),
                ...caseManagers.filter(cm => cm.id === formData.caseManagerId).map(cm => ({ ...cm, __type: 'caseManager' as const }))
              ][0] || null}
              onChange={(_, newValue) => {
                if (newValue) {
                  // Check if it's a teacher or case manager
                  if (newValue.__type === 'teacher') {
                    setFormData({
                      ...formData,
                      teacherId: newValue.id,
                      caseManagerId: '',
                    });
                  } else {
                    setFormData({
                      ...formData,
                      teacherId: '',
                      caseManagerId: newValue.id,
                    });
                  }
                } else {
                  // Clear both if no selection
                  setFormData({
                    ...formData,
                    teacherId: '',
                    caseManagerId: '',
                  });
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Teacher or Case Manager (Optional)"
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              )}
              isOptionEqualTo={(option, value) => option.id === value.id && option.__type === value.__type}
            />
            <TextField
              label="IEP Date (Optional)"
              type="date"
              fullWidth
              value={formData.iepDate}
              onChange={(e) => setFormData({ ...formData, iepDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              helperText="Date of current IEP - used for scheduling progress reports"
            />
            <TextField
              label="Annual Review Date (Optional)"
              type="date"
              fullWidth
              value={formData.annualReviewDate}
              onChange={(e) => setFormData({ ...formData, annualReviewDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              helperText="Next annual review date"
            />
            <TextField
              select
              label="Progress Report Frequency"
              fullWidth
              value={formData.progressReportFrequency}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  progressReportFrequency: e.target.value as 'quarterly' | 'annual',
                })
              }
              SelectProps={{
                native: true,
              }}
              helperText="How often to schedule progress reports for this student"
            >
              <option value="quarterly">Quarterly (4 per year)</option>
              <option value="annual">Annual (1 per year)</option>
            </TextField>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Session Frequency"
                type="number"
                fullWidth
                value={formData.frequencyPerWeek}
                onChange={(e) => setFormData({ ...formData, frequencyPerWeek: e.target.value })}
                inputProps={{ min: 1 }}
                helperText="Number of sessions expected"
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                select
                label="Frequency Type"
                fullWidth
                value={formData.frequencyType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    frequencyType: e.target.value as 'per-week' | 'per-month',
                  })
                }
                SelectProps={{
                  native: true,
                }}
                helperText="Per week or per month"
              >
                <option value="per-week">Per Week</option>
                <option value="per-month">Per Month</option>
              </TextField>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
              Set the expected session frequency to track when students fall behind schedule. Leave blank if not tracking frequency.
            </Typography>
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

      <SnackbarComponent />
    </Box>
  );
};

