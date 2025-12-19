import { useState, useEffect, useCallback } from 'react';
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
} from '@mui/material';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import type { Evaluation, Student } from '../types';
import {
  getEvaluations,
  addEvaluation,
  updateEvaluation,
  deleteEvaluation,
  getStudents,
} from '../utils/storage-api';
import { generateId, formatDate } from '../utils/helpers';
import { useSchool } from '../context/SchoolContext';
import { useConfirm } from '../hooks/useConfirm';

export const Evaluations = () => {
  const navigate = useNavigate();
  const { selectedSchool } = useSchool();
  const { confirm, ConfirmDialog } = useConfirm();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState<Evaluation | null>(null);
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

  const loadData = useCallback(() => {
    const schoolStudents = getStudents(selectedSchool);
    setStudents(schoolStudents);
    const schoolEvaluations = getEvaluations(selectedSchool);
    setEvaluations(schoolEvaluations);
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
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingEvaluation(null);
  };

  const handleSave = () => {
    if (!formData.studentId || !formData.grade || !formData.evaluationType) {
      alert('Please fill in Student, Grade, and Evaluation Type');
      return;
    }

    if (editingEvaluation) {
      updateEvaluation(editingEvaluation.id, {
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
      addEvaluation({
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
  };

  const handleDelete = (id: string) => {
    const evaluation = evaluations.find(e => e.id === id);
    confirm({
      title: 'Delete Evaluation',
      message: `Are you sure you want to delete this evaluation${evaluation ? ` for ${students.find(s => s.id === evaluation.studentId)?.name || 'student'}` : ''}?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: () => {
        deleteEvaluation(id);
        loadData();
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

  const rows = evaluations.map(evaluation => ({
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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Evaluation Tracker
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Evaluation
        </Button>
      </Box>

      <Box sx={{ height: 'calc(100vh - 200px)', width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 25 },
            },
          }}
          processRowUpdate={(newRow, oldRow) => {
            // Find which field changed
            const changedField = Object.keys(newRow).find(
              key => newRow[key] !== oldRow[key] && key !== 'id' && key !== 'studentId'
            );
            if (changedField) {
              updateEvaluation(newRow.id as string, {
                [changedField]: newRow[changedField] || undefined,
              });
              loadData();
            }
            return newRow;
          }}
          onProcessRowUpdateError={(error) => {
            console.error('Error updating row:', error);
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

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
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

      <ConfirmDialog />
    </Box>
  );
};

