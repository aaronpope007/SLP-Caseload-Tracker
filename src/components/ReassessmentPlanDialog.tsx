import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Chip,
  Divider,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import type { Student, Evaluation, ReassessmentPlan, ReassessmentPlanItem, ReassessmentPlanTemplate } from '../types';
import {
  getReassessmentPlans,
  addReassessmentPlan,
  updateReassessmentPlan,
  getReassessmentPlanItems,
  addReassessmentPlanItem,
  updateReassessmentPlanItem,
  deleteReassessmentPlanItem,
  getReassessmentPlanTemplates,
  getStudents,
  addDueDateItem,
} from '../utils/storage-api';
import { useSchool } from '../context/SchoolContext';
import { generateId, formatDate } from '../utils/helpers';
import { useSnackbar } from '../hooks/useSnackbar';
import { logError } from '../utils/logger';

interface ReassessmentPlanDialogProps {
  open: boolean;
  onClose: () => void;
  student?: Student;
  evaluation?: Evaluation;
  existingPlan?: ReassessmentPlan & { items?: ReassessmentPlanItem[] };
  onPlanSaved?: () => void;
}

export const ReassessmentPlanDialog = ({
  open,
  onClose,
  student,
  evaluation,
  existingPlan,
  onPlanSaved,
}: ReassessmentPlanDialogProps) => {
  const { showSnackbar } = useSnackbar();
  const { selectedSchool } = useSchool();
  const [students, setStudents] = useState<Student[]>([]);
  const [templates, setTemplates] = useState<ReassessmentPlanTemplate[]>([]);
  const [planItems, setPlanItems] = useState<ReassessmentPlanItem[]>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const dueDateInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);
  
  const [formData, setFormData] = useState({
    studentId: student?.id || '',
    evaluationId: evaluation?.id || '',
    title: '',
    description: '',
    dueDate: '',
    status: 'pending' as ReassessmentPlan['status'],
    templateId: '',
  });

  const [itemFormData, setItemFormData] = useState({
    description: '',
    dueDate: '',
  });

  useEffect(() => {
    isMountedRef.current = true;
    const abortController = new AbortController();
    
    if (open) {
      loadStudents(abortController.signal);
      loadTemplates(abortController.signal);
      if (existingPlan) {
        setFormData({
          studentId: existingPlan.studentId,
          evaluationId: existingPlan.evaluationId || '',
          title: existingPlan.title,
          description: existingPlan.description || '',
          dueDate: existingPlan.dueDate.split('T')[0],
          status: existingPlan.status,
          templateId: existingPlan.templateId || '',
        });
        if (existingPlan.items) {
          setPlanItems(existingPlan.items);
        } else {
          loadPlanItems(existingPlan.id, abortController.signal);
        }
      } else {
        // Only reset form when dialog first opens, not on every render
        setFormData(prev => {
          // Only reset if form is actually empty (dialog just opened)
          if (!prev.studentId && !prev.title && !prev.dueDate) {
            return {
              studentId: student?.id || '',
              evaluationId: evaluation?.id || '',
              title: '',
              description: '',
              dueDate: '',
              status: 'pending',
              templateId: '',
            };
          }
          // Otherwise preserve existing form data
          return prev;
        });
        // Only reset items if we don't have any
        setPlanItems(prev => prev.length === 0 ? [] : prev);
        setEditingItemIndex(null);
        setItemFormData({ description: '', dueDate: '' });
      }
    } else {
      // Reset form when dialog closes
      resetForm();
    }
    
    return () => {
      isMountedRef.current = false;
      abortController.abort();
    };
  }, [open, existingPlan]); // Removed student and evaluation from dependencies to prevent resets

  const loadStudents = async (signal?: AbortSignal) => {
    try {
      const allStudents = await getStudents(selectedSchool);
      if (!signal?.aborted && isMountedRef.current) {
        setStudents(allStudents);
      }
    } catch (error) {
      if (!signal?.aborted && isMountedRef.current) {
        logError('Failed to load students', error);
      }
    }
  };

  const loadTemplates = async (signal?: AbortSignal) => {
    try {
      const allTemplates = await getReassessmentPlanTemplates();
      if (!signal?.aborted && isMountedRef.current) {
        setTemplates(allTemplates);
      }
    } catch (error) {
      if (!signal?.aborted && isMountedRef.current) {
        logError('Failed to load templates', error);
      }
    }
  };

  const loadPlanItems = async (planId: string, signal?: AbortSignal) => {
    try {
      const items = await getReassessmentPlanItems(planId);
      if (!signal?.aborted) {
        setPlanItems(items);
      }
    } catch (error) {
      if (!signal?.aborted) {
        logError('Failed to load plan items', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      studentId: student?.id || '',
      evaluationId: evaluation?.id || '',
      title: '',
      description: '',
      dueDate: '',
      status: 'pending',
      templateId: '',
    });
    setPlanItems([]);
    setEditingItemIndex(null);
    setItemFormData({ description: '', dueDate: '' });
  };

  const handleUseTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    // Preserve all existing form data when applying template
    setFormData(prev => {
      return { ...prev, templateId };
    });
    
    // Create items from template
    const now = new Date();
    const items: ReassessmentPlanItem[] = template.items.map((item, index) => ({
      id: generateId(),
      planId: '', // Will be set when plan is created
      description: item.description,
      dueDate: item.dueDate,
      completed: false,
      order: item.order,
      dateCreated: now.toISOString(),
      dateUpdated: now.toISOString(),
    }));
    
    setPlanItems(items);
    showSnackbar('Template applied successfully', 'success');
  };

  const handleAddItem = () => {
    if (!itemFormData.description || !itemFormData.dueDate) {
      showSnackbar('Please fill in description and due date', 'error');
      return;
    }

    const newItem: ReassessmentPlanItem = {
      id: generateId(),
      planId: existingPlan?.id || '',
      description: itemFormData.description,
      dueDate: new Date(itemFormData.dueDate).toISOString(),
      completed: false,
      order: planItems.length,
      dateCreated: new Date().toISOString(),
      dateUpdated: new Date().toISOString(),
    };

    if (editingItemIndex !== null) {
      const updated = [...planItems];
      updated[editingItemIndex] = { ...newItem, id: planItems[editingItemIndex].id };
      setPlanItems(updated);
      setEditingItemIndex(null);
    } else {
      setPlanItems([...planItems, newItem]);
    }

    setItemFormData({ description: '', dueDate: '' });
  };

  const handleDeleteItem = (index: number) => {
    const item = planItems[index];
    if (item.id && existingPlan) {
      // Delete from database
      deleteReassessmentPlanItem(item.id).catch(error => {
        logError('Failed to delete item', error);
      });
    }
    const updated = planItems.filter((_, i) => i !== index);
    setPlanItems(updated);
  };

  const handleToggleItemComplete = async (index: number) => {
    const item = planItems[index];
    const updated = [...planItems];
    updated[index] = {
      ...item,
      completed: !item.completed,
      completedDate: !item.completed ? new Date().toISOString() : undefined,
    };
    setPlanItems(updated);

    if (existingPlan && item.id) {
      try {
        await updateReassessmentPlanItem(item.id, {
          completed: updated[index].completed,
          completedDate: updated[index].completedDate,
        });
      } catch (error) {
        logError('Failed to update item', error);
        // Revert on error
        setPlanItems(planItems);
      }
    }
  };

  const handleSave = async () => {
    // Check for required fields with detailed error messages
    if (!formData.studentId) {
      showSnackbar('Please select a Student', 'error');
      return;
    }
    
    if (!formData.title || formData.title.trim() === '') {
      showSnackbar('Please enter a Title for the plan', 'error');
      return;
    }
    
    // Check dueDate - try to get from ref if state is empty
    let finalDueDate = formData.dueDate;
    if (!finalDueDate || finalDueDate.trim() === '') {
      // Try to get from the input ref
      const dateInput = dueDateInputRef.current || document.querySelector('[data-testid="plan-due-date-input"]') as HTMLInputElement;
      if (dateInput && dateInput.value) {
        finalDueDate = dateInput.value;
        // Update state
        setFormData(prev => ({ ...prev, dueDate: finalDueDate }));
      } else {
        showSnackbar('Please select a Plan Due Date', 'error');
        return;
      }
    }

    if (planItems.length === 0) {
      showSnackbar('Please add at least one plan item', 'error');
      return;
    }

    try {
      // Ensure dueDate is in ISO format - use finalDueDate which might have been read from DOM
      const dateToUse = finalDueDate || formData.dueDate;
      let planDueDate: string;
      try {
        planDueDate = new Date(dateToUse).toISOString();
        if (isNaN(new Date(dateToUse).getTime())) {
          throw new Error('Invalid date format');
        }
      } catch (dateError) {
        showSnackbar('Invalid plan due date format', 'error');
        logError('Date conversion error', dateError);
        return;
      }

      const planData: ReassessmentPlan = {
        id: existingPlan?.id || generateId(),
        studentId: formData.studentId,
        evaluationId: formData.evaluationId || undefined,
        title: formData.title,
        description: formData.description || undefined,
        dueDate: planDueDate,
        status: formData.status,
        templateId: formData.templateId || undefined,
        dateCreated: existingPlan?.dateCreated || new Date().toISOString(),
        dateUpdated: new Date().toISOString(),
      };

      let actualPlanId: string;
      try {
        if (existingPlan) {
          await updateReassessmentPlan(existingPlan.id, planData);
          if (!isMountedRef.current) return;
          actualPlanId = existingPlan.id;
        } else {
          const createdPlanId = await addReassessmentPlan(planData);
          if (!isMountedRef.current) return;
          actualPlanId = createdPlanId; // Use the ID returned by the API
          planData.id = createdPlanId; // Update planData.id for use in item creation
        }
      } catch (planError) {
        if (!isMountedRef.current) return;
        logError('Failed to save plan', planError);
        const errorMsg = planError instanceof Error ? planError.message : 'Unknown error';
        showSnackbar(`Failed to save plan: ${errorMsg}`, 'error');
        throw planError; // Re-throw to prevent modal from closing
      }


      const savedItemIds: string[] = [];
      const failedItems: string[] = [];

      // Save items
      for (const item of planItems) {
        try {
          // Ensure item dueDate is in ISO format
          let itemDueDate: string;
          if (typeof item.dueDate === 'string' && item.dueDate.includes('T')) {
            // Already ISO format
            itemDueDate = item.dueDate;
          } else {
            // Convert to ISO
            itemDueDate = new Date(item.dueDate).toISOString();
          }

          let savedItemId: string | undefined;

          if (existingPlan && item.id) {
            // Update existing item
            await updateReassessmentPlanItem(item.id, {
              description: item.description,
              dueDate: itemDueDate,
              completed: item.completed,
              completedDate: item.completedDate,
              order: item.order,
            });
            savedItemId = item.id;
          } else {
            // Create new item
            await addReassessmentPlanItem(actualPlanId, {
              description: item.description,
              dueDate: itemDueDate,
              completed: item.completed,
              completedDate: item.completedDate,
              order: item.order,
            });
          }

          // Create corresponding due date item for dashboard (only for incomplete items)
          if (!item.completed) {
            try {
              await addDueDateItem({
                title: item.description.length > 50 ? item.description.substring(0, 50) + '...' : item.description,
                description: `From reassessment plan: ${planData.title}`,
                dueDate: itemDueDate,
                studentId: planData.studentId,
                status: 'pending',
                category: 'Reassessment',
                priority: 'medium',
              });
            } catch (dueDateError) {
              // Don't fail the whole save if due date item creation fails
              logError('Failed to create due date item (non-critical)', dueDateError);
            }
          }
          
          // Track successful item save
          if (savedItemId) {
            savedItemIds.push(savedItemId);
          }
        } catch (itemError) {
          logError('Failed to save plan item', itemError);
          failedItems.push(item.description.substring(0, 50));
          // Continue with other items instead of stopping
        }
      }

      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;
      
      // Show appropriate message based on results
      if (failedItems.length > 0 && failedItems.length < planItems.length) {
        // Some items failed but plan saved
        showSnackbar(`Plan saved, but ${failedItems.length} of ${planItems.length} item(s) failed to save. Please check the console.`, 'warning');
      } else if (failedItems.length === planItems.length) {
        // All items failed
        showSnackbar(`Plan saved, but all items failed to save. Please check the console and try editing the plan.`, 'error');
      } else {
        // All items saved successfully
        showSnackbar(
          existingPlan ? 'Reassessment plan updated successfully' : 'Reassessment plan created successfully',
          'success'
        );
      }
      
      // Reset form
      resetForm();
      
      // Close modal - plan is saved even if some items failed
      onClose();
      
      // Call onPlanSaved callback to refresh the list (after closing modal)
      if (onPlanSaved && isMountedRef.current) {
        // Don't await - let it run in background
        onPlanSaved().catch(err => {
          if (isMountedRef.current) {
            logError('Error refreshing list', err);
          }
        });
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      logError('Failed to save plan', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save plan';
      showSnackbar(`Failed to save plan: ${errorMessage}`, 'error');
      // Don't close modal on error - let user see the error and try again
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box>
          <Box component="span">{existingPlan ? 'Edit Reassessment Plan' : 'Create Reassessment Plan'}</Box>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Title"
            fullWidth
            required
            value={formData.title || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          />

          <TextField
            label="Description"
            fullWidth
            multiline
            rows={2}
            value={formData.description || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          />

          {!student && (
            <Autocomplete
              options={students}
              getOptionLabel={(option) => `${option.name} (${option.grade})`}
              value={students.find(s => s.id === formData.studentId) || null}
              onChange={(_, newValue) => {
                setFormData(prev => ({ ...prev, studentId: newValue?.id || '' }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Student"
                  required
                  InputLabelProps={{ shrink: true }}
                />
              )}
              isOptionEqualToValue={(option, value) => option.id === value.id}
            />
          )}

          <TextField
            label="Plan Due Date"
            type="date"
            fullWidth
            required
              value={formData.dueDate || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            inputRef={dueDateInputRef}
            inputProps={{
              'data-testid': 'plan-due-date-input'
            }}
          />

          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={formData.status}
              label="Status"
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as ReassessmentPlan['status'] }))}
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="in-progress">In Progress</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
            </Select>
          </FormControl>

          {templates.length > 0 && (
            <FormControl fullWidth>
              <InputLabel>Use Template (Optional)</InputLabel>
              <Select
                value={formData.templateId}
                label="Use Template (Optional)"
                onChange={(e) => {
                  if (e.target.value) {
                    handleUseTemplate(e.target.value);
                  }
                }}
              >
                <MenuItem value="">None</MenuItem>
                {templates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6">Plan Items</Typography>

          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              label="Item Description"
              fullWidth
              value={itemFormData.description}
              onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
              placeholder="e.g., Review of Prior History and Current Performance"
            />
            <TextField
              label="Due Date"
              type="date"
              value={itemFormData.dueDate}
              onChange={(e) => setItemFormData({ ...itemFormData, dueDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 200 }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddItem}
              disabled={!itemFormData.description || !itemFormData.dueDate}
            >
              {editingItemIndex !== null ? 'Update' : 'Add'}
            </Button>
          </Box>

          {planItems.length === 0 && (
            <Alert severity="info">Add items to this plan. Each item can be checked off as completed.</Alert>
          )}

          <List>
            {planItems.map((item, index) => (
              <ListItem
                key={item.id || index}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  bgcolor: item.completed ? 'action.selected' : 'background.paper',
                }}
              >
                <Checkbox
                  checked={item.completed}
                  onChange={() => handleToggleItemComplete(index)}
                  icon={<CheckCircleIcon />}
                  checkedIcon={<CheckCircleIcon color="success" />}
                />
                <ListItemText
                  primary={item.description}
                  secondary={`Due: ${formatDate(item.dueDate)}`}
                  sx={{
                    textDecoration: item.completed ? 'line-through' : 'none',
                    opacity: item.completed ? 0.6 : 1,
                  }}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() => {
                      setEditingItemIndex(index);
                      setItemFormData({
                        description: item.description,
                        dueDate: item.dueDate.split('T')[0],
                      });
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton edge="end" onClick={() => handleDeleteItem(index)}>
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSave();
          }} 
          variant="contained"
          type="button"
        >
          Save Plan
        </Button>
      </DialogActions>
    </Dialog>
  );
};
