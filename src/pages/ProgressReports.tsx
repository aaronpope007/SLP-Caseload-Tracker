import { useState, useEffect, useCallback, useMemo } from 'react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Chip,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
} from '@mui/material';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import type { GridColDef, GridRowParams, GridRowSelectionModel } from '@mui/x-data-grid';
import {
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import type { ProgressReport, Student } from '../types';
import {
  getProgressReports,
  scheduleProgressReports,
  addProgressReport,
  completeProgressReport,
  deleteProgressReport,
  deleteProgressReportsBulk,
  getStudents,
} from '../utils/storage-api';
import { formatDate, generateId } from '../utils/helpers';
import { useSchool } from '../context/SchoolContext';
import { useConfirm, useSnackbar, useDialog } from '../hooks';
import { logError } from '../utils/logger';
import { ProgressReportEditorDialog } from '../components/ProgressReportEditorDialog';

const getStatusColor = (status: ProgressReport['status']) => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'overdue':
      return 'error';
    case 'in-progress':
      return 'warning';
    case 'scheduled':
      return 'info';
    default:
      return 'default';
  }
};

export const ProgressReports = () => {
  const navigate = useNavigate();
  const { selectedSchool } = useSchool();
  const { confirm, ConfirmDialog } = useConfirm();
  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const reportDialog = useDialog();
  const [loading, setLoading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>([]);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [studentFilter, setStudentFilter] = useState<string>('');
  const [reportTypeFilter, setReportTypeFilter] = useState<string>('');

  // Editor dialog state
  const [editingReport, setEditingReport] = useState<ProgressReport | null>(null);
  const editorDialog = useDialog();

  // Form data for new report
  const [formData, setFormData] = useState({
    studentId: '',
    reportType: 'quarterly' as 'quarterly' | 'annual',
    periodStart: '',
    periodEnd: '',
    dueDate: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const schoolStudents = await getStudents(selectedSchool);
      setStudents(schoolStudents);
      
      const allReports = await getProgressReports(
        studentFilter || undefined,
        selectedSchool,
        statusFilter || undefined
      );
      
      let filteredReports = allReports;
      if (reportTypeFilter) {
        filteredReports = allReports.filter(r => r.reportType === reportTypeFilter);
      }
      
      setReports(filteredReports);
    } catch (error) {
      logError('Failed to load progress reports', error);
    } finally {
      setLoading(false);
    }
  }, [selectedSchool, statusFilter, studentFilter, reportTypeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Clear selection when reports change
  useEffect(() => {
    setSelectedRows([]);
  }, [reports.length]);

  const handleScheduleAll = async () => {
    setScheduling(true);
    try {
      await scheduleProgressReports(undefined, selectedSchool);
      await loadData();
    } catch (error) {
      logError('Failed to schedule reports', error);
      alert('Failed to schedule reports. Please try again.');
    } finally {
      setScheduling(false);
    }
  };

  const handleScheduleForStudent = async (studentId: string) => {
    try {
      await scheduleProgressReports(studentId, selectedSchool);
      await loadData();
    } catch (error) {
      logError('Failed to schedule reports for student', error);
      alert('Failed to schedule reports. Please try again.');
    }
  };

  const handleOpenDialog = () => {
    // Pre-fill student if filtered by student
    const prefillStudentId = studentFilter || '';
    setFormData({
      studentId: prefillStudentId,
      reportType: 'quarterly',
      periodStart: '',
      periodEnd: '',
      dueDate: '',
    });
    reportDialog.openDialog();
  };

  const handleCloseDialog = () => {
    reportDialog.closeDialog();
    setFormData({
      studentId: '',
      reportType: 'quarterly',
      periodStart: '',
      periodEnd: '',
      dueDate: '',
    });
  };

  const handleSaveReport = async () => {
    if (!formData.studentId || !formData.periodStart || !formData.periodEnd || !formData.dueDate) {
      alert('Please fill in all required fields');
      return;
    }

    const now = new Date();
    const dueDateObj = new Date(formData.dueDate);
    const status = dueDateObj < now ? 'overdue' : 'scheduled';

    try {
      await addProgressReport({
        id: generateId(),
        studentId: formData.studentId,
        reportType: formData.reportType,
        dueDate: new Date(formData.dueDate).toISOString().split('T')[0],
        scheduledDate: now.toISOString(),
        periodStart: new Date(formData.periodStart).toISOString().split('T')[0],
        periodEnd: new Date(formData.periodEnd).toISOString().split('T')[0],
        status,
        dateCreated: now.toISOString(),
        dateUpdated: now.toISOString(),
      });
      await loadData();
      handleCloseDialog();
      showSnackbar('Progress report created successfully', 'success');
    } catch (error) {
      logError('Failed to create report', error);
      alert('Failed to create report. Please try again.');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await completeProgressReport(id);
      await loadData();
    } catch (error) {
      logError('Failed to complete report', error);
    }
  };

  const handleViewEdit = (report: ProgressReport) => {
    setEditingReport(report);
    editorDialog.openDialog();
  };

  const handleCloseEditor = () => {
    editorDialog.closeDialog();
    setEditingReport(null);
  };

  const handleEditorSave = async () => {
    await loadData();
  };

  const handleDelete = (id: string) => {
    const report = reports.find(r => r.id === id);
    confirm({
      title: 'Delete Progress Report',
      message: `Are you sure you want to delete this ${report?.reportType} progress report${report ? ` for ${students.find(s => s.id === report.studentId)?.name || 'student'}` : ''}?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        await deleteProgressReport(id);
        loadData();
        showSnackbar('Progress report deleted successfully', 'success');
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedRows.length === 0) {
      return;
    }

    const selectedReports = reports.filter(r => selectedRows.includes(r.id));
    const reportCount = selectedReports.length;
    const studentNames = selectedReports
      .map(r => students.find(s => s.id === r.studentId)?.name || 'Unknown')
      .filter((name, index, arr) => arr.indexOf(name) === index)
      .slice(0, 3)
      .join(', ');
    const moreText = reportCount > 3 ? ` and ${reportCount - 3} more` : '';

    confirm({
      title: 'Delete Progress Reports',
      message: `Are you sure you want to delete ${reportCount} progress report${reportCount > 1 ? 's' : ''}${studentNames ? ` (${studentNames}${moreText})` : ''}?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const deletedCount = await deleteProgressReportsBulk(selectedRows as string[]);
          setSelectedRows([]);
          await loadData();
          showSnackbar(`Successfully deleted ${deletedCount} progress report${deletedCount > 1 ? 's' : ''}`, 'success');
        } catch (error) {
          logError('Failed to delete progress reports', error);
          alert('Failed to delete progress reports. Please try again.');
        }
      },
    });
  };

  const rows = useMemo(() => {
    return (reports || []).map(report => ({
      id: report.id,
      studentId: report.studentId,
      reportType: report.reportType,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      dueDate: report.dueDate,
      status: report.status,
    }));
  }, [reports]);

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const allIds = rows.map(row => row.id);
      setSelectedRows(allIds);
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedRows(prev => {
      if (prev.includes(id)) {
        return prev.filter(rowId => rowId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const isAllSelected = rows.length > 0 && selectedRows.length === rows.length;
  const isSomeSelected = selectedRows.length > 0 && selectedRows.length < rows.length;

  const columns: GridColDef[] = [
    {
      field: '__select__',
      headerName: '',
      width: 50,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderHeader: () => (
        <Checkbox
          checked={isAllSelected}
          indeterminate={isSomeSelected}
          onChange={handleSelectAll}
          size="small"
        />
      ),
      renderCell: (params) => (
        <Checkbox
          checked={selectedRows.includes(params.id as string)}
          onChange={() => handleSelectRow(params.id as string)}
          size="small"
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      field: 'studentName',
      headerName: 'Student',
      width: 180,
      renderCell: (params) => {
        const student = students.find(s => s.id === params.row.studentId);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon fontSize="small" />
            <Typography variant="body2">{student?.name || 'Unknown'}</Typography>
          </Box>
        );
      },
    },
    {
      field: 'reportType',
      headerName: 'Type',
      width: 110,
      renderCell: (params) => (
        <Chip
          label={params.value === 'quarterly' ? 'Quarterly' : 'Annual'}
          size="small"
          color={params.value === 'quarterly' ? 'primary' : 'secondary'}
        />
      ),
    },
    {
      field: 'period',
      headerName: 'Period',
      width: 200,
      valueGetter: (value, row) => `${formatDate(row.periodStart)} - ${formatDate(row.periodEnd)}`,
    },
    {
      field: 'dueDate',
      headerName: 'Due Date',
      width: 130,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CalendarIcon fontSize="small" />
          <Typography variant="body2">{formatDate(params.value)}</Typography>
        </Box>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => (
        <Chip
          label={params.value.charAt(0).toUpperCase() + params.value.slice(1).replace('-', ' ')}
          size="small"
          color={getStatusColor(params.value) as 'success' | 'error' | 'warning' | 'info' | 'default'}
        />
      ),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 120,
      getActions: (params: GridRowParams) => {
        const actions = [];
        const report = reports.find(r => r.id === params.id);
        if (report) {
          actions.push(
            <GridActionsCellItem
              icon={<EditIcon />}
              label="View/Edit"
              onClick={() => handleViewEdit(report)}
            />
          );
        }
        if (params.row.status !== 'completed') {
          actions.push(
            <GridActionsCellItem
              icon={<CheckCircleIcon />}
              label="Mark Complete"
              onClick={() => handleComplete(params.id as string)}
            />
          );
        }
        actions.push(
          <GridActionsCellItem
            icon={<DeleteIcon />}
            label="Delete"
            onClick={() => handleDelete(params.id as string)}
          />
        );
        return actions;
      },
    },
  ];

  const overdueCount = reports.filter(r => r.status === 'overdue').length;
  const upcomingCount = reports.filter(r => r.status === 'scheduled' || r.status === 'in-progress').length;
  const completedCount = reports.filter(r => r.status === 'completed').length;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Progress Reports
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {selectedRows.length > 0 && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleBulkDelete}
            >
              Delete Selected ({selectedRows.length})
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleOpenDialog}
          >
            Add Report
          </Button>
          <Button
            variant="contained"
            startIcon={<ScheduleIcon />}
            onClick={handleScheduleAll}
            disabled={scheduling}
          >
            {scheduling ? <CircularProgress size={20} /> : 'Schedule All Reports'}
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography color="text.secondary" gutterBottom>
              Overdue
            </Typography>
            <Typography variant="h4" color="error">
              {overdueCount}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography color="text.secondary" gutterBottom>
              Upcoming
            </Typography>
            <Typography variant="h4" color="info.main">
              {upcomingCount}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography color="text.secondary" gutterBottom>
              Completed
            </Typography>
            <Typography variant="h4" color="success.main">
              {completedCount}
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2}>
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="scheduled">Scheduled</MenuItem>
                <MenuItem value="in-progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="overdue">Overdue</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Student</InputLabel>
              <Select
                value={studentFilter}
                label="Student"
                onChange={(e) => setStudentFilter(e.target.value)}
              >
                <MenuItem value="">All Students</MenuItem>
                {students.map((student) => (
                  <MenuItem key={student.id} value={student.id}>
                    {student.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Report Type</InputLabel>
              <Select
                value={reportTypeFilter}
                label="Report Type"
                onChange={(e) => setReportTypeFilter(e.target.value)}
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="quarterly">Quarterly</MenuItem>
                <MenuItem value="annual">Annual</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {overdueCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You have {overdueCount} overdue progress report{overdueCount > 1 ? 's' : ''}. Please complete them as soon as possible.
        </Alert>
      )}

      <Box sx={{ height: 'calc(100vh - 400px)', width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          pageSizeOptions={[10, 25, 50, 100]}
          disableColumnFilter
          disableColumnMenu
          disableDensitySelector
          initialState={{
            pagination: {
              paginationModel: { page: 0, pageSize: 25 },
            },
          }}
          loading={loading}
          disableRowSelectionOnClick
          sx={{
            '& .MuiDataGrid-cell:focus': {
              outline: 'none',
            },
            '& .MuiDataGrid-cell:focus-within': {
              outline: 'none',
            },
          }}
        />
      </Box>

      <Dialog open={reportDialog.open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Progress Report</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Student</InputLabel>
              <Select
                value={formData.studentId}
                label="Student"
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
              >
                {students.filter(s => s.status === 'active' && s.archived !== true).map((student) => (
                  <MenuItem key={student.id} value={student.id}>
                    {student.name} ({student.grade})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel>Report Type</InputLabel>
              <Select
                value={formData.reportType}
                label="Report Type"
                onChange={(e) => setFormData({ ...formData, reportType: e.target.value as 'quarterly' | 'annual' })}
              >
                <MenuItem value="quarterly">Quarterly</MenuItem>
                <MenuItem value="annual">Annual</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Period Start"
              type="date"
              fullWidth
              required
              value={formData.periodStart}
              onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
              InputLabelProps={{ shrink: true }}
              helperText="Start date of the reporting period"
            />
            <TextField
              label="Period End"
              type="date"
              fullWidth
              required
              value={formData.periodEnd}
              onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
              InputLabelProps={{ shrink: true }}
              helperText="End date of the reporting period"
            />
            <TextField
              label="Due Date"
              type="date"
              fullWidth
              required
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              helperText="When this report is due"
            />
            {formData.studentId && (
              <Button
                variant="outlined"
                startIcon={<ScheduleIcon />}
                onClick={async () => {
                  await handleScheduleForStudent(formData.studentId);
                  handleCloseDialog();
                  await loadData();
                }}
                sx={{ mt: 1 }}
              >
                Auto-Schedule for This Student
              </Button>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveReport} variant="contained">
            Create Report
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog />

      <SnackbarComponent />

      {editingReport && (() => {
        const student = students.find(s => s.id === editingReport.studentId);
        return student ? (
          <ProgressReportEditorDialog
            open={editorDialog.open}
            report={editingReport}
            student={student}
            onClose={handleCloseEditor}
            onSave={handleEditorSave}
          />
        ) : null;
      })()}
    </Box>
  );
};

