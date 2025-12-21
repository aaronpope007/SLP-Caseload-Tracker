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
import type { Goal } from '../types';
import { getUniqueDomains } from '../utils/goalTemplates';

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
  mainGoals: Goal[];
  selectedTemplate: { title: string } | null;
  onClose: () => void;
  onSave: () => void;
  onFormDataChange: (data: Partial<GoalFormData>) => void;
  onOpenGoalSuggestions: () => void;
}

export const GoalFormDialog: React.FC<GoalFormDialogProps> = ({
  open,
  editingGoal,
  formData,
  mainGoals,
  selectedTemplate,
  onClose,
  onSave,
  onFormDataChange,
  onOpenGoalSuggestions,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {editingGoal 
          ? 'Edit Goal' 
          : formData.parentGoalId 
          ? 'Adding New Subgoal' 
          : 'Add New Goal'}
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
              onChange={(e) => onFormDataChange({ description: e.target.value })}
              required
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
              helperText="Optional - for sub-goals"
              InputLabelProps={{
                shrink: true,
              }}
              SelectProps={{ native: true }}
            >
              <option value="">None (Main Goal)</option>
              {mainGoals.map(goal => (
                <option key={goal.id} value={goal.id}>{goal.description}</option>
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
            helperText="Desired performance level"
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
          disabled={!formData.description}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

