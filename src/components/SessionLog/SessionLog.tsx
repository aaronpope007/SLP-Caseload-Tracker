import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
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
  Typography,
  Alert,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, formatISO, startOfMonth } from 'date-fns';
import { api } from '../../utils/api';
import { getStudents } from '../../utils/storage-api';
import type { SessionLogEntry, Student } from '../../types';
import { useSchool } from '../../context/SchoolContext';
import { logError } from '../../utils/logger';

function sessionDateKey(iso: string): string {
  try {
    return format(new Date(iso), 'yyyy-MM-dd');
  } catch {
    return iso.slice(0, 10);
  }
}

export function SessionLog() {
  const { selectedSchool, setSelectedSchool, availableSchools } = useSchool();
  const [school, setSchool] = useState('');
  const [startDate, setStartDate] = useState<Date>(() => startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(() => new Date());
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sessions, setSessions] = useState<SessionLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSchool(selectedSchool || '');
  }, [selectedSchool]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!school) {
        if (!cancelled) {
          setStudents([]);
          setSelectedIds([]);
        }
        return;
      }
      const list = await getStudents(school || undefined);
      if (cancelled) return;
      const active = list.filter((s) => s.status === 'active' && !s.archived);
      // Sort by last name (everything after first token), then first name
      active.sort((a, b) => {
        const aParts = a.name.trim().split(/\s+/);
        const bParts = b.name.trim().split(/\s+/);
        const aFirst = aParts[0] || '';
        const bFirst = bParts[0] || '';
        const aLast = aParts.slice(1).join(' ');
        const bLast = bParts.slice(1).join(' ');
        const ln = aLast.localeCompare(bLast, undefined, { sensitivity: 'base' });
        if (ln !== 0) return ln;
        return aFirst.localeCompare(bFirst, undefined, { sensitivity: 'base' });
      });
      setStudents(active);
      setSelectedIds([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [school]);

  const allSelected = students.length > 0 && selectedIds.length === students.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < students.length;

  const toggleAll = useCallback(() => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(students.map((s) => s.id));
  }, [allSelected, students]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const startStr = useMemo(() => formatISO(startDate, { representation: 'date' }), [startDate]);
  const endStr = useMemo(() => formatISO(endDate, { representation: 'date' }), [endDate]);

  const handleGenerate = useCallback(async () => {
    setError(null);
    if (!school || !startStr || !endStr || selectedIds.length === 0) return;
    setLoading(true);
    try {
      const idsParam = allSelected ? 'all' : selectedIds.join(',');
      const data = await api.sessions.getLog({ startDate: startStr, endDate: endStr, studentIds: idsParam, school });
      setSessions(data);
    } catch (e) {
      logError('Session log failed', e);
      setError(e instanceof Error ? e.message : 'Failed to load session log');
    } finally {
      setLoading(false);
    }
  }, [school, startStr, endStr, selectedIds, allSelected]);

  const multiStudent = selectedIds.length > 1 || allSelected;

  const grouped = useMemo(() => {
    if (!multiStudent) return null;
    const map = new Map<string, SessionLogEntry[]>();
    for (const r of sessions) {
      const k = sessionDateKey(r.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sessions, multiStudent]);

  const printTitle = useMemo(() => {
    const range =
      startDate && endDate
        ? `${format(startDate, 'M/d/yyyy')} – ${format(endDate, 'M/d/yyyy')}`
        : '';
    if (!school) return `Session log — ${range}`;
    if (!multiStudent && selectedIds.length === 1) {
      const st = students.find((s) => selectedIds.includes(s.id));
      return `${school} — ${st?.name ?? 'Student'} — ${range}`;
    }
    return `${school} — Session log — ${range}`;
  }, [school, startDate, endDate, selectedIds, students, multiStudent]);

  const canGenerate = Boolean(school && startStr && endStr && selectedIds.length > 0);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box
        component="style"
        dangerouslySetInnerHTML={{
          __html: `@media print {
  .no-print { display: none !important; }
  .MuiDrawer-root, .MuiAppBar-root { display: none !important; }
  body { print-color-adjust: exact; }
  #session-log-root { padding: 0 !important; max-width: none !important; }
}`,
        }}
      />
      <Box sx={{ p: 2, maxWidth: 1100, mx: 'auto' }} id="session-log-root">
        <Stack direction="row" alignItems="center" justifyContent="space-between" className="no-print" sx={{ mb: 2 }}>
          <Typography variant="h5">Session Log</Typography>
          <Button startIcon={<PrintIcon />} variant="outlined" disabled={sessions.length === 0} onClick={() => window.print()}>
            Print
          </Button>
        </Stack>

        <Stack spacing={2} className="no-print" sx={{ mb: 2 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 240 }}>
                <InputLabel id="session-log-school-label">School</InputLabel>
                <Select
                  labelId="session-log-school-label"
                  label="School"
                  value={school}
                  onChange={(e) => {
                    const v = String(e.target.value);
                    setSchool(v);
                    setSelectedSchool(v);
                  }}
                >
                  {availableSchools.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(d) => d && setStartDate(d)}
                slotProps={{ textField: { size: 'small' } }}
              />
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(d) => d && setEndDate(d)}
                slotProps={{ textField: { size: 'small' } }}
              />

              <Button variant="contained" disabled={!canGenerate || loading} onClick={handleGenerate}>
                {loading ? 'Generating…' : 'Generate Log'}
              </Button>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleAll}
                />
              }
              label="Select All"
            />
            <Stack spacing={0.5}>
              {students.map((s) => (
                <FormControlLabel
                  key={s.id}
                  control={
                    <Checkbox checked={selectedIds.includes(s.id)} onChange={() => toggleOne(s.id)} />
                  }
                  label={s.name}
                />
              ))}
            </Stack>
          </Paper>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} className="no-print">
            {error}
          </Alert>
        )}

        <Box id="session-log-printable" sx={{ pt: 1 }}>
          <Typography variant="subtitle1" sx={{ display: 'none', '@media print': { display: 'block' }, mb: 2 }}>
            {printTitle}
          </Typography>

          {sessions.length === 0 ? (
            <Typography color="text.secondary" className="no-print">
              Select students and a date range, then generate the log.
            </Typography>
          ) : !multiStudent && selectedIds.length === 1 ? (
            <>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {students.find((s) => s.id === selectedIds[0])?.name ?? 'Student'} —{' '}
                {format(startDate, 'M/d/yyyy')} – {format(endDate, 'M/d/yyyy')}
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Duration (min)</TableCell>
                    <TableCell>Individual/Group</TableCell>
                    <TableCell>CPT Code</TableCell>
                    <TableCell>ICD-10 Codes</TableCell>
                    <TableCell>Notes/Goals</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sessions.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{format(new Date(r.date), 'M/d/yyyy h:mm a')}</TableCell>
                      <TableCell align="right">{r.duration}</TableCell>
                      <TableCell>{r.isGroup ? `Group${r.groupSize ? ` (${r.groupSize})` : ''}` : 'Individual'}</TableCell>
                      <TableCell>{r.resolvedCptCode}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          {!r.codesMapped && <Chip size="small" color="warning" label="⚠️ Codes not mapped" />}
                          <Typography variant="body2" component="span">
                            {r.icd10Codes.length ? r.icd10Codes.join(', ') : '—'}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 520 }}>{r.notes || r.goalsAddressed || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : multiStudent && grouped ? (
            grouped.map(([dateKey, list]) => (
              <Box key={dateKey} sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 1, borderBottom: 1, borderColor: 'divider' }}>
                  {format(new Date(dateKey + 'T12:00:00'), 'EEEE, MMM d, yyyy')}
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Student Name</TableCell>
                      <TableCell align="right">Duration</TableCell>
                      <TableCell>Individual/Group</TableCell>
                      <TableCell>CPT Code</TableCell>
                      <TableCell>ICD-10 Codes</TableCell>
                      <TableCell>Notes/Goals</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {list.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.studentName}</TableCell>
                        <TableCell align="right">{r.duration}</TableCell>
                        <TableCell>{r.isGroup ? `Group${r.groupSize ? ` (${r.groupSize})` : ''}` : 'Individual'}</TableCell>
                        <TableCell>{r.resolvedCptCode}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            {!r.codesMapped && <Chip size="small" color="warning" label="⚠️ Codes not mapped" />}
                            <Typography variant="body2" component="span">
                              {r.icd10Codes.length ? r.icd10Codes.join(', ') : '—'}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 520 }}>{r.notes || r.goalsAddressed || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ))
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Duration (min)</TableCell>
                  <TableCell>Individual/Group</TableCell>
                  <TableCell>CPT Code</TableCell>
                  <TableCell>ICD-10 Codes</TableCell>
                  <TableCell>Notes/Goals</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{format(new Date(r.date), 'M/d/yyyy h:mm a')}</TableCell>
                    <TableCell align="right">{r.duration}</TableCell>
                    <TableCell>{r.isGroup ? `Group${r.groupSize ? ` (${r.groupSize})` : ''}` : 'Individual'}</TableCell>
                    <TableCell>{r.resolvedCptCode}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        {!r.codesMapped && <Chip size="small" color="warning" label="⚠️ Codes not mapped" />}
                        <Typography variant="body2" component="span">
                          {r.icd10Codes.length ? r.icd10Codes.join(', ') : '—'}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 520 }}>{r.notes || r.goalsAddressed || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      </Box>
    </LocalizationProvider>
  );
}
