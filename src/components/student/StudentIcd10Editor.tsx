import { useState } from 'react';
import {
  Box,
  Button,
  FormControlLabel,
  IconButton,
  Radio,
  TextField,
  Typography,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import type { Icd10CodeEntry } from '../../types';

export interface StudentIcd10EditorProps {
  value: Icd10CodeEntry[];
  onChange: (codes: Icd10CodeEntry[]) => void;
}

export function StudentIcd10Editor({ value, onChange }: StudentIcd10EditorProps) {
  const [draftCode, setDraftCode] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftStartDate, setDraftStartDate] = useState('');

  const setPrimary = (index: number) => {
    onChange(value.map((entry, i) => ({ ...entry, primary: i === index })));
  };

  const updateEntry = (index: number, patch: Partial<Icd10CodeEntry>) => {
    onChange(value.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  };

  const removeEntry = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    const code = draftCode.trim();
    if (!code) return;
    onChange([
      ...value,
      {
        code,
        description: draftDescription.trim(),
        primary: false,
        startDate: draftStartDate.trim() || undefined,
      },
    ]);
    setDraftCode('');
    setDraftDescription('');
    setDraftStartDate('');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography variant="subtitle2" component="div">
          ICD-10 Codes (match SpedForms exactly)
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          Enter codes as they appear in the student&apos;s SpedForms service record. These are used for MA
          billing documentation only.
        </Typography>
      </Box>

      {value.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {value.map((entry, index) => (
            <Box
              key={`${entry.code}-${index}`}
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                gap: 1,
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <FormControlLabel
                control={
                  <Radio
                    size="small"
                    checked={entry.primary}
                    onChange={() => setPrimary(index)}
                    name="icd10-primary"
                  />
                }
                label="Primary"
                sx={{ mr: 0, minWidth: 100 }}
              />
              <TextField
                label="Code"
                size="small"
                value={entry.code}
                onChange={(e) => updateEntry(index, { code: e.target.value })}
                sx={{ width: 110 }}
                inputProps={{ maxLength: 20 }}
              />
              <TextField
                label="Description"
                size="small"
                value={entry.description}
                onChange={(e) => updateEntry(index, { description: e.target.value })}
                sx={{ flex: 1, minWidth: 160 }}
              />
              <TextField
                label="Start date"
                type="date"
                size="small"
                value={entry.startDate ?? ''}
                onChange={(e) =>
                  updateEntry(index, { startDate: e.target.value || undefined })
                }
                InputLabelProps={{ shrink: true }}
                sx={{ width: 150 }}
              />
              <IconButton
                size="small"
                aria-label="Remove ICD-10 code"
                onClick={() => removeEntry(index)}
                sx={{ mt: 0.5 }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          alignItems: 'flex-end',
          p: 1.5,
          bgcolor: 'action.hover',
          borderRadius: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ width: '100%', mb: -0.5 }}>
          Add code
        </Typography>
        <TextField
          label="Code"
          size="small"
          value={draftCode}
          onChange={(e) => setDraftCode(e.target.value)}
          sx={{ width: 110 }}
          inputProps={{ maxLength: 20 }}
        />
        <TextField
          label="Description"
          size="small"
          value={draftDescription}
          onChange={(e) => setDraftDescription(e.target.value)}
          sx={{ flex: 1, minWidth: 160 }}
        />
        <TextField
          label="Start date"
          type="date"
          size="small"
          value={draftStartDate}
          onChange={(e) => setDraftStartDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 150 }}
        />
        <Button variant="outlined" size="small" onClick={handleAdd} disabled={!draftCode.trim()}>
          Add Code
        </Button>
      </Box>
    </Box>
  );
}
