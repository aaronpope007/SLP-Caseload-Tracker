import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import { api } from '../../utils/api';
import { getGoalsByStudent, getStudents, updateStudent } from '../../utils/storage-api';
import type { Goal, GoalMapAiMapping, Student, TsGoalEntry } from '../../types';
import { useSchool } from '../../context/SchoolContext';
import { logError } from '../../utils/logger';

export function GoalMapper() {
  const { selectedSchool } = useSchool();
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [mappings, setMappings] = useState<GoalMapAiMapping[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key') || '' : ''
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await getStudents(selectedSchool || undefined);
      if (!cancelled) {
        setStudents(
          list.filter((s) => s.status === 'active' && !s.archived).sort((a, b) => a.name.localeCompare(b.name))
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSchool]);

  useEffect(() => {
    if (!studentId) {
      setGoals([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const g = await getGoalsByStudent(studentId, selectedSchool || undefined, false);
      if (!cancelled) {
        setGoals(g.filter((x) => x.status === 'in-progress' && !x.archived));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, selectedSchool]);

  const goalLines = useMemo(
    () =>
      goals
        .map((g) => g.description.trim())
        .filter(Boolean)
        .join('\n\n'),
    [goals]
  );

  const handleMap = useCallback(async () => {
    if (!studentId) return;
    setError(null);
    setMappings(null);
    setLoading(true);
    try {
      const body = apiKey.trim() ? { apiKey: apiKey.trim() } : {};
      const res = await api.students.mapGoals(studentId, body);
      setMappings(res.mappings);
    } catch (e) {
      logError('Map goals failed', e);
      setError(e instanceof Error ? e.message : 'Mapping failed');
    } finally {
      setLoading(false);
    }
  }, [studentId, apiKey]);

  const handleSave = useCallback(async () => {
    if (!studentId || !mappings?.length) return;
    setError(null);
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const tsgoals: TsGoalEntry[] = mappings.map((m) => ({
        goalText: m.goalText,
        domain: m.domain,
        icd10Codes: m.icd10Codes,
        icd10Descriptions: m.icd10Descriptions,
        cptCodeIndividual: m.cptCodeIndividual,
        cptCodeGroup: m.cptCodeGroup,
        mappedAt: now,
        mappedByAI: true,
      }));
      await updateStudent(studentId, { tsgoals });
      setMappings(null);
    } catch (e) {
      logError('Save tsgoals failed', e);
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [studentId, mappings]);

  const handleStudentChange = (e: SelectChangeEvent<string>) => {
    setStudentId(e.target.value);
    setMappings(null);
    setError(null);
  };

  return (
    <Box sx={{ p: 2, maxWidth: 1000, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        AI goal mapper
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Map in-progress IEP goals to ICD-10 and CPT codes using Gemini Flash. Confirm results before saving to the
        student record.
      </Typography>

      <Stack spacing={2}>
        <FormControl fullWidth size="small">
          <InputLabel id="goal-map-student">Student</InputLabel>
          <Select labelId="goal-map-student" label="Student" value={studentId} onChange={handleStudentChange}>
            <MenuItem value="">
              <em>Select a student</em>
            </MenuItem>
            {students.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Gemini API key (optional if server has GEMINI_API_KEY)"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          fullWidth
          size="small"
          type="password"
          autoComplete="off"
        />

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            In-progress goals (read-only)
          </Typography>
          <TextField
            value={goalLines}
            fullWidth
            multiline
            minRows={6}
            InputProps={{ readOnly: true }}
            placeholder="Select a student with in-progress goals."
          />
        </Paper>

        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={handleMap} disabled={!studentId || goals.length === 0 || loading}>
            {loading ? 'Mapping…' : 'Map all goals'}
          </Button>
          <Button variant="contained" color="success" onClick={handleSave} disabled={!mappings?.length || saving}>
            {saving ? 'Saving…' : 'Confirm & save'}
          </Button>
        </Stack>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {mappings && mappings.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Goal</TableCell>
                <TableCell>Domain</TableCell>
                <TableCell>ICD-10</TableCell>
                <TableCell>CPT ind / grp</TableCell>
                <TableCell>Rationale</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mappings.map((m) => (
                <TableRow key={m.goalId}>
                  <TableCell sx={{ maxWidth: 220 }}>{m.goalText}</TableCell>
                  <TableCell>{m.domain}</TableCell>
                  <TableCell sx={{ maxWidth: 160 }}>{m.icd10Codes.join(', ')}</TableCell>
                  <TableCell>
                    {m.cptCodeIndividual} / {m.cptCodeGroup}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 320 }}>{m.rationale}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Stack>
    </Box>
  );
}
