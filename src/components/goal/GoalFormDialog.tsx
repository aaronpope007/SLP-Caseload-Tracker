import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from '@mui/material';
import { AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import type { Goal } from '../../types';
import { getUniqueDomains } from '../../utils/goalTemplates';
import { getGoalDepth, getGoalPath } from '../../utils/goalHierarchy';
import { extractPercentageFromTarget } from '../../utils/helpers';

interface GoalFormData {
  description: string;
  baseline: string;
  target: string;
  status: 'in-progress' | 'achieved' | 'modified';
  domain: string;
  priority: 'high' | 'medium' | 'low';
  parentGoalId: string;
}

interface GoalFormDialogProps {
  open: boolean;
  editingGoal: Goal | null;
  formData: GoalFormData;
  allGoals: Goal[]; // All goals (including sub-goals) for parent selection
  selectedTemplate: { title: string } | null;
  onClose: () => void;
  onSave: () => void;
  onFormDataChange: (data: Partial<GoalFormData>) => void;
  onOpenGoalSuggestions: () => void;
  // Validation error props
  fieldErrors?: Record<string, string | undefined>;
  onClearError?: (field: string) => void;
}

export const GoalFormDialog: React.FC<GoalFormDialogProps> = ({
  open,
  editingGoal,
  formData,
  allGoals,
  selectedTemplate,
  onClose,
  onSave,
  onFormDataChange,
  onOpenGoalSuggestions,
  fieldErrors = {},
  onClearError,
}) => {
  const hasError = (field: string) => !!fieldErrors[field];
  const getError = (field: string) => fieldErrors[field];
  const clearError = (field: string) => onClearError?.(field);
  // Filter out any undefined/null goals first, then filter out the goal being edited (can't be its own parent)
  const validGoals = allGoals.filter(g => g != null);
  const availableParentGoals = validGoals.filter(g => !editingGoal || g.id !== editingGoal.id);
  
  // Helper to format goal display with hierarchy
  const formatGoalOption = (goal: Goal): string => {
    const depth = getGoalDepth(goal, validGoals);
    const indent = '  '.repeat(depth); // 2 spaces per level
    const path = getGoalPath(goal, validGoals);
    
    if (depth === 0) {
      return goal.description;
    } else if (depth === 1) {
      return `  └─ ${goal.description}`;
    } else {
      return `${indent}└─ ${goal.description}`;
    }
  };

  // Determine dialog title based on hierarchy level
  const getDialogTitle = (): string => {
    if (editingGoal) return 'Edit Goal';
    
    if (formData.parentGoalId) {
      const parent = validGoals.find(g => g.id === formData.parentGoalId);
      if (parent) {
        const parentDepth = getGoalDepth(parent, validGoals);
        if (parentDepth === 0) {
          return 'Adding New Sub-goal';
        } else {
          return 'Adding New Sub-sub-goal';
        }
      }
      return 'Adding New Sub-goal';
    }
    
    return 'Add New Goal';
  };

  // Validate target percentage
  const validateTargetPercentage = (): string | null => {
    if (!formData.target || !formData.target.trim()) {
      return null; // Empty target is allowed
    }
    
    const percentageStr = extractPercentageFromTarget(formData.target);
    if (!percentageStr) {
      return null; // No percentage found, allow other formats
    }
    
    const percentage = parseFloat(percentageStr);
    if (isNaN(percentage)) {
      return null; // Invalid number, but let other validation handle it
    }
    
    if (percentage > 100) {
      return 'Target percentage cannot exceed 100%';
    }
    
    return null;
  };

  const targetError = validateTargetPercentage();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {getDialogTitle()}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <TextField
              label="Goal Description"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => {
                onFormDataChange({ description: e.target.value });
                clearError('description');
              }}
              required
              error={hasError('description')}
              helperText={getError('description')}
            />
            <Button
              variant="outlined"
              startIcon={<AutoAwesomeIcon />}
              onClick={onOpenGoalSuggestions}
              sx={{ mt: 1 }}
              title="Get AI suggestions for this goal"
            >
              AI
            </Button>
          </Box>
          {selectedTemplate && (
            <Alert severity="info">
              Using template: <strong>{selectedTemplate.title}</strong>
            </Alert>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Domain"
              fullWidth
              select
              value={formData.domain}
              onChange={(e) => onFormDataChange({ domain: e.target.value })}
              InputLabelProps={{
                shrink: true,
              }}
              SelectProps={{ native: true }}
            >
              <option value="">None</option>
              {getUniqueDomains().map(domain => (
                <option key={domain} value={domain}>{domain}</option>
              ))}
            </TextField>
            <TextField
              label="Priority"
              fullWidth
              select
              value={formData.priority}
              onChange={(e) => onFormDataChange({ priority: e.target.value as 'high' | 'medium' | 'low' })}
              InputLabelProps={{
                shrink: true,
              }}
              SelectProps={{ native: true }}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </TextField>
          </Box>
          {!editingGoal && (
            <TextField
              label="Parent Goal"
              fullWidth
              select
              value={formData.parentGoalId}
              onChange={(e) => onFormDataChange({ parentGoalId: e.target.value })}
              helperText="Optional - select a parent goal to create a sub-goal or sub-sub-goal"
              InputLabelProps={{
                shrink: true,
              }}
              SelectProps={{ native: true }}
            >
              <option value="">None (Main Goal)</option>
              {availableParentGoals.map(goal => (
                <option key={goal.id} value={goal.id}>{formatGoalOption(goal)}</option>
              ))}
            </TextField>
          )}
          <TextField
            label="Baseline"
            fullWidth
            value={formData.baseline}
            onChange={(e) => onFormDataChange({ baseline: e.target.value })}
            helperText="Initial performance level"
          />
          <TextField
            label="Target"
            fullWidth
            value={formData.target}
            onChange={(e) => onFormDataChange({ target: e.target.value })}
            helperText={targetError || "Desired performance level"}
            error={!!targetError}
          />
          <TextField
            select
            label="Status"
            fullWidth
            value={formData.status}
            onChange={(e) =>
              onFormDataChange({
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
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={onSave}
          variant="contained"
          disabled={!formData.description || !!targetError}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

