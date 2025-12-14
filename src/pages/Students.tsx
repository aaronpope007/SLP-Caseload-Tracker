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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
} from '@mui/icons-material';
import type { Student } from '../types';
import {
  getStudents,
  addStudent,
  updateStudent,
  deleteStudent,
} from '../utils/storage';
import { generateId } from '../utils/helpers';

export const Students = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    grade: '',
    concerns: '',
    status: 'active' as 'active' | 'discharged',
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
    
    setFilteredStudents(filtered);
  };

  const loadStudents = () => {
    const allStudents = getStudents();
    setStudents(allStudents);
    filterStudents();
  };

  useEffect(() => {
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    filterStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, students, showArchived]);

  const handleOpenDialog = (student?: Student) => {
    if (student) {
      setEditingStudent(student);
      setFormData({
        name: student.name,
        age: student.age.toString(),
        grade: student.grade,
        concerns: student.concerns.join(', '),
        status: student.status,
      });
    } else {
      setEditingStudent(null);
      setFormData({
        name: '',
        age: '',
        grade: '',
        concerns: '',
        status: 'active',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingStudent(null);
  };

  const handleSave = () => {
    const concernsArray = formData.concerns
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (editingStudent) {
      updateStudent(editingStudent.id, {
        name: formData.name,
        age: parseInt(formData.age) || 0,
        grade: formData.grade,
        concerns: concernsArray,
        status: formData.status,
      });
    } else {
      addStudent({
        id: generateId(),
        name: formData.name,
        age: parseInt(formData.age) || 0,
        grade: formData.grade,
        concerns: concernsArray,
        status: formData.status,
        dateAdded: new Date().toISOString(),
      });
    }
    loadStudents();
    handleCloseDialog();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      deleteStudent(id);
      loadStudents();
    }
    setAnchorEl(null);
  };

  const handleArchive = (id: string, archive: boolean) => {
    updateStudent(id, {
      archived: archive,
      dateArchived: archive ? new Date().toISOString() : undefined,
    });
    loadStudents();
    setAnchorEl(null);
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
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
        />
      </Box>

      <Grid container spacing={2}>
        {filteredStudents.length === 0 ? (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" align="center">
                  {searchTerm
                    ? `No ${showArchived ? 'archived ' : ''}students found matching your search`
                    : showArchived
                    ? 'No archived students'
                    : 'No students added yet. Click "Add Student" to get started.'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          filteredStudents.map((student) => (
            <Grid item xs={12} sm={6} md={4} key={student.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="h6">{student.name}</Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, student.id)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                  <Typography color="text.secondary" gutterBottom>
                    Age: {student.age} | Grade: {student.grade}
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
                </CardContent>
              </Card>
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
            />
            <TextField
              label="Age"
              type="number"
              fullWidth
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!formData.name}>
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
    </Box>
  );
};

