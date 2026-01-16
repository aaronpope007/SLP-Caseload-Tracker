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
  FormControlLabel,
  Checkbox,
  FormGroup,
  FormLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  UnfoldMore as UnfoldMoreIcon,
  UnfoldLess as UnfoldLessIcon,
} from '@mui/icons-material';
import type { CaseManager } from '../types';
import {
  getCaseManagers,
  addCaseManager,
  updateCaseManager,
  deleteCaseManager,
} from '../utils/storage-api';
import { generateId } from '../utils/helpers';
import { useConfirm, useDialog, useSnackbar, useFormValidation } from '../hooks';
import { useDirty } from '../hooks/useDirty';
import { useSchool } from '../context/SchoolContext';
import { SearchBar } from '../components/common/SearchBar';
import { CaseManagerAccordionCard } from '../components/CaseManagerAccordionCard';
import { logError, logInfo } from '../utils/logger';
import { formatPhoneNumber, formatPhoneForDisplay, stripPhoneFormatting } from '../utils/formatters';

export const CaseManagers = () => {
  const { selectedSchool, availableSchools } = useSchool();
  const [caseManagers, setCaseManagers] = useState<CaseManager[]>([]);
  const [filteredCaseManagers, setFilteredCaseManagers] = useState<CaseManager[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCaseManagers, setExpandedCaseManagers] = useState<Set<string>>(new Set());
  const [editingCaseManager, setEditingCaseManager] = useState<CaseManager | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    role: '',
    school: '',
    phoneNumber: '',
    emailAddress: '',
    gender: '' as '' | 'male' | 'female' | 'non-binary',
  });
  const [initialFormData, setInitialFormData] = useState(formData);
  
  // Dialog and snackbar hooks
  const caseManagerDialog = useDialog();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const { confirm, ConfirmDialog } = useConfirm();
  const { hasError, getError, clearError, clearAllErrors, handleApiError } = useFormValidation();

  // Check if form is dirty
  const isFormDirty = () => {
    if (!caseManagerDialog.open) return false;
    return (
      formData.name !== initialFormData.name ||
      formData.role !== initialFormData.role ||
      formData.school !== initialFormData.school ||
      formData.phoneNumber !== initialFormData.phoneNumber ||
      formData.emailAddress !== initialFormData.emailAddress ||
      formData.gender !== initialFormData.gender
    );
  };

  // Use dirty hook to block navigation
  const { blocker, reset: resetDirty } = useDirty({
    isDirty: isFormDirty(),
    message: 'You have unsaved changes to this case manager. Are you sure you want to leave?',
  });

  const filterCaseManagers = () => {
    let filtered = caseManagers;
    
    // Filter by search term if provided
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const searchDigits = stripPhoneFormatting(term);
      filtered = filtered.filter(
        (cm) =>
          cm.name.toLowerCase().includes(term) ||
          cm.role.toLowerCase().includes(term) ||
          (cm.phoneNumber && (
            cm.phoneNumber.toLowerCase().includes(term) ||
            stripPhoneFormatting(cm.phoneNumber).includes(searchDigits)
          )) ||
          (cm.emailAddress && cm.emailAddress.toLowerCase().includes(term))
      );
    }
    
    // Maintain alphabetical order by name
    filtered.sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    setFilteredCaseManagers(filtered);
  };

  const loadCaseManagers = async () => {
    if (!selectedSchool) {
      setCaseManagers([]);
      return;
    }
    try {
      const allCaseManagers = await getCaseManagers(selectedSchool);
      
      // Sort alphabetically by name
      const sortedCaseManagers = [...allCaseManagers].sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        return nameA.localeCompare(nameB);
      });
      setCaseManagers(sortedCaseManagers);
    } catch (error) {
      logError('[CaseManagers] Failed to load case managers', error);
    }
  };

  useEffect(() => {
    loadCaseManagers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchool]);

  useEffect(() => {
    filterCaseManagers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, caseManagers]);

  useEffect(() => {
    // Clean up expanded state for case managers that are no longer visible
    setExpandedCaseManagers((prev) => {
      const visibleIds = new Set(filteredCaseManagers.map((cm) => cm.id));
      return new Set([...prev].filter((id) => visibleIds.has(id)));
    });
  }, [filteredCaseManagers]);

  const handleOpenDialog = (caseManager?: CaseManager) => {
    let newFormData: typeof formData;
    if (caseManager) {
      setEditingCaseManager(caseManager);
      newFormData = {
        name: caseManager.name,
        role: caseManager.role,
        school: caseManager.school || selectedSchool,
        phoneNumber: caseManager.phoneNumber ? formatPhoneForDisplay(caseManager.phoneNumber) : '',
        emailAddress: caseManager.emailAddress || '',
        gender: caseManager.gender || '',
      };
    } else {
      setEditingCaseManager(null);
      newFormData = {
        name: '',
        role: '',
        school: selectedSchool,
        phoneNumber: '',
        emailAddress: '',
        gender: '' as '' | 'male' | 'female' | 'non-binary',
      };
    }
    setFormData(newFormData);
    setInitialFormData(newFormData);
    clearAllErrors();
    caseManagerDialog.openDialog();
  };

  const handleCloseDialog = () => {
    if (isFormDirty()) {
      confirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to close?',
        confirmText: 'Discard Changes',
        cancelText: 'Cancel',
        onConfirm: () => {
          caseManagerDialog.closeDialog();
          setEditingCaseManager(null);
          resetDirty();
        },
      });
    } else {
      caseManagerDialog.closeDialog();
      setEditingCaseManager(null);
      resetDirty();
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a case manager name');
      return;
    }

    if (!formData.role.trim()) {
      alert('Please enter a role (e.g., SPED, SLP, OT, PT)');
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
      const caseManagerData = {
        name: formData.name.trim(),
        role: formData.role.trim(),
        school: formData.school.trim() || selectedSchool,
        phoneNumber: phoneDigits || undefined,
        emailAddress: emailTrimmed || undefined,
        gender: formData.gender || undefined,
      };

      if (editingCaseManager) {
        await updateCaseManager(editingCaseManager.id, caseManagerData);
        showSnackbar('Case manager updated successfully', 'success');
      } else {
        const newCaseManager = {
          id: generateId(),
          ...caseManagerData,
          dateCreated: new Date().toISOString(),
        };
        await addCaseManager(newCaseManager);
        showSnackbar('Case manager created successfully', 'success');
      }
      
      await loadCaseManagers();
      resetDirty();
      setDialogOpen(false);
      setEditingCaseManager(null);
    } catch (error: unknown) {
      if (handleApiError(error)) {
        // Validation errors are now displayed inline
        return;
      }
      logError('[CaseManagers] Failed to save case manager', error);
      const errorMessage = getErrorMessage(error);
      alert(`Failed to save case manager: ${errorMessage}\n\nMake sure the API server is running on http://localhost:3001`);
    }
  };

  const handleAccordionChange = (caseManagerId: string) => {
    setExpandedCaseManagers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(caseManagerId)) {
        newSet.delete(caseManagerId);
      } else {
        newSet.add(caseManagerId);
      }
      return newSet;
    });
  };

  const handleExpandAll = () => {
    if (expandedCaseManagers.size === filteredCaseManagers.length) {
      // Collapse all
      setExpandedCaseManagers(new Set());
    } else {
      // Expand all
      setExpandedCaseManagers(new Set(filteredCaseManagers.map((cm) => cm.id)));
    }
  };

  const handleDelete = (id: string, relatedStudents: any[]) => {
    const caseManager = caseManagers.find(cm => cm.id === id);
    
    // Use the passed students (they should be loaded by the component)
    const students = relatedStudents || [];

    const hasRelatedStudents = students && students.length > 0;
    
    confirm({
      title: 'Delete Case Manager',
      message: (
        <>
          {hasRelatedStudents ? (
            <>
              <strong>Warning:</strong> This case manager is assigned to {students.length} {students.length === 1 ? 'student' : 'students'}:
              <ul style={{ marginTop: '8px', marginBottom: '8px', paddingLeft: '20px' }}>
                {students.slice(0, 5).map((s: any) => (
                  <li key={s.id}>{s.name} ({s.grade})</li>
                ))}
                {students.length > 5 && <li>...and {students.length - 5} more</li>}
              </ul>
              Deleting this case manager will remove the assignment from all related students. Are you sure you want to proceed?
            </>
          ) : (
            `Are you sure you want to delete ${caseManager?.name || 'this case manager'}? This action cannot be undone.`
          )}
        </>
      ),
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmColor: hasRelatedStudents ? 'warning' : 'error',
      onConfirm: async () => {
        try {
          await deleteCaseManager(id);
          await loadCaseManagers();
          showSnackbar('Case manager deleted successfully', 'success');
        } catch (error) {
          logError('Failed to delete case manager', error);
          alert('Failed to delete case manager. Please try again.');
        }
      },
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h1">
            Case Managers
          </Typography>
          {selectedSchool && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Showing case managers for: <strong>{selectedSchool}</strong>
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            onClick={async () => {
              // Debug: Load all case managers without school filter
              try {
                const all = await getCaseManagers();
                const withSchool = await getCaseManagers(selectedSchool);
                
                // Also try the debug endpoint
                try {
                  const debugResponse = await fetch('http://localhost:3001/api/case-managers/debug/all');
                  const debugData = await debugResponse.json();
                  if (process.env.NODE_ENV === 'development') {
                    logInfo('[Debug] Current selected school', selectedSchool);
                    logInfo('[Debug] All case managers (no filter)', all);
                    logInfo('[Debug] Case managers for selected school', withSchool);
                    logInfo('[Debug] Debug endpoint response', debugData);
                  }
                  
                  let message = `Found ${all.length} case managers total (no filter).\n`;
                  message += `Found ${withSchool.length} for school "${selectedSchool}".\n`;
                  message += `Debug endpoint shows ${debugData.count} in database.\n\n`;
                  message += `Check browser console (F12) for full details.`;
                  alert(message);
                } catch (debugError) {
                  logError('[Debug] Error calling debug endpoint', debugError);
                  alert(`Found ${all.length} case managers total. Check console for details.`);
                }
              } catch (error) {
                logError('[Debug] Error loading all case managers', error);
                alert('Error loading case managers. Check console.');
              }
            }}
          >
            Debug: Load All
          </Button>
          {filteredCaseManagers.length > 0 && (
            <Button
              variant="outlined"
              startIcon={expandedCaseManagers.size === filteredCaseManagers.length ? <UnfoldLessIcon /> : <UnfoldMoreIcon />}
              onClick={handleExpandAll}
            >
              {expandedCaseManagers.size === filteredCaseManagers.length ? 'Collapse All' : 'Expand All'}
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Case Manager
          </Button>
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search case managers by name, role, phone, or email..."
        />
      </Box>

      <Grid container spacing={2}>
        {filteredCaseManagers.length === 0 ? (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <Typography color="text.secondary" gutterBottom>
                    {searchTerm
                      ? `No case managers found matching "${searchTerm}"`
                      : 'No case managers added yet. Click "Add Case Manager" to get started.'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          filteredCaseManagers.map((caseManager) => (
            <Grid item xs={12} sm={6} md={4} key={caseManager.id}>
              <CaseManagerAccordionCard
                caseManager={caseManager}
                expanded={expandedCaseManagers.has(caseManager.id)}
                onToggleExpand={() => handleAccordionChange(caseManager.id)}
                onEdit={handleOpenDialog}
                onDelete={handleDelete}
                formatPhoneForDisplay={formatPhoneForDisplay}
              />
            </Grid>
          ))
        )}
      </Grid>

      <Dialog open={caseManagerDialog.open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCaseManager ? 'Edit Case Manager' : 'Add New Case Manager'}
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
              label="Role"
              fullWidth
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              required
              placeholder="e.g., SPED, SLP, OT, PT"
              helperText="Enter the case manager's role (e.g., SPED, SLP, OT, PT)"
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
              placeholder="casemanager@example.com"
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
            disabled={!formData.name.trim() || !formData.role.trim()}
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
              You have unsaved changes to this case manager. Are you sure you want to leave?
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

