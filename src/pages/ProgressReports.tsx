import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Print as PrintIcon,
  PictureAsPdf as PdfIcon,
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
  updateProgressReport,
} from '../utils/storage-api';
import { formatDate, generateId, convertMarkupToHtml } from '../utils/helpers';
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
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>([]);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [studentFilter, setStudentFilter] = useState<string>('');
  const [reportTypeFilter, setReportTypeFilter] = useState<string>('');

  // Editor dialog state
  const [editingReport, setEditingReport] = useState<ProgressReport | null>(null);
  const editorDialog = useDialog();

  // View/edit report dialog state
  const [viewingReport, setViewingReport] = useState<ProgressReport | null>(null);
  const [editedReportText, setEditedReportText] = useState<string>('');
  const [editingReportText, setEditingReportText] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const reportViewDialog = useDialog();
  const isMountedRef = useRef(true);

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

  // Memory leak prevention
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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

  // View/edit saved report handlers
  const handleViewSavedReport = (report: ProgressReport) => {
    setViewingReport(report);
    setEditedReportText(report.finalReportText || '');
    setEditingReportText(false);
    reportViewDialog.openDialog();
  };

  const handleCloseReportView = () => {
    reportViewDialog.closeDialog();
    setViewingReport(null);
    setEditingReportText(false);
    setEditedReportText('');
  };

  const handleEditReportText = () => {
    if (viewingReport) {
      setEditedReportText(viewingReport.finalReportText || '');
      setEditingReportText(true);
    }
  };

  const handleCancelEditReportText = () => {
    if (viewingReport) {
      setEditedReportText(viewingReport.finalReportText || '');
      setEditingReportText(false);
    }
  };

  const handleSaveReportText = async () => {
    if (!viewingReport || !isMountedRef.current) return;
    
    setSavingReport(true);
    try {
      await updateProgressReport(viewingReport.id, {
        finalReportText: editedReportText || undefined,
      });
      
      if (!isMountedRef.current) return;
      
      // Update the local report state
      const updatedReport = { ...viewingReport, finalReportText: editedReportText || undefined };
      setViewingReport(updatedReport);
      
      // Update the reports list
      setReports(prev => prev.map(r => r.id === viewingReport.id ? updatedReport : r));
      
      setEditingReportText(false);
      showSnackbar('Progress report updated successfully', 'success');
    } catch (error: unknown) {
      if (!isMountedRef.current) return;
      logError('Failed to save progress report', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save progress report';
      showSnackbar(errorMessage, 'error');
    } finally {
      if (isMountedRef.current) {
        setSavingReport(false);
      }
    }
  };

  const handlePrintReport = () => {
    if (!viewingReport || !viewingReport.finalReportText) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const student = students.find(s => s.id === viewingReport.studentId);
    const formattedReport = convertMarkupToHtml(viewingReport.finalReportText);
    const reportContent = `
      <html>
        <head>
          <title>Progress Report - ${student?.name || 'Student'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
            h1 { color: #333; font-size: 1.5rem; font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; }
            h2 { color: #333; font-size: 1.25rem; font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; }
            h3 { color: #333; font-size: 1.1rem; font-weight: bold; margin-top: 0.75rem; margin-bottom: 0.5rem; }
            .student-info { margin-bottom: 20px; }
            .report-content { line-height: 1.6; }
            .report-content p { margin-bottom: 1rem; }
            .report-content ul, .report-content ol { margin-bottom: 1rem; padding-left: 2rem; }
            .report-content li { margin-bottom: 0.25rem; }
            .report-content li ul, .report-content li ol { margin-top: 0.25rem; margin-bottom: 0.25rem; }
            .report-content strong { font-weight: bold; }
            .report-content em { font-style: italic; }
            .report-content code { font-family: monospace; background-color: #f5f5f5; padding: 2px 4px; border-radius: 4px; }
            .report-content pre { background-color: #f5f5f5; padding: 12px; border-radius: 4px; overflow: auto; margin-bottom: 1rem; }
            .report-content pre code { background-color: transparent; padding: 0; }
            .report-content blockquote { border-left: 3px solid #1976d2; padding-left: 1rem; margin-left: 1rem; font-style: italic; margin-bottom: 1rem; }
            .report-content hr { border: none; border-top: 1px solid #ddd; margin: 1rem 0; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>Progress Report</h1>
          <div class="student-info">
            <p><strong>Student:</strong> ${student?.name || 'Unknown'}</p>
            <p><strong>Age:</strong> ${student?.age || 'N/A'}</p>
            <p><strong>Grade:</strong> ${student?.grade || 'N/A'}</p>
            <p><strong>Report Type:</strong> ${viewingReport.reportType === 'quarterly' ? 'Quarterly' : 'Annual'}</p>
            <p><strong>Period:</strong> ${formatDate(viewingReport.periodStart)} - ${formatDate(viewingReport.periodEnd)}</p>
            <p><strong>Due Date:</strong> ${formatDate(viewingReport.dueDate)}</p>
          </div>
          <div class="report-content">${formattedReport}</div>
        </body>
      </html>
    `;

    printWindow.document.write(reportContent);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportPDF = () => {
    handlePrintReport(); // Use browser's print-to-PDF
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
              label="Edit Report"
              onClick={() => handleViewEdit(report)}
            />
          );
          if (report.finalReportText) {
            actions.push(
              <GridActionsCellItem
                icon={<VisibilityIcon />}
                label="View Saved Report"
                onClick={() => handleViewSavedReport(report)}
              />
            );
          }
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

      {/* View/Edit Saved Report Dialog */}
      <Dialog open={reportViewDialog.open} onClose={handleCloseReportView} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box>
            <Box component="span">Progress Report</Box>
            {viewingReport && (
              <Box component="div" sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                {students.find(s => s.id === viewingReport.studentId)?.name || 'Unknown Student'}
                {' - '}
                {viewingReport.reportType === 'quarterly' ? 'Quarterly' : 'Annual'}
                {' - '}
                {formatDate(viewingReport.periodStart)} to {formatDate(viewingReport.periodEnd)}
              </Box>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {editingReportText ? (
              <TextField
                fullWidth
                multiline
                rows={20}
                value={editedReportText}
                onChange={(e) => setEditedReportText(e.target.value)}
                placeholder="Enter report text (markdown supported)..."
                sx={{ fontFamily: 'monospace' }}
              />
            ) : viewingReport?.finalReportText ? (
              <Box
                sx={{
                  '& h1': { fontSize: '1.5rem', fontWeight: 'bold', mt: 2, mb: 1, color: 'text.primary' },
                  '& h2': { fontSize: '1.25rem', fontWeight: 'bold', mt: 1.5, mb: 0.75, color: 'text.primary' },
                  '& h3': { fontSize: '1.1rem', fontWeight: 'bold', mt: 1, mb: 0.5, color: 'text.primary' },
                  '& p': { mb: 1.5, lineHeight: 1.6, color: 'text.primary' },
                  '& ul, & ol': { mb: 1.5, pl: 3, color: 'text.primary' },
                  '& li': { mb: 0.5, lineHeight: 1.6 },
                  '& strong': { fontWeight: 'bold' },
                  '& em': { fontStyle: 'italic' },
                  '& code': { 
                    fontFamily: 'monospace', 
                    backgroundColor: 'action.hover', 
                    padding: '2px 4px', 
                    borderRadius: '4px',
                    fontSize: '0.9em'
                  },
                  '& pre': { 
                    backgroundColor: 'action.hover', 
                    padding: '12px', 
                    borderRadius: '4px',
                    overflow: 'auto',
                    mb: 1.5
                  },
                  '& pre code': { 
                    backgroundColor: 'transparent', 
                    padding: 0 
                  },
                  '& blockquote': { 
                    borderLeft: '3px solid',
                    borderColor: 'primary.main',
                    pl: 2,
                    ml: 2,
                    fontStyle: 'italic',
                    mb: 1.5
                  },
                  '& hr': { 
                    border: 'none',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    my: 2
                  },
                  '& a': { 
                    color: 'primary.main',
                    textDecoration: 'underline'
                  },
                  lineHeight: 1.6,
                }}
                dangerouslySetInnerHTML={{ __html: convertMarkupToHtml(viewingReport.finalReportText) }}
              />
            ) : (
              <Box>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  No saved report content available. Use "Edit Report" to generate and save a report.
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => {
                    handleCloseReportView();
                    if (viewingReport) {
                      handleViewEdit(viewingReport);
                    }
                  }}
                >
                  Generate Report
                </Button>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          {editingReportText ? (
            <>
              <Button onClick={handleCancelEditReportText} disabled={savingReport}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSaveReportText}
                disabled={savingReport}
              >
                {savingReport ? 'Saving...' : 'Save'}
              </Button>
            </>
          ) : (
            <>
              <Box sx={{ display: 'flex', gap: 1, mr: 1 }}>
                <Button
                  startIcon={<EditIcon />}
                  onClick={handleEditReportText}
                >
                  {viewingReport?.finalReportText ? 'Edit' : 'Add Content'}
                </Button>
                <Button
                  startIcon={<PrintIcon />}
                  onClick={handlePrintReport}
                  disabled={!viewingReport?.finalReportText}
                >
                  Print
                </Button>
                <Button
                  startIcon={<PdfIcon />}
                  onClick={handleExportPDF}
                  disabled={!viewingReport?.finalReportText}
                >
                  Export PDF
                </Button>
              </Box>
              <Button onClick={handleCloseReportView}>Close</Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

