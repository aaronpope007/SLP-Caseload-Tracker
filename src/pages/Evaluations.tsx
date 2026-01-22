import { useState, useEffect, useCallback, useRef } from 'react';
import { logError } from '../utils/logger';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Tabs,
  Tab,
  Tooltip,
} from '@mui/material';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Person as PersonIcon,
  RecordVoiceOver as RecordVoiceOverIcon,
  Visibility as VisibilityIcon,
  Print as PrintIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import type { Evaluation, Student, ArticulationScreener, ProgressReport } from '../types';
import {
  getEvaluations,
  addEvaluation,
  updateEvaluation,
  deleteEvaluation,
  getStudents,
  getArticulationScreeners,
  getArticulationScreenersByStudent,
  deleteArticulationScreener,
  updateArticulationScreener,
  getProgressReports,
  addProgressReport,
  updateProgressReport,
  deleteProgressReport,
} from '../utils/storage-api';
import { generateId, formatDate, convertMarkupToHtml } from '../utils/helpers';
import { useSchool } from '../context/SchoolContext';
import { useConfirm, useSnackbar, useDialog } from '../hooks';
import { ArticulationScreenerDialog } from '../components/ArticulationScreenerDialog';

export const Evaluations = () => {
  const navigate = useNavigate();
  const { selectedSchool } = useSchool();
  const { confirm, ConfirmDialog } = useConfirm();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const evaluationDialog = useDialog();
  const screenerDialog = useDialog();
  const reportDialog = useDialog();
  const progressReportDialog = useDialog();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [screeners, setScreeners] = useState<ArticulationScreener[]>([]);
  const [progressReports, setProgressReports] = useState<ProgressReport[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [editingEvaluation, setEditingEvaluation] = useState<Evaluation | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [screenerStudentId, setScreenerStudentId] = useState<string>('');
  const [editingScreener, setEditingScreener] = useState<ArticulationScreener | null>(null);
  const [viewingScreener, setViewingScreener] = useState<ArticulationScreener | null>(null);
  const [editingReport, setEditingReport] = useState(false);
  const [editedReportText, setEditedReportText] = useState('');
  const [savingReport, setSavingReport] = useState(false);
  const [viewingProgressReport, setViewingProgressReport] = useState<ProgressReport | null>(null);
  const [editingProgressReport, setEditingProgressReport] = useState(false);
  const [editedProgressReportText, setEditedProgressReportText] = useState('');
  const [savingProgressReport, setSavingProgressReport] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  
  // Track if component is mounted to prevent memory leaks
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const [formData, setFormData] = useState({
    studentId: '',
    grade: '',
    evaluationType: '',
    areasOfConcern: '',
    teacher: '',
    resultsOfScreening: '',
    dueDate: '',
    assessments: '',
    qualify: '',
    reportCompleted: '',
    iepCompleted: '',
    meetingDate: '',
  });

  const loadData = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    const schoolStudents = await getStudents(selectedSchool);
    if (!isMountedRef.current) return;
    setStudents(schoolStudents);
    
    const schoolEvaluations = await getEvaluations(selectedSchool);
    if (!isMountedRef.current) return;
    setEvaluations(schoolEvaluations);
    
    const schoolScreeners = await getArticulationScreeners(selectedSchool);
    if (!isMountedRef.current) return;
    setScreeners(schoolScreeners);
    
    const schoolProgressReports = await getProgressReports(undefined, selectedSchool);
    if (!isMountedRef.current) return;
    setProgressReports(schoolProgressReports);
  }, [selectedSchool]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  const handleOpenDialog = (evaluation?: Evaluation) => {
    if (evaluation) {
      setEditingEvaluation(evaluation);
      setFormData({
        studentId: evaluation.studentId,
        grade: evaluation.grade,
        evaluationType: evaluation.evaluationType,
        areasOfConcern: evaluation.areasOfConcern,
        teacher: evaluation.teacher || '',
        resultsOfScreening: evaluation.resultsOfScreening || '',
        dueDate: evaluation.dueDate || '',
        assessments: evaluation.assessments || '',
        qualify: evaluation.qualify || '',
        reportCompleted: evaluation.reportCompleted || '',
        iepCompleted: evaluation.iepCompleted || '',
        meetingDate: evaluation.meetingDate || '',
      });
    } else {
      setEditingEvaluation(null);
      setFormData({
        studentId: '',
        grade: '',
        evaluationType: '',
        areasOfConcern: '',
        teacher: '',
        resultsOfScreening: '',
        dueDate: '',
        assessments: '',
        qualify: '',
        reportCompleted: '',
        iepCompleted: '',
        meetingDate: '',
      });
    }
    evaluationDialog.openDialog();
  };

  const handleCloseDialog = () => {
    evaluationDialog.closeDialog();
    setEditingEvaluation(null);
  };

  const handleSave = async () => {
    if (!formData.studentId || !formData.grade || !formData.evaluationType) {
      alert('Please fill in Student, Grade, and Evaluation Type');
      return;
    }

    if (editingEvaluation) {
      await updateEvaluation(editingEvaluation.id, {
        studentId: formData.studentId,
        grade: formData.grade,
        evaluationType: formData.evaluationType,
        areasOfConcern: formData.areasOfConcern,
        teacher: formData.teacher || undefined,
        resultsOfScreening: formData.resultsOfScreening || undefined,
        dueDate: formData.dueDate || undefined,
        assessments: formData.assessments || undefined,
        qualify: formData.qualify || undefined,
        reportCompleted: formData.reportCompleted || undefined,
        iepCompleted: formData.iepCompleted || undefined,
        meetingDate: formData.meetingDate || undefined,
      });
    } else {
      await addEvaluation({
        id: generateId(),
        studentId: formData.studentId,
        grade: formData.grade,
        evaluationType: formData.evaluationType,
        areasOfConcern: formData.areasOfConcern,
        teacher: formData.teacher || undefined,
        resultsOfScreening: formData.resultsOfScreening || undefined,
        dueDate: formData.dueDate || undefined,
        assessments: formData.assessments || undefined,
        qualify: formData.qualify || undefined,
        reportCompleted: formData.reportCompleted || undefined,
        iepCompleted: formData.iepCompleted || undefined,
        meetingDate: formData.meetingDate || undefined,
        dateCreated: new Date().toISOString(),
        dateUpdated: new Date().toISOString(),
      });
    }
    loadData();
    handleCloseDialog();
    if (editingEvaluation) {
      showSnackbar('Evaluation updated successfully', 'success');
    } else {
      showSnackbar('Evaluation created successfully', 'success');
    }
  };

  const handleDelete = (id: string) => {
    const evaluation = evaluations.find(e => e.id === id);
    confirm({
      title: 'Delete Evaluation',
      message: `Are you sure you want to delete this evaluation${evaluation ? ` for ${students.find(s => s.id === evaluation.studentId)?.name || 'student'}` : ''}?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        await deleteEvaluation(id);
        loadData();
        showSnackbar('Evaluation deleted successfully', 'success');
      },
    });
  };

  const handleOpenScreener = () => {
    if (screenerStudentId) {
      const student = students.find(s => s.id === screenerStudentId);
      if (student) {
        setSelectedStudent(student);
        setEditingScreener(null);
        screenerDialog.openDialog();
      }
    } else {
      alert('Please select a student first');
    }
  };

  const handleCloseScreener = () => {
    screenerDialog.closeDialog();
    setSelectedStudent(null);
    setEditingScreener(null);
    loadData(); // Refresh screeners list when dialog closes
  };

  const handleEditScreener = (screener: ArticulationScreener) => {
    const student = students.find(s => s.id === screener.studentId);
    if (student) {
      setSelectedStudent(student);
      setEditingScreener(screener);
      screenerDialog.openDialog();
    }
  };

  const handleDeleteScreener = (id: string) => {
    const screener = screeners.find(s => s.id === id);
    confirm({
      title: 'Delete Articulation Screener',
      message: `Are you sure you want to delete this articulation screener${screener ? ` for ${students.find(s => s.id === screener.studentId)?.name || 'student'}` : ''}?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        await deleteArticulationScreener(id);
        loadData();
        showSnackbar('Articulation screener deleted successfully', 'success');
      },
    });
  };

  const handleViewReport = (screener: ArticulationScreener) => {
    setViewingScreener(screener);
    setEditedReportText(screener.report || '');
    setEditingReport(false);
    reportDialog.openDialog();
  };

  const handleCloseReport = () => {
    reportDialog.closeDialog();
    setViewingScreener(null);
    setEditingReport(false);
    setEditedReportText('');
  };

  const handleEditReport = () => {
    if (viewingScreener) {
      setEditedReportText(viewingScreener.report || '');
      setEditingReport(true);
    }
  };

  const handleCancelEditReport = () => {
    if (viewingScreener) {
      setEditedReportText(viewingScreener.report || '');
      setEditingReport(false);
    }
  };

  const handleSaveReport = async () => {
    if (!viewingScreener) return;
    
    setSavingReport(true);
    try {
      await updateArticulationScreener(viewingScreener.id, {
        report: editedReportText || undefined,
      });
      
      // Update the local screener state
      const updatedScreener = { ...viewingScreener, report: editedReportText || undefined };
      setViewingScreener(updatedScreener);
      
      // Update the screeners list
      setScreeners(prev => prev.map(s => s.id === viewingScreener.id ? updatedScreener : s));
      
      setEditingReport(false);
      showSnackbar('Report updated successfully', 'success');
    } catch (error: unknown) {
      logError('Failed to save report', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save report';
      showSnackbar(errorMessage, 'error');
    } finally {
      setSavingReport(false);
    }
  };

  const handlePrintReport = () => {
    if (!viewingScreener || !viewingScreener.report) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const student = students.find(s => s.id === viewingScreener.studentId);
    const formattedReport = convertMarkupToHtml(viewingScreener.report);
    const reportContent = `
      <html>
        <head>
          <title>Articulation Screening Report - ${student?.name || 'Student'}</title>
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
          <h1>Articulation Screening Report</h1>
          <div class="student-info">
            <p><strong>Student:</strong> ${student?.name || 'Unknown'}</p>
            <p><strong>Age:</strong> ${student?.age || 'N/A'}</p>
            <p><strong>Grade:</strong> ${student?.grade || 'N/A'}</p>
            <p><strong>Screening Date:</strong> ${formatDate(viewingScreener.date)}</p>
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

  // Progress Report handlers
  const handleViewProgressReport = (report: ProgressReport) => {
    setViewingProgressReport(report);
    setEditedProgressReportText(report.content || '');
    setEditingProgressReport(false);
    progressReportDialog.openDialog();
  };

  const handleCloseProgressReport = () => {
    progressReportDialog.closeDialog();
    setViewingProgressReport(null);
    setEditingProgressReport(false);
    setEditedProgressReportText('');
  };

  const handleEditProgressReport = () => {
    if (viewingProgressReport) {
      setEditedProgressReportText(viewingProgressReport.content || '');
      setEditingProgressReport(true);
    }
  };

  const handleCancelEditProgressReport = () => {
    if (viewingProgressReport) {
      setEditedProgressReportText(viewingProgressReport.content || '');
      setEditingProgressReport(false);
    }
  };

  const handleSaveProgressReport = async () => {
    if (!viewingProgressReport || !isMountedRef.current) return;
    
    setSavingProgressReport(true);
    try {
      await updateProgressReport(viewingProgressReport.id, {
        content: editedProgressReportText || undefined,
      });
      
      if (!isMountedRef.current) return;
      
      // Update the local progress report state
      const updatedReport = { ...viewingProgressReport, content: editedProgressReportText || undefined };
      setViewingProgressReport(updatedReport);
      
      // Update the progress reports list
      setProgressReports(prev => prev.map(r => r.id === viewingProgressReport.id ? updatedReport : r));
      
      setEditingProgressReport(false);
      showSnackbar('Progress report updated successfully', 'success');
    } catch (error: unknown) {
      if (!isMountedRef.current) return;
      logError('Failed to save progress report', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save progress report';
      showSnackbar(errorMessage, 'error');
    } finally {
      if (isMountedRef.current) {
        setSavingProgressReport(false);
      }
    }
  };

  const handlePrintProgressReport = () => {
    if (!viewingProgressReport || !viewingProgressReport.content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const student = students.find(s => s.id === viewingProgressReport.studentId);
    const formattedReport = convertMarkupToHtml(viewingProgressReport.content);
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
            <p><strong>Report Type:</strong> ${viewingProgressReport.reportType === 'quarterly' ? 'Quarterly' : 'Annual'}</p>
            <p><strong>Period:</strong> ${formatDate(viewingProgressReport.periodStart)} - ${formatDate(viewingProgressReport.periodEnd)}</p>
            <p><strong>Due Date:</strong> ${formatDate(viewingProgressReport.dueDate)}</p>
          </div>
          <div class="report-content">${formattedReport}</div>
        </body>
      </html>
    `;

    printWindow.document.write(reportContent);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportProgressReportPDF = () => {
    handlePrintProgressReport(); // Use browser's print-to-PDF
  };

  const handleDeleteProgressReport = (id: string) => {
    const report = progressReports.find(r => r.id === id);
    confirm({
      title: 'Delete Progress Report',
      message: `Are you sure you want to delete this progress report${report ? ` for ${students.find(s => s.id === report.studentId)?.name || 'student'}` : ''}?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        if (!isMountedRef.current) return;
        await deleteProgressReport(id);
        if (!isMountedRef.current) return;
        loadData();
        showSnackbar('Progress report deleted successfully', 'success');
      },
    });
  };


  const columns: GridColDef[] = [
    {
      field: 'studentName',
      headerName: 'Student',
      width: 150,
      editable: false,
      valueGetter: (value, row) => {
        const student = students.find(s => s.id === row.studentId);
        return student?.name || 'Unknown';
      },
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon fontSize="small" />
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      ),
    },
    {
      field: 'grade',
      headerName: 'Grade',
      width: 80,
      editable: true,
    },
    {
      field: 'evaluationType',
      headerName: 'Initial or 3-year?',
      width: 150,
      editable: true,
    },
    {
      field: 'areasOfConcern',
      headerName: 'Areas of Concern',
      width: 200,
      editable: true,
    },
    {
      field: 'teacher',
      headerName: 'Teacher',
      width: 120,
      editable: true,
    },
    {
      field: 'resultsOfScreening',
      headerName: 'Results of Screening',
      width: 150,
      editable: true,
    },
    {
      field: 'dueDate',
      headerName: 'Due Date',
      width: 120,
      editable: true,
    },
    {
      field: 'assessments',
      headerName: 'Assessments',
      width: 200,
      editable: true,
    },
    {
      field: 'qualify',
      headerName: 'Qualify?',
      width: 120,
      editable: true,
    },
    {
      field: 'reportCompleted',
      headerName: 'Report Completed',
      width: 130,
      editable: true,
    },
    {
      field: 'iepCompleted',
      headerName: 'IEP Completed',
      width: 130,
      editable: true,
    },
    {
      field: 'meetingDate',
      headerName: 'Meeting DATE',
      width: 130,
      editable: true,
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 100,
      getActions: (params: GridRowParams) => [
        <GridActionsCellItem
          icon={<DeleteIcon />}
          label="Delete"
          onClick={() => handleDelete(params.id as string)}
        />,
      ],
    },
  ];

  const evaluationRows = evaluations.map(evaluation => ({
    id: evaluation.id,
    studentId: evaluation.studentId,
    grade: evaluation.grade,
    evaluationType: evaluation.evaluationType,
    areasOfConcern: evaluation.areasOfConcern,
    teacher: evaluation.teacher || '',
    resultsOfScreening: evaluation.resultsOfScreening || '',
    dueDate: evaluation.dueDate || '',
    assessments: evaluation.assessments || '',
    qualify: evaluation.qualify || '',
    reportCompleted: evaluation.reportCompleted || '',
    iepCompleted: evaluation.iepCompleted || '',
    meetingDate: evaluation.meetingDate || '',
  }));

  const screenerColumns: GridColDef[] = [
    {
      field: 'studentName',
      headerName: 'Student',
      width: 150,
      editable: false,
      align: 'left',
      headerAlign: 'left',
      valueGetter: (value, row) => {
        const student = students.find(s => s.id === row.studentId);
        return student?.name || 'Unknown';
      },
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%' }}>
          <PersonIcon fontSize="small" />
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      ),
    },
    {
      field: 'date',
      headerName: 'Date',
      width: 120,
      editable: false,
      valueGetter: (value) => {
        return value ? formatDate(value) : '';
      },
    },
    {
      field: 'disorderedPhonemes',
      headerName: 'Disordered Phonemes',
      width: 250,
      editable: false,
      valueGetter: (value) => {
        if (Array.isArray(value) && value.length > 0) {
          return value.map((dp: { phoneme: string }) => dp.phoneme).join(', ');
        }
        return 'None';
      },
      renderCell: (params) => {
        const phonemes = params.row.disorderedPhonemes || [];
        const phonemeArray = Array.isArray(phonemes) ? phonemes : [];
        const displayCount = 5;
        const displayPhonemes = phonemeArray.slice(0, displayCount);
        const remainingCount = phonemeArray.length - displayCount;
        const allPhonemesText = phonemeArray.map((dp: { phoneme: string }) => dp.phoneme).join(', ');
        
        const content = (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', py: 1, height: '100%' }}>
            {phonemeArray.length > 0 ? (
              <>
                {displayPhonemes.map((dp: { phoneme: string }, index: number) => (
                  <Chip key={index} label={dp.phoneme} size="small" color="warning" sx={{ m: 0.25 }} />
                ))}
                {remainingCount > 0 && (
                  <Chip 
                    label={`+${remainingCount} more`} 
                    size="small" 
                    color="default" 
                    sx={{ m: 0.25, fontStyle: 'italic' }} 
                  />
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">None</Typography>
            )}
          </Box>
        );
        
        if (phonemeArray.length > displayCount) {
          return (
            <Tooltip 
              title={
                <Box>
                  <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 'bold' }}>
                    All Disordered Phonemes ({phonemeArray.length}):
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {phonemeArray.map((dp: { phoneme: string }, index: number) => (
                      <Chip key={index} label={dp.phoneme} size="small" color="warning" />
                    ))}
                  </Box>
                </Box>
              }
              arrow
              placement="top"
            >
              {content}
            </Tooltip>
          );
        }
        
        return content;
      },
    },
    {
      field: 'phonemeCount',
      headerName: 'Count',
      width: 80,
      editable: false,
      valueGetter: (value, row) => {
        return Array.isArray(row.disorderedPhonemes) ? row.disorderedPhonemes.length : 0;
      },
    },
    {
      field: 'hasReport',
      headerName: 'Report',
      width: 100,
      editable: false,
      valueGetter: (value, row) => {
        return row.report ? 'Yes' : 'No';
      },
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value === 'Yes' ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 180,
      getActions: (params: GridRowParams) => {
        const screener = screeners.find(s => s.id === params.id);
        const actions = [
          <GridActionsCellItem
            key="edit"
            icon={<EditIcon />}
            label="Edit"
            onClick={() => {
              if (screener) {
                handleEditScreener(screener);
              }
            }}
          />,
        ];
        
        if (screener?.report) {
          actions.push(
            <GridActionsCellItem
              key="view"
              icon={<VisibilityIcon />}
              label="View Report"
              onClick={() => {
                if (screener) {
                  handleViewReport(screener);
                }
              }}
            />
          );
        }
        
        actions.push(
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon />}
            label="Delete"
            onClick={() => handleDeleteScreener(params.id as string)}
          />
        );
        
        return actions;
      },
    },
  ];

  const screenerRows = screeners.map(screener => ({
    id: screener.id,
    studentId: screener.studentId,
    date: screener.date,
    disorderedPhonemes: screener.disorderedPhonemes || [],
    report: screener.report || '',
    hasReport: screener.report ? 'Yes' : 'No',
  }));

  const progressReportColumns: GridColDef[] = [
    {
      field: 'studentName',
      headerName: 'Student',
      width: 150,
      editable: false,
      align: 'left',
      headerAlign: 'left',
      valueGetter: (value, row) => {
        const student = students.find(s => s.id === row.studentId);
        return student?.name || 'Unknown';
      },
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%' }}>
          <PersonIcon fontSize="small" />
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      ),
    },
    {
      field: 'reportType',
      headerName: 'Type',
      width: 100,
      editable: false,
      valueGetter: (value) => {
        return value === 'quarterly' ? 'Quarterly' : 'Annual';
      },
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value === 'Quarterly' ? 'primary' : 'secondary'}
        />
      ),
    },
    {
      field: 'periodStart',
      headerName: 'Period Start',
      width: 120,
      editable: false,
      valueGetter: (value) => {
        return value ? formatDate(value) : '';
      },
    },
    {
      field: 'periodEnd',
      headerName: 'Period End',
      width: 120,
      editable: false,
      valueGetter: (value) => {
        return value ? formatDate(value) : '';
      },
    },
    {
      field: 'dueDate',
      headerName: 'Due Date',
      width: 120,
      editable: false,
      valueGetter: (value) => {
        return value ? formatDate(value) : '';
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      editable: false,
      renderCell: (params) => {
        const status = params.value as string;
        const colorMap: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
          'scheduled': 'default',
          'in-progress': 'info',
          'completed': 'success',
          'overdue': 'error',
        };
        return (
          <Chip
            label={status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
            size="small"
            color={colorMap[status] || 'default'}
          />
        );
      },
    },
    {
      field: 'hasContent',
      headerName: 'Content',
      width: 100,
      editable: false,
      valueGetter: (value, row) => {
        return row.content ? 'Yes' : 'No';
      },
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value === 'Yes' ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 180,
      getActions: (params: GridRowParams) => {
        const report = progressReports.find(r => r.id === params.id);
        const actions = [];
        
        if (report?.content) {
          actions.push(
            <GridActionsCellItem
              key="view"
              icon={<VisibilityIcon />}
              label="View Report"
              onClick={() => {
                if (report) {
                  handleViewProgressReport(report);
                }
              }}
            />
          );
        }
        
        actions.push(
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon />}
            label="Delete"
            onClick={() => handleDeleteProgressReport(params.id as string)}
          />
        );
        
        return actions;
      },
    },
  ];

  const progressReportRows = progressReports.map(report => ({
    id: report.id,
    studentId: report.studentId,
    reportType: report.reportType,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    dueDate: report.dueDate,
    status: report.status,
    content: report.content || '',
    hasContent: report.content ? 'Yes' : 'No',
  }));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Evaluation Tracker
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {activeTab === 1 && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Select Student for Screener</InputLabel>
              <Select
                value={screenerStudentId}
                onChange={(e) => setScreenerStudentId(e.target.value)}
                label="Select Student for Screener"
              >
                {students.map((student) => (
                  <MenuItem key={student.id} value={student.id}>
                    {student.name} ({student.grade})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {activeTab === 1 && (
            <Button
              variant="outlined"
              startIcon={<RecordVoiceOverIcon />}
              onClick={handleOpenScreener}
              disabled={!screenerStudentId}
            >
              New Articulation Screener
            </Button>
          )}
          {activeTab === 0 && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Add Evaluation
            </Button>
          )}
        </Box>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="Evaluations" />
          <Tab label="Articulation Screeners" />
          <Tab label="Progress Reports" />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <Box sx={{ height: 'calc(100vh - 200px)', width: '100%' }}>
          <DataGrid
            rows={evaluationRows}
            columns={columns}
            pageSizeOptions={[10, 25, 50, 100]}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 25 },
              },
            }}
            processRowUpdate={async (newRow, oldRow) => {
              // Find which field changed
              const changedField = Object.keys(newRow).find(
                key => newRow[key] !== oldRow[key] && key !== 'id' && key !== 'studentId'
              );
              if (changedField) {
                await updateEvaluation(newRow.id as string, {
                  [changedField]: newRow[changedField] || undefined,
                });
                loadData();
              }
              return newRow;
            }}
            onProcessRowUpdateError={(error) => {
              logError('Error updating row', error);
            }}
            editMode="cell"
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
      )}

      {activeTab === 1 && (
        <Box sx={{ height: 'calc(100vh - 200px)', width: '100%' }}>
          <DataGrid
            rows={screenerRows}
            columns={screenerColumns}
            pageSizeOptions={[10, 25, 50, 100]}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 25 },
              },
            }}
            getRowHeight={(params) => {
              if (!params.row) {
                return 52; // Default height
              }
              const phonemes = params.row.disorderedPhonemes || [];
              const phonemeCount = Array.isArray(phonemes) ? phonemes.length : 0;
              // Calculate height based on number of phonemes (each chip row is ~32px, minimum 52px)
              const chipRows = Math.ceil(phonemeCount / 4); // Assuming ~4 chips per row at 250px width
              return Math.max(52, 20 + (chipRows * 32));
            }}
            disableRowSelectionOnClick
            sx={{
              '& .MuiDataGrid-cell': {
                display: 'flex',
                alignItems: 'center',
                py: 1,
              },
              '& .MuiDataGrid-cell:focus': {
                outline: 'none',
              },
              '& .MuiDataGrid-cell:focus-within': {
                outline: 'none',
              },
            }}
          />
        </Box>
      )}

      {activeTab === 2 && (
        <Box sx={{ height: 'calc(100vh - 200px)', width: '100%' }}>
          <DataGrid
            rows={progressReportRows}
            columns={progressReportColumns}
            pageSizeOptions={[10, 25, 50, 100]}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 25 },
              },
            }}
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
      )}

      <Dialog open={evaluationDialog.open} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingEvaluation ? 'Edit Evaluation' : 'Add New Evaluation'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Student</InputLabel>
              <Select
                value={formData.studentId}
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                label="Student"
              >
                {students.map((student) => (
                  <MenuItem key={student.id} value={student.id}>
                    {student.name} ({student.grade})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Grade"
              fullWidth
              value={formData.grade}
              onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
              required
            />
            <TextField
              label="Initial or 3-year?"
              fullWidth
              value={formData.evaluationType}
              onChange={(e) => setFormData({ ...formData, evaluationType: e.target.value })}
              required
              helperText="e.g., Initial, 3-year, Adding Academic"
            />
            <TextField
              label="Areas of Concern"
              fullWidth
              value={formData.areasOfConcern}
              onChange={(e) => setFormData({ ...formData, areasOfConcern: e.target.value })}
              helperText="e.g., artic, expressive & receptive, ASD"
            />
            <TextField
              label="Teacher"
              fullWidth
              value={formData.teacher}
              onChange={(e) => setFormData({ ...formData, teacher: e.target.value })}
            />
            <TextField
              label="Results of Screening"
              fullWidth
              value={formData.resultsOfScreening}
              onChange={(e) => setFormData({ ...formData, resultsOfScreening: e.target.value })}
            />
            <TextField
              label="Due Date"
              fullWidth
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              helperText="e.g., November 4th, December 16th"
            />
            <TextField
              label="Assessments"
              fullWidth
              value={formData.assessments}
              onChange={(e) => setFormData({ ...formData, assessments: e.target.value })}
              helperText="e.g., GFTA, CASL, s/1 sample"
            />
            <TextField
              label="Qualify?"
              fullWidth
              value={formData.qualify}
              onChange={(e) => setFormData({ ...formData, qualify: e.target.value })}
              helperText="e.g., qualified, did not qualify"
            />
            <TextField
              label="Report Completed"
              fullWidth
              value={formData.reportCompleted}
              onChange={(e) => setFormData({ ...formData, reportCompleted: e.target.value })}
              helperText="e.g., yes, no"
            />
            <TextField
              label="IEP Completed"
              fullWidth
              value={formData.iepCompleted}
              onChange={(e) => setFormData({ ...formData, iepCompleted: e.target.value })}
              helperText="e.g., yes, no, n/a"
            />
            <TextField
              label="Meeting DATE"
              fullWidth
              value={formData.meetingDate}
              onChange={(e) => setFormData({ ...formData, meetingDate: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {selectedStudent && (
        <ArticulationScreenerDialog
          open={screenerDialog.open}
          onClose={handleCloseScreener}
          student={selectedStudent}
          evaluation={editingEvaluation || undefined}
          existingScreener={editingScreener || undefined}
        />
      )}

      <Dialog open={reportDialog.open} onClose={handleCloseReport} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box>
            <Box component="span">Articulation Screening Report</Box>
            {viewingScreener && (
              <Box component="div" sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                {students.find(s => s.id === viewingScreener.studentId)?.name || 'Unknown Student'}
                {' - '}
                {formatDate(viewingScreener.date)}
              </Box>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {editingReport ? (
              <TextField
                fullWidth
                multiline
                rows={20}
                value={editedReportText}
                onChange={(e) => setEditedReportText(e.target.value)}
                placeholder="Enter report text (markdown supported)..."
                sx={{ fontFamily: 'monospace' }}
              />
            ) : viewingScreener?.report ? (
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
                dangerouslySetInnerHTML={{ __html: convertMarkupToHtml(viewingScreener.report) }}
              />
            ) : (
              <Box>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  No report available for this screening.
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={handleEditReport}
                >
                  Add Report
                </Button>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          {editingReport ? (
            <>
              <Button onClick={handleCancelEditReport} disabled={savingReport}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSaveReport}
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
                  onClick={handleEditReport}
                >
                  {viewingScreener?.report ? 'Edit' : 'Add Report'}
                </Button>
                <Button
                  startIcon={<PrintIcon />}
                  onClick={handlePrintReport}
                  disabled={!viewingScreener?.report}
                >
                  Print
                </Button>
                <Button
                  startIcon={<PdfIcon />}
                  onClick={handleExportPDF}
                  disabled={!viewingScreener?.report}
                >
                  Export PDF
                </Button>
              </Box>
              <Button onClick={handleCloseReport}>Close</Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={progressReportDialog.open} onClose={handleCloseProgressReport} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box>
            <Box component="span">Progress Report</Box>
            {viewingProgressReport && (
              <Box component="div" sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                {students.find(s => s.id === viewingProgressReport.studentId)?.name || 'Unknown Student'}
                {' - '}
                {viewingProgressReport.reportType === 'quarterly' ? 'Quarterly' : 'Annual'}
                {' - '}
                {formatDate(viewingProgressReport.periodStart)} to {formatDate(viewingProgressReport.periodEnd)}
              </Box>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {editingProgressReport ? (
              <TextField
                fullWidth
                multiline
                rows={20}
                value={editedProgressReportText}
                onChange={(e) => setEditedProgressReportText(e.target.value)}
                placeholder="Enter report text (markdown supported)..."
                sx={{ fontFamily: 'monospace' }}
              />
            ) : viewingProgressReport?.content ? (
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
                dangerouslySetInnerHTML={{ __html: convertMarkupToHtml(viewingProgressReport.content) }}
              />
            ) : (
              <Box>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  No content available for this progress report.
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={handleEditProgressReport}
                >
                  Add Content
                </Button>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          {editingProgressReport ? (
            <>
              <Button onClick={handleCancelEditProgressReport} disabled={savingProgressReport}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSaveProgressReport}
                disabled={savingProgressReport}
              >
                {savingProgressReport ? 'Saving...' : 'Save'}
              </Button>
            </>
          ) : (
            <>
              <Box sx={{ display: 'flex', gap: 1, mr: 1 }}>
                <Button
                  startIcon={<EditIcon />}
                  onClick={handleEditProgressReport}
                >
                  {viewingProgressReport?.content ? 'Edit' : 'Add Content'}
                </Button>
                <Button
                  startIcon={<PrintIcon />}
                  onClick={handlePrintProgressReport}
                  disabled={!viewingProgressReport?.content}
                >
                  Print
                </Button>
                <Button
                  startIcon={<PdfIcon />}
                  onClick={handleExportProgressReportPDF}
                  disabled={!viewingProgressReport?.content}
                >
                  Export PDF
                </Button>
              </Box>
              <Button onClick={handleCloseProgressReport}>Close</Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <ConfirmDialog />

      <SnackbarComponent />
    </Box>
  );
};


