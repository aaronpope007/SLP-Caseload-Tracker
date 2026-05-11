import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { format } from 'date-fns';
import { api } from '../../utils/api';
import type { GoalsExportRow } from '../../types';
import { logError } from '../../utils/logger';
import { useSchool } from '../../context/SchoolContext';

function buildExportText(rows: GoalsExportRow[]): string {
  const generated = format(new Date(), 'M/d/yyyy');
  const lines: string[] = [
    'NOBLE ACADEMY — STUDENT GOALS EXPORT',
    `Generated: ${generated}`,
    '=====================================',
    '',
  ];

  for (const row of rows) {
    const last = row.lastName || '[none entered]';
    const first = row.firstName || '[none entered]';
    const dob = row.dob?.trim() || '[none entered]';
    const ma = row.maNumber?.trim() || '[none entered]';
    lines.push(`STUDENT: ${last}, ${first} | DOB: ${dob} | MA#: ${ma}`);
    lines.push('GOALS:');
    if (!row.goals || row.goals.length === 0) {
      lines.push('[none entered]');
    } else {
      row.goals.forEach((g, i) => {
        const suffix = g.archived ? ' (archived)' : '';
        lines.push(`${i + 1}. ${g.goalText}${suffix}`);
      });
    }
    lines.push('-------------------------------------');
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

export function GoalExport() {
  const { availableSchools } = useSchool();
  const [exportSchool, setExportSchool] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (exportSchool && !availableSchools.includes(exportSchool)) {
      setExportSchool('');
      setText('');
    }
  }, [availableSchools, exportSchool]);

  const canGenerate = Boolean(exportSchool.trim());

  const handleGenerate = useCallback(async () => {
    if (!exportSchool.trim()) return;
    setError(null);
    setCopied(false);
    setLoading(true);
    try {
      const rows = await api.students.goalsExport(exportSchool.trim());
      setText(buildExportText(rows));
    } catch (e) {
      logError('Goals export failed', e);
      setError(e instanceof Error ? e.message : 'Failed to load goals export');
    } finally {
      setLoading(false);
    }
  }, [exportSchool]);

  const handleCopy = useCallback(async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError('Could not copy to clipboard');
    }
  }, [text]);

  return (
    <Box sx={{ p: 2, maxWidth: 960, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        Student goals export
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose a school, then generate. Active students at that school only, sorted by last name. Goals include
        archived and active IEP goals (excludes achieved only). Archived lines are labeled in the export.
      </Typography>

      <FormControl fullWidth size="small" sx={{ mb: 2, maxWidth: 420 }} className="no-print">
        <InputLabel id="goal-export-school-label" shrink>
          School
        </InputLabel>
        <Select
          labelId="goal-export-school-label"
          label="School"
          value={exportSchool}
          displayEmpty
          renderValue={(selected) => {
            if (!selected) {
              return (
                <Typography
                  component="span"
                  variant="body2"
                  sx={{ color: 'text.secondary', fontStyle: 'normal', fontSynthesis: 'none' }}
                >
                  Select a school
                </Typography>
              );
            }
            return selected;
          }}
          onChange={(e: SelectChangeEvent<string>) => {
            setExportSchool(e.target.value);
            setText('');
            setCopied(false);
          }}
        >
          <MenuItem value="">
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'normal' }}>
              Select a school
            </Typography>
          </MenuItem>
          {availableSchools.map((name) => (
            <MenuItem key={name} value={name}>
              {name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }} className="no-print" alignItems="center">
        <Tooltip title="Select a school first" placement="top" arrow disableHoverListener={canGenerate}>
          <span>
            <Button variant="contained" onClick={handleGenerate} disabled={loading || !canGenerate}>
              {loading ? 'Generating…' : 'Generate export'}
            </Button>
          </span>
        </Tooltip>
        <Button
          variant="outlined"
          startIcon={<ContentCopyIcon />}
          onClick={handleCopy}
          disabled={!text}
        >
          Copy to clipboard
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} className="no-print">
          {error}
        </Alert>
      )}
      {copied && (
        <Alert severity="success" sx={{ mb: 2 }} className="no-print" onClose={() => setCopied(false)}>
          Copied to clipboard
        </Alert>
      )}

      <TextField
        label="Export"
        value={text}
        fullWidth
        multiline
        minRows={18}
        InputProps={{ readOnly: true }}
        sx={{
          '& textarea': {
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: 13,
          },
        }}
        placeholder="Select a school, then click Generate export to load from the server."
      />
    </Box>
  );
}
