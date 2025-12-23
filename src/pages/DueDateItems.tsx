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
} from '@mui/material';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import type { DueDateItem, Student } from '../types';
import {
  getDueDateItems,
  addDueDateItem,
  updateDueDateItem,
  deleteDueDateItem,
  completeDueDateItem,
  getStudents,
} from '../utils/storage-api';
import { generateId, formatDate } from '../utils/helpers';
import { useSchool } from '../context/SchoolContext';
import { useConfirm } from '../hooks/useConfirm';

const getStatusColor = (status: DueDateItem['status']) => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'overdue':
      return 'error';
    case 'pending':
      return 'warning';
    default:
      return 'default';
  }
};

const getPriorityColor = (priority?: DueDateItem['priority']) => {
  switch (priority) {
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'info';
    default:
      return 'default';
  }
};

export const DueDateItems = () => {
  const { selectedSchool } = useSchool();
  const { confirm, ConfirmDialog } = useConfirm();
  const [items, setItems] = useState<DueDateItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DueDateItem | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [studentFilter, setStudentFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    studentId: '',
    category: '',
    priority: 'medium' as DueDateItem['priority'],
  });

  const loadData = useCallback(async () => {
    try {
      const schoolStudents = await getStudents(selectedSchool);
      setStudents(schoolStudents);
      
      const filters: any = { school: selectedSchool };
      if (statusFilter) filters.status = statusFilter;
      if (studentFilter) filters.studentId = studentFilter;
      if (categoryFilter) filters.category = categoryFilter;
      
      const allItems = await getDueDateItems(
        filters.studentId,
        filters.status,
        filters.category,
        undefined,
        undefined,
        filters.school
      );
      
      setItems(allItems);
    } catch (error) {
      console.error('Failed to load due date items:', error);
    }
  }, [selectedSchool, statusFilter, studentFilter, categoryFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenDialog = (item?: DueDateItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        title: item.title,
        description: item.description || '',
        dueDate: item.dueDate.split('T')[0],
        studentId: item.studentId || '',
        category: item.category || '',
        priority: item.priority || 'medium',
      });
    } else {
      setEditingItem(null);
      setFormData({
        title: '',
        description: '',
        dueDate: '',
        studentId: '',
        category: '',
        priority: 'medium',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.dueDate) {
      alert('Please fill in Title and Due Date');
      return;
    }

    const dueDateISO = new Date(formData.dueDate).toISOString();

    if (editingItem) {
      await updateDueDateItem(editingItem.id, {
        title: formData.title,
        description: formData.description || undefined,
        dueDate: dueDateISO,
        studentId: formData.studentId || undefined,
        category: formData.category || undefined,
        priority: formData.priority,
      });
    } else {
      await addDueDateItem({
        id: generateId(),
        title: formData.title,
        description: formData.description || undefined,
        dueDate: dueDateISO,
        studentId: formData.studentId || undefined,
        category: formData.category || undefined,
        priority: formData.priority,
        status: 'pending',
        dateCreated: new Date().toISOString(),
        dateUpdated: new Date().toISOString(),
      });
    }
    loadData();
    handleCloseDialog();
  };

  const handleComplete = async (id: string) => {
    try {
      await completeDueDateItem(id);
      await loadData();
    } catch (error) {
      console.error('Failed to complete item:', error);
    }
  };

  const handleDelete = (id: string) => {
    const item = items.find(i => i.id === id);
    confirm({
      title: 'Delete Due Date Item',
      message: `Are you sure you want to delete "${item?.title}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        await deleteDueDateItem(id);
        loadData();
      },
    });
  };

  const columns: GridColDef[] = [
    {
      field: 'title',
      headerName: 'Title',
      width: 250,
      editable: false,
    },
    {
      field: 'studentName',
      headerName: 'Student',
      width: 180,
      renderCell: (params) => {
        if (!params.row.studentId) return <Typography variant="body2" color="text.secondary">—</Typography>;
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
      field: 'category',
      headerName: 'Category',
      width: 130,
      renderCell: (params) => params.value ? <Chip label={params.value} size="small" /> : <Typography variant="body2" color="text.secondary">—</Typography>,
    },
    {
      field: 'priority',
      headerName: 'Priority',
      width: 110,
      renderCell: (params) => params.value ? (
        <Chip
          label={params.value.charAt(0).toUpperCase() + params.value.slice(1)}
          size="small"
          color={getPriorityColor(params.value) as any}
        />
      ) : <Typography variant="body2" color="text.secondary">—</Typography>,
    },
    {
      field: 'dueDate',
      headerName: 'Due Date',
      width: 150,
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
          label={params.value.charAt(0).toUpperCase() + params.value.slice(1)}
          size="small"
          color={getStatusColor(params.value) as any}
        />
      ),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 150,
      getActions: (params: GridRowParams) => {
        const actions = [];
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

  const rows = items.map(item => ({
    id: item.id,
    title: item.title,
    studentId: item.studentId,
    category: item.category,
    priority: item.priority,
    dueDate: item.dueDate,
    status: item.status,
  }));

  const overdueCount = items.filter(i => i.status === 'overdue').length;
  const pendingCount = items.filter(i => i.status === 'pending').length;
  const completedCount = items.filter(i => i.status === 'completed').length;

  // Get unique categories for filter
  const categories = Array.from(new Set(items.map(i => i.category).filter(Boolean)));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Due Date Items
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Item
        </Button>
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
              Pending
            </Typography>
            <Typography variant="h4" color="warning.main">
              {pendingCount}
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
                <MenuItem value="pending">Pending</MenuItem>
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
              <InputLabel>Category</InputLabel>
              <Select
                value={categoryFilter}
                label="Category"
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <MenuItem value="">All Categories</MenuItem>
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {overdueCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You have {overdueCount} overdue item{overdueCount > 1 ? 's' : ''}. Please complete them as soon as possible.
        </Alert>
      )}

      <Box sx={{ height: 'calc(100vh - 400px)', width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
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

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingItem ? 'Edit Due Date Item' : 'Add New Due Date Item'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Title"
              fullWidth
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <TextField
              label="Due Date"
              type="date"
              fullWidth
              required
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <FormControl fullWidth>
              <InputLabel>Student (Optional)</InputLabel>
              <Select
                value={formData.studentId}
                label="Student (Optional)"
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                {students.map((student) => (
                  <MenuItem key={student.id} value={student.id}>
                    {student.name} ({student.grade})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Category (Optional)</InputLabel>
              <Select
                value={formData.category}
                label="Category (Optional)"
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="IEP">IEP</MenuItem>
                <MenuItem value="Evaluation">Evaluation</MenuItem>
                <MenuItem value="Meeting">Meeting</MenuItem>
                <MenuItem value="Report">Report</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={formData.priority}
                label="Priority"
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as DueDateItem['priority'] })}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </Select>
            </FormControl>
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

