import { useEffect, useState, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  TextField,
  Button,
  Checkbox,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
} from '@mui/icons-material';
import { getTodos, createTodo, toggleTodo, deleteTodo } from '../utils/storage-api';
import { logError } from '../utils/logger';
import type { Todo } from '../types';

export const TodoTracker = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTodoText, setNewTodoText] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity?: 'success' | 'error' | 'info' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    loadTodos();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadTodos = async () => {
    if (!isMountedRef.current) return;
    setLoading(true);
    try {
      const todosData = await getTodos();
      if (!isMountedRef.current) return;
      setTodos(todosData);
    } catch (error) {
      if (!isMountedRef.current) return;
      logError('Failed to load todos', error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleAddTodo = async () => {
    if (!newTodoText.trim()) return;

    const text = newTodoText.trim();
    setNewTodoText('');

    try {
      await createTodo({
        text,
        completed: false,
      });
      if (!isMountedRef.current) return;
      setSnackbar({ open: true, message: 'Todo created successfully', severity: 'success' });
      await loadTodos();
    } catch (error) {
      if (!isMountedRef.current) return;
      logError('Failed to create todo', error);
      setSnackbar({ open: true, message: 'Failed to create todo', severity: 'error' });
    }
  };

  const handleToggleTodo = async (id: string) => {
    try {
      await toggleTodo(id);
      if (!isMountedRef.current) return;
      setSnackbar({ open: true, message: 'Todo updated successfully', severity: 'success' });
      await loadTodos();
    } catch (error) {
      if (!isMountedRef.current) return;
      logError('Failed to toggle todo', error);
      setSnackbar({ open: true, message: 'Failed to update todo', severity: 'error' });
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      await deleteTodo(id);
      if (!isMountedRef.current) return;
      setSnackbar({ open: true, message: 'Todo deleted successfully', severity: 'success' });
      await loadTodos();
    } catch (error) {
      if (!isMountedRef.current) return;
      logError('Failed to delete todo', error);
      setSnackbar({ open: true, message: 'Failed to delete todo', severity: 'error' });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTodo();
    }
  };

  const incompleteTodos = todos.filter(t => !t.completed);
  const completedTodos = todos.filter(t => t.completed);

  return (
    <>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            To-Do List
          </Typography>

          {/* Add new todo */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Add a new todo..."
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddTodo}
              disabled={loading || !newTodoText.trim()}
            >
              Add
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <>
              {/* Incomplete todos */}
              {incompleteTodos.length > 0 && (
                <List>
                  {incompleteTodos.map((todo) => (
                    <ListItem
                      key={todo.id}
                      sx={{
                        '&:hover': {
                          backgroundColor: 'action.hover',
                        },
                      }}
                    >
                      <Checkbox
                        checked={todo.completed}
                        onChange={() => handleToggleTodo(todo.id)}
                        icon={<RadioButtonUncheckedIcon />}
                        checkedIcon={<CheckCircleIcon />}
                      />
                      <ListItemText
                        primary={todo.text}
                        sx={{
                          textDecoration: todo.completed ? 'line-through' : 'none',
                          color: todo.completed ? 'text.secondary' : 'text.primary',
                        }}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleDeleteTodo(todo.id)}
                          size="small"
                          sx={{ color: 'error.main' }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}

              {/* Completed todos (collapsed by default, can be expanded) */}
              {completedTodos.length > 0 && (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
                    Completed ({completedTodos.length})
                  </Typography>
                  <List>
                    {completedTodos.map((todo) => (
                      <ListItem
                        key={todo.id}
                        sx={{
                          opacity: 0.6,
                          '&:hover': {
                            backgroundColor: 'action.hover',
                          },
                        }}
                      >
                        <Checkbox
                          checked={todo.completed}
                          onChange={() => handleToggleTodo(todo.id)}
                          icon={<RadioButtonUncheckedIcon />}
                          checkedIcon={<CheckCircleIcon />}
                        />
                        <ListItemText
                          primary={todo.text}
                          sx={{
                            textDecoration: 'line-through',
                            color: 'text.secondary',
                          }}
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            onClick={() => handleDeleteTodo(todo.id)}
                            size="small"
                            sx={{ color: 'error.main' }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {todos.length === 0 && (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  No todos yet. Add one above to get started!
                </Typography>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

