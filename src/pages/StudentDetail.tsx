import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  LinearProgress,
  TextField,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import type { Student, Goal } from '../types';
import {
  getStudents,
  getGoalsByStudent,
  addGoal,
  updateGoal,
  deleteGoal,
} from '../utils/storage';
import { generateId, formatDate } from '../utils/helpers';

export const StudentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const [formData, setFormData] = useState({
    description: '',
    baseline: '',
    target: '',
    status: 'in-progress' as 'in-progress' | 'achieved' | 'modified',
  });

  useEffect(() => {
    if (id) {
      loadStudent();
      loadGoals();
    }
  }, [id]);

  const loadStudent = () => {
    if (id) {
      const found = getStudents().find((s) => s.id === id);
      setStudent(found || null);
    }
  };

  const loadGoals = () => {
    if (id) {
      setGoals(getGoalsByStudent(id));
    }
  };

  const handleOpenDialog = (goal?: Goal) => {
    if (goal) {
      setEditingGoal(goal);
      setFormData({
        description: goal.description,
        baseline: goal.baseline,
        target: goal.target,
        status: goal.status,
      });
    } else {
      setEditingGoal(null);
      setFormData({
        description: '',
        baseline: '',
        target: '',
        status: 'in-progress',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingGoal(null);
  };

  const handleSave = () => {
    if (!id) return;

    if (editingGoal) {
      updateGoal(editingGoal.id, {
        description: formData.description,
        baseline: formData.baseline,
        target: formData.target,
        status: formData.status,
      });
    } else {
      addGoal({
        id: generateId(),
        studentId: id,
        description: formData.description,
        baseline: formData.baseline,
        target: formData.target,
        status: formData.status,
        dateCreated: new Date().toISOString(),
      });
    }
    loadGoals();
    handleCloseDialog();
  };

  const handleDelete = (goalId: string) => {
    if (window.confirm('Are you sure you want to delete this goal?')) {
      deleteGoal(goalId);
      loadGoals();
    }
  };

  if (!student) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/students')}>
          Back to Students
        </Button>
        <Typography>Student not found</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/students')}
        sx={{ mb: 2 }}
      >
        Back to Students
      </Button>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="h4">{student.name}</Typography>
              <Typography color="text.secondary">
                Age: {student.age} | Grade: {student.grade}
              </Typography>
            </Box>
            <Chip
              label={student.status}
              color={student.status === 'active' ? 'primary' : 'default'}
            />
          </Box>
          {student.concerns.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Concerns:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {student.concerns.map((concern, idx) => (
                  <Chip key={idx} label={concern} size="small" variant="outlined" />
                ))}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Goals</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Goal
        </Button>
      </Box>

      <Grid container spacing={2}>
        {goals.length === 0 ? (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" align="center">
                  No goals added yet. Click "Add Goal" to create one.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          goals.map((goal) => (
            <Grid item xs={12} md={6} key={goal.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="h6">{goal.description}</Typography>
                    <Box>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(goal)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(goal.id)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Baseline: {goal.baseline}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Target: {goal.target}
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Chip
                      label={goal.status}
                      size="small"
                      color={
                        goal.status === 'achieved'
                          ? 'success'
                          : goal.status === 'modified'
                          ? 'warning'
                          : 'default'
                      }
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Created: {formatDate(goal.dateCreated)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingGoal ? 'Edit Goal' : 'Add New Goal'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Goal Description"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              required
            />
            <TextField
              label="Baseline"
              fullWidth
              value={formData.baseline}
              onChange={(e) => setFormData({ ...formData, baseline: e.target.value })}
              helperText="Initial performance level"
            />
            <TextField
              label="Target"
              fullWidth
              value={formData.target}
              onChange={(e) => setFormData({ ...formData, target: e.target.value })}
              helperText="Desired performance level"
            />
            <TextField
              select
              label="Status"
              fullWidth
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as 'in-progress' | 'achieved' | 'modified',
                })
              }
              SelectProps={{
                native: true,
              }}
            >
              <option value="in-progress">In Progress</option>
              <option value="achieved">Achieved</option>
              <option value="modified">Modified</option>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!formData.description}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

