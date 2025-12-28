import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Stack,
  Snackbar,
  Paper,
  Divider,
} from '@mui/material';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Person as PersonIcon,
  School as SchoolIcon,
} from '@mui/icons-material';
import type { Communication, Student, Teacher, CaseManager } from '../types';
import { api } from '../utils/api';
import { formatDate } from '../utils/helpers';
import { useSchool } from '../context/SchoolContext';
import { useConfirm, useSnackbar, useDialog } from '../hooks';
import { SendEmailDialog } from '../components/SendEmailDialog';
import { logError, logInfo } from '../utils/logger';
import { getErrorMessage } from '../utils/validators';

const getContactTypeColor = (type: Communication['contactType']) => {
  switch (type) {
    case 'teacher':
      return 'primary';
    case 'parent':
      return 'success';
    case 'case-manager':
      return 'warning';
    default:
      return 'default';
  }
};

const getMethodIcon = (method: Communication['method']) => {
  switch (method) {
    case 'email':
      return <EmailIcon fontSize="small" />;
    case 'phone':
      return <PhoneIcon fontSize="small" />;
    default:
      return <PersonIcon fontSize="small" />;
  }
};

export const Communications = () => {
  const { selectedSchool } = useSchool();
  const { confirm, ConfirmDialog } = useConfirm();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const communicationDialog = useDialog();
  const viewDialog = useDialog();
  const emailDialog = useDialog();
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [caseManagers, setCaseManagers] = useState<CaseManager[]>([]);
  const [editingCommunication, setEditingCommunication] = useState<Communication | null>(null);
  const [viewingCommunication, setViewingCommunication] = useState<Communication | null>(null);
  
  // Filters
  const [contactTypeFilter, setContactTypeFilter] = useState<string>('');
  const [studentFilter, setStudentFilter] = useState<string>('');

  const [formData, setFormData] = useState({
    studentId: '',
    contactType: 'teacher' as Communication['contactType'],
    contactId: '',
    contactName: '',
    contactEmail: '',
    subject: '',
    body: '',
    method: 'email' as Communication['method'],
    date: new Date().toISOString().split('T')[0],
    sessionId: '',
    relatedTo: '',
  });

  const loadData = useCallback(async () => {
    try {
      // Load ALL students (not filtered by school) so we can look up any student by ID
      // This ensures we can display student names even if they're from different schools
      const allStudents = await api.students.getAll();
      setStudents(allStudents);
      
      const schoolTeachers = await api.teachers.getAll(selectedSchool);
      setTeachers(schoolTeachers);
      
      const schoolCaseManagers = await api.caseManagers.getAll(selectedSchool);
      setCaseManagers(schoolCaseManagers);
      
      const filters: any = { school: selectedSchool };
      if (contactTypeFilter) filters.contactType = contactTypeFilter;
      if (studentFilter) filters.studentId = studentFilter;
      
      logInfo('Loading communications with filters', filters);
      const allCommunications = await api.communications.getAll(
        filters.studentId,
        filters.contactType,
        filters.school
      );
      
      // Add computed studentName to each communication for easier display
      const communicationsWithStudentNames = allCommunications.map(c => ({
        ...c,
        studentName: c.studentId ? allStudents.find(s => s.id === c.studentId)?.name || 'N/A' : 'N/A',
      }));
      
      logInfo('📋 Loaded communications', communicationsWithStudentNames);
      
      setCommunications(communicationsWithStudentNames);
    } catch (error: unknown) {
      logError('Failed to load communications', error);
      showSnackbar(getErrorMessage(error) || 'Failed to load communications', 'error');
    }
  }, [selectedSchool, contactTypeFilter, studentFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenDialog = (comm?: Communication) => {
    if (comm) {
      setEditingCommunication(comm);
      setFormData({
        studentId: comm.studentId || '',
        contactType: comm.contactType,
        contactId: comm.contactId || '',
        contactName: comm.contactName,
        contactEmail: comm.contactEmail || '',
        subject: comm.subject,
        body: comm.body,
        method: comm.method,
        date: comm.date.split('T')[0],
        sessionId: comm.sessionId || '',
        relatedTo: comm.relatedTo || '',
      });
    } else {
      setEditingCommunication(null);
      setFormData({
        studentId: '',
        contactType: 'teacher',
        contactId: '',
        contactName: '',
        contactEmail: '',
        subject: '',
        body: '',
        method: 'email',
        date: new Date().toISOString().split('T')[0],
        sessionId: '',
        relatedTo: '',
      });
    }
    communicationDialog.openDialog();
  };

  const handleCloseDialog = () => {
    communicationDialog.closeDialog();
    setEditingCommunication(null);
  };

  const handleSave = async () => {
    try {
      const student = formData.studentId ? students.find(s => s.id === formData.studentId) : null;
      
      const communicationData: Omit<Communication, 'id' | 'dateCreated'> = {
        studentId: formData.studentId || undefined,
        contactType: formData.contactType,
        contactId: formData.contactId || undefined,
        contactName: formData.contactName,
        contactEmail: formData.contactEmail || undefined,
        subject: formData.subject,
        body: formData.body,
        method: formData.method,
        date: new Date(formData.date).toISOString(),
        sessionId: formData.sessionId || undefined,
        relatedTo: formData.relatedTo || undefined,
      };

      if (editingCommunication) {
        await api.communications.update(editingCommunication.id, communicationData);
        showSnackbar('Communication updated successfully', 'success');
      } else {
        await api.communications.create(communicationData);
        showSnackbar('Communication logged successfully', 'success');
      }
      
      handleCloseDialog();
      loadData();
    } catch (error: unknown) {
      logError('Failed to save communication', error);
      showSnackbar(getErrorMessage(error) || 'Failed to save communication', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm(
      'Delete Communication',
      'Are you sure you want to delete this communication? This action cannot be undone.'
    );
    
    if (confirmed) {
      try {
        await api.communications.delete(id);
        showSnackbar('Communication deleted successfully', 'success');
        loadData();
      } catch (error: unknown) {
        logError('Failed to delete communication', error);
        showSnackbar(getErrorMessage(error) || 'Failed to delete communication', 'error');
      }
    }
  };

  const handleView = (comm: Communication) => {
    setViewingCommunication(comm);
    viewDialog.openDialog();
  };

  const handleContactTypeChange = (contactType: Communication['contactType']) => {
    setFormData({ ...formData, contactType, contactId: '', contactName: '', contactEmail: '' });
  };

  const handleContactSelect = (contactId: string) => {
    let contact: Teacher | CaseManager | undefined;
    
    if (formData.contactType === 'teacher') {
      contact = teachers.find(t => t.id === contactId);
    } else if (formData.contactType === 'case-manager') {
      contact = caseManagers.find(c => c.id === contactId);
    }
    
    if (contact) {
      setFormData({
        ...formData,
        contactId: contact.id,
        contactName: contact.name,
        contactEmail: contact.emailAddress || '',
      });
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'date',
      headerName: 'Date',
      width: 120,
      renderCell: (params) => {
        const dateValue = params.row?.date || params.row?.dateCreated;
        if (!dateValue) {
          return <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>N/A</Typography>;
        }
        return <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>{formatDate(dateValue)}</Typography>;
      },
    },
    {
      field: 'contactName',
      headerName: 'Contact',
      width: 180,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%' }}>
          {params?.row?.method ? getMethodIcon(params.row.method) : null}
          <Typography variant="body2">{params.value || 'N/A'}</Typography>
        </Box>
      ),
    },
    {
      field: 'contactType',
      headerName: 'Type',
      width: 120,
      renderCell: (params) => {
        if (!params.value) return null;
        const label = params.value === 'case-manager' ? 'Case Manager' : params.value.charAt(0).toUpperCase() + params.value.slice(1);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Chip
              label={label}
              size="small"
              color={getContactTypeColor(params.value)}
            />
          </Box>
        );
      },
    },
    {
      field: 'subject',
      headerName: 'Subject',
      width: 250,
      flex: 1,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          {params.value || 'N/A'}
        </Typography>
      ),
    },
    {
      field: 'studentName',
      headerName: 'Student',
      width: 150,
      renderCell: (params) => {
        const studentName = params.row?.studentName;
        if (!studentName || studentName === 'N/A') {
          return <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>N/A</Typography>;
        }
        return <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>{studentName}</Typography>;
      },
    },
    {
      field: 'relatedTo',
      headerName: 'Related To',
      width: 150,
      renderCell: (params) => {
        const relatedTo = params.row?.relatedTo;
        if (!relatedTo) {
          return <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>N/A</Typography>;
        }
        return <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>{relatedTo}</Typography>;
      },
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 120,
      getActions: (params: GridRowParams) => [
        <GridActionsCellItem
          icon={<PersonIcon />}
          label="View"
          onClick={() => handleView(params.row as Communication)}
        />,
        <GridActionsCellItem
          icon={<DeleteIcon />}
          label="Delete"
          onClick={() => handleDelete(params.row.id)}
        />,
      ],
    },
  ];

  const filteredCommunications = communications;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Communications</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<EmailIcon />}
            onClick={() => emailDialog.openDialog()}
          >
            Send Email
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Log Communication
          </Button>
        </Box>
      </Box>

      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Contact Type</InputLabel>
          <Select
            value={contactTypeFilter}
            label="Contact Type"
            onChange={(e) => setContactTypeFilter(e.target.value)}
          >
            <MenuItem value="">All Types</MenuItem>
            <MenuItem value="teacher">Teacher</MenuItem>
            <MenuItem value="parent">Parent</MenuItem>
            <MenuItem value="case-manager">Case Manager</MenuItem>
          </Select>
        </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Student</InputLabel>
              <Select
                value={studentFilter}
                label="Student"
                onChange={(e) => setStudentFilter(e.target.value)}
              >
                <MenuItem value="">All Students</MenuItem>
                {students
                  .filter(s => !selectedSchool || s.school === selectedSchool)
                  .map((student) => (
                    <MenuItem key={student.id} value={student.id}>
                      {student.name}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
      </Stack>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredCommunications}
          columns={columns}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 25 },
            },
          }}
          disableRowSelectionOnClick
          sx={{
            '& .MuiDataGrid-cell': {
              display: 'flex',
              alignItems: 'center',
            },
          }}
        />
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog open={communicationDialog.open} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingCommunication ? 'Edit Communication' : 'Log Communication'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Contact Type</InputLabel>
              <Select
                value={formData.contactType}
                label="Contact Type"
                onChange={(e) => handleContactTypeChange(e.target.value as Communication['contactType'])}
              >
                <MenuItem value="teacher">Teacher</MenuItem>
                <MenuItem value="parent">Parent</MenuItem>
                <MenuItem value="case-manager">Case Manager</MenuItem>
              </Select>
            </FormControl>

            {formData.contactType === 'teacher' && (
              <FormControl fullWidth>
                <InputLabel>Teacher</InputLabel>
                <Select
                  value={formData.contactId}
                  label="Teacher"
                  onChange={(e) => handleContactSelect(e.target.value)}
                >
                  <MenuItem value="">Select Teacher</MenuItem>
                  {teachers.map((teacher) => (
                    <MenuItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {formData.contactType === 'case-manager' && (
              <FormControl fullWidth>
                <InputLabel>Case Manager</InputLabel>
                <Select
                  value={formData.contactId}
                  label="Case Manager"
                  onChange={(e) => handleContactSelect(e.target.value)}
                >
                  <MenuItem value="">Select Case Manager</MenuItem>
                  {caseManagers.map((cm) => (
                    <MenuItem key={cm.id} value={cm.id}>
                      {cm.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {(formData.contactType === 'parent' || !formData.contactId) && (
              <>
                <TextField
                  fullWidth
                  label="Contact Name"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  required
                />
                <TextField
                  fullWidth
                  label="Contact Email"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                />
              </>
            )}

            <FormControl fullWidth>
              <InputLabel>Student (Optional)</InputLabel>
              <Select
                value={formData.studentId}
                label="Student (Optional)"
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
              >
                <MenuItem value="">No Student</MenuItem>
                {students.map((student) => (
                  <MenuItem key={student.id} value={student.id}>
                    {student.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Method</InputLabel>
              <Select
                value={formData.method}
                label="Method"
                onChange={(e) => setFormData({ ...formData, method: e.target.value as Communication['method'] })}
              >
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="phone">Phone</MenuItem>
                <MenuItem value="in-person">In Person</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              required
            />

            <TextField
              fullWidth
              label="Subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
            />

            <TextField
              fullWidth
              label="Related To (e.g., Missed Session)"
              value={formData.relatedTo}
              onChange={(e) => setFormData({ ...formData, relatedTo: e.target.value })}
              placeholder="e.g., Missed Session, IEP Meeting, etc."
            />

            <TextField
              fullWidth
              multiline
              rows={6}
              label="Body/Notes"
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!formData.contactName || !formData.subject || !formData.body}
          >
            {editingCommunication ? 'Update' : 'Log'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialog.open} onClose={viewDialog.closeDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {viewingCommunication?.subject}
        </DialogTitle>
        <DialogContent>
          {viewingCommunication && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Date</Typography>
                <Typography variant="body1">{formatDate(viewingCommunication.date || null)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Contact</Typography>
                <Typography variant="body1">
                  {viewingCommunication.contactName}
                  {viewingCommunication.contactEmail && ` (${viewingCommunication.contactEmail})`}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Type</Typography>
                <Chip
                  label={viewingCommunication.contactType === 'case-manager' ? 'Case Manager' : viewingCommunication.contactType.charAt(0).toUpperCase() + viewingCommunication.contactType.slice(1)}
                  size="small"
                  color={getContactTypeColor(viewingCommunication.contactType)}
                  sx={{ mt: 0.5 }}
                />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Method</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  {getMethodIcon(viewingCommunication.method)}
                  <Typography variant="body1">
                    {viewingCommunication.method.charAt(0).toUpperCase() + viewingCommunication.method.slice(1)}
                  </Typography>
                </Box>
              </Box>
              {viewingCommunication.studentId && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Student</Typography>
                  <Typography variant="body1">
                    {students.find(s => s.id === viewingCommunication.studentId)?.name || 'Unknown'}
                  </Typography>
                </Box>
              )}
              {viewingCommunication.relatedTo && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Related To</Typography>
                  <Typography variant="body1">{viewingCommunication.relatedTo}</Typography>
                </Box>
              )}
              <Divider />
              <Box>
                <Typography variant="caption" color="text.secondary">Body</Typography>
                <Typography variant="body1" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                  {viewingCommunication.body}
                </Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={viewDialog.closeDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      <SnackbarComponent />

      <ConfirmDialog />

      <SendEmailDialog
        open={emailDialog.open}
        onClose={emailDialog.closeDialog}
        students={students}
        teachers={teachers}
        caseManagers={caseManagers}
        selectedSchool={selectedSchool}
        onEmailSent={() => {
          loadData();
        }}
      />
    </Box>
  );
};

