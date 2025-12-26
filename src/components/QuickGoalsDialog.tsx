import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Typography,
  Alert,
} from '@mui/material';
import type { Goal } from '../types';
import { generateArticulationGoalTree, type ArticulationLevel } from '../utils/quickGoals';
import { getUniqueDomains } from '../utils/goalTemplates';

interface QuickGoalsDialogProps {
  open: boolean;
  studentId: string;
  onClose: () => void;
  onSave: (goals: Goal[]) => Promise<void>;
  parentGoalId?: string; // Optional parent goal ID for creating subgoals
  parentGoalDomain?: string; // Optional parent goal domain to inherit
}

export const QuickGoalsDialog: React.FC<QuickGoalsDialogProps> = ({
  open,
  studentId,
  onClose,
  onSave,
  parentGoalId,
  parentGoalDomain,
}) => {
  const [domain, setDomain] = useState<string>('');
  const [phoneme, setPhoneme] = useState<string>('');
  const [level, setLevel] = useState<ArticulationLevel>('conversation');
  const [targetPercentage, setTargetPercentage] = useState<string>('90');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');

  // When dialog opens with a parent goal, inherit the domain
  useEffect(() => {
    if (open && parentGoalId && parentGoalDomain) {
      setDomain(parentGoalDomain);
    } else if (open && !parentGoalId) {
      // Reset domain when opening for a new top-level goal
      setDomain('');
    }
  }, [open, parentGoalId, parentGoalDomain]);

  const handleClose = () => {
    setDomain('');
    setPhoneme('');
    setLevel('conversation');
    setTargetPercentage('90');
    setPriority('medium');
    setError('');
    onClose();
  };

  const handleSave = async () => {
    setError('');

    if (!domain) {
      setError('Please select a domain');
      return;
    }

    if (domain === 'Articulation') {
      if (!phoneme.trim()) {
        setError('Please enter a phoneme (e.g., /s/)');
        return;
      }

      const targetNum = parseFloat(targetPercentage);
      if (isNaN(targetNum) || targetNum < 0 || targetNum > 100) {
        setError('Target percentage must be between 0 and 100');
        return;
      }

      setSaving(true);
      try {
        const goals = generateArticulationGoalTree(studentId, {
          phoneme: phoneme.trim(),
          level,
          targetPercentage: targetNum,
          priority,
          parentGoalId,
        });
        await onSave(goals);
        handleClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create goals');
      } finally {
        setSaving(false);
      }
    } else {
      // For other domains, we can add support later
      setError(`${domain} quick goals are not yet supported. Currently only Articulation is supported.`);
    }
  };

  const domains = getUniqueDomains();
  const articulationLevels: { value: ArticulationLevel; label: string }[] = [
    { value: 'conversation', label: 'Conversation' },
    { value: 'sentence', label: 'Sentence' },
    { value: 'phrase', label: 'Phrase' },
    { value: 'word', label: 'Word' },
  ];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{parentGoalId ? 'Quick Sub-goal' : 'Quick Goal'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <TextField
            label="Domain"
            fullWidth
            select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
            SelectProps={{ native: false }}
            required
          >
            <MenuItem value="">Select Domain</MenuItem>
            {domains.map((d) => (
              <MenuItem key={d} value={d}>
                {d}
              </MenuItem>
            ))}
          </TextField>

          {domain === 'Articulation' && (
            <>
              <TextField
                label="Phoneme"
                fullWidth
                value={phoneme}
                onChange={(e) => setPhoneme(e.target.value)}
                placeholder="/s/ or s"
                helperText="Enter the sound to target (e.g., /s/, /r/, /th/)"
                required
              />

              <TextField
                label="Starting Level"
                fullWidth
                select
                value={level}
                onChange={(e) => setLevel(e.target.value as ArticulationLevel)}
                InputLabelProps={{
                  shrink: true,
                }}
                SelectProps={{ native: false }}
                helperText="The goal tree will be created from this level down to word level"
                required
              >
                {articulationLevels.map((l) => (
                  <MenuItem key={l.value} value={l.value}>
                    {l.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Target Percentage"
                fullWidth
                type="number"
                value={targetPercentage}
                onChange={(e) => setTargetPercentage(e.target.value)}
                inputProps={{ min: 0, max: 100, step: 1 }}
                helperText="Target accuracy percentage (0-100)"
                required
              />

              <TextField
                label="Priority"
                fullWidth
                select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'high' | 'medium' | 'low')}
                InputLabelProps={{
                  shrink: true,
                }}
                SelectProps={{ native: false }}
              >
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </TextField>

              <Alert severity="info">
                <Typography variant="body2">
                  This will create a goal hierarchy starting from {level} level down to word level.
                  {level !== 'word' && ' If you select conversation, phrase, or sentence level, position breakdown goals (initial, medial, final) will be added under word level.'}
                </Typography>
              </Alert>
            </>
          )}

          {domain && domain !== 'Articulation' && (
            <Alert severity="info">
              Quick goals for {domain} are coming soon. Currently, only Articulation quick goals are supported.
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || !domain || (domain === 'Articulation' && !phoneme.trim())}
        >
          {saving ? 'Creating...' : parentGoalId ? 'Create Sub-goals' : 'Create Goals'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

