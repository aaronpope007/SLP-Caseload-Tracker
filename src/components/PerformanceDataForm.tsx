import React from 'react';
import { Box, TextField, FormControlLabel, Checkbox, Typography } from '@mui/material';
import { TrialCounter } from './TrialCounter';

interface PerformanceDataItem {
  goalId: string;
  studentId: string;
  accuracy?: string;
  correctTrials?: number;
  incorrectTrials?: number;
  notes?: string;
  cuingLevels?: ('independent' | 'verbal' | 'visual' | 'tactile' | 'physical')[];
}

interface SessionFormData {
  performanceData: PerformanceDataItem[];
  [key: string]: unknown;
}

interface PerformanceDataFormProps {
  goalId: string;
  studentId: string;
  performanceData: PerformanceDataItem[];
  isCompact?: boolean;
  onTrialUpdate: (goalId: string, studentId: string, isCorrect: boolean) => void;
  onPerformanceUpdate: (goalId: string, studentId: string, field: 'accuracy' | 'notes', value: string) => void;
  onCuingLevelToggle: (goalId: string, studentId: string, cuingLevel: 'independent' | 'verbal' | 'visual' | 'tactile' | 'physical') => void;
  onFormDataChange: (updater: (prev: SessionFormData) => SessionFormData) => void;
}

export const PerformanceDataForm: React.FC<PerformanceDataFormProps> = ({
  goalId,
  studentId,
  performanceData,
  isCompact = false,
  onTrialUpdate,
  onPerformanceUpdate,
  onCuingLevelToggle,
  onFormDataChange,
}) => {
  const perfData = performanceData.find((p) => p.goalId === goalId && p.studentId === studentId);
  const correctTrials = perfData?.correctTrials || 0;
  const incorrectTrials = perfData?.incorrectTrials || 0;
  const totalTrials = correctTrials + incorrectTrials;
  const calculatedAccuracy = totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0;

  return (
    <Box sx={{ 
      ml: 4, 
      display: 'flex', 
      gap: 1, 
      mt: 0.5, 
      alignItems: 'center', 
      flexWrap: 'wrap', 
      mb: 1, 
      ...(isCompact ? { flexDirection: 'column', alignItems: 'stretch' } : {}) 
    }}>
      <TrialCounter
        correctTrials={correctTrials}
        incorrectTrials={incorrectTrials}
        onIncrement={() => onTrialUpdate(goalId, studentId, true)}
        onDecrement={() => onTrialUpdate(goalId, studentId, false)}
        isCompact={isCompact}
      />
      <TextField
        label="Accuracy %"
        type="number"
        size="small"
        value={totalTrials > 0 ? calculatedAccuracy.toString() : (perfData?.accuracy || '')}
        onChange={(e) => {
          onFormDataChange((prev) => ({
            ...prev,
            performanceData: prev.performanceData.map((p) =>
              p.goalId === goalId && p.studentId === studentId
                ? { ...p, accuracy: e.target.value, correctTrials: 0, incorrectTrials: 0 }
                : p
            ),
          }));
        }}
        helperText={
          totalTrials > 0
            ? isCompact
              ? 'Auto-calculated'
              : 'Auto-calculated from trials (clear to enter manually)'
            : isCompact
            ? 'Manual entry'
            : 'Enter manually or use +/- buttons'
        }
        sx={{ width: isCompact ? '100%' : 140 }}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: isCompact ? '100%' : 'auto' }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
          Cuing Levels:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {(['independent', 'verbal', 'visual', 'tactile', 'physical'] as const).map((level) => {
            const cuingLevels = perfData?.cuingLevels || [];
            const isChecked = cuingLevels.includes(level);
            return (
              <FormControlLabel
                key={level}
                control={
                  <Checkbox
                    size="small"
                    checked={isChecked}
                    onChange={() => onCuingLevelToggle(goalId, studentId, level)}
                  />
                }
                label={level.charAt(0).toUpperCase() + level.slice(1)}
              />
            );
          })}
        </Box>
      </Box>
      <TextField
        label="Notes"
        size="small"
        fullWidth
        multiline={isCompact}
        rows={isCompact ? 2 : 1}
        value={perfData?.notes || ''}
        onChange={(e) => onPerformanceUpdate(goalId, studentId, 'notes', e.target.value)}
      />
    </Box>
  );
};

