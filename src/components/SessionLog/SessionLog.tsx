import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Paper,
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
import { endOfMonth, format, formatISO, startOfMonth } from 'date-fns';
import { api } from '../../utils/api';
import { getStudents } from '../../utils/storage-api';
import type { SessionLogRow, Student } from '../../types';
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
  const { selectedSchool } = useSchool();
  const [students, setStudents] = useState<Student[]>([]);
  const [start, setStart] = useState<Date | null>(() => startOfMonth(new Date()));
  const [end, setEnd] = useState<Date | null>(() => endOfMonth(new Date()));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<SessionLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await getStudents(selectedSchool || undefined);
      if (!cancelled) {
        setStudents(list.filter((s) => s.status === 'active' && !s.archived));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSchool]);

  const allSelected = students.length > 0 && selectedIds.size === students.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < students.length;

  const toggleAll = useCallback(() => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(students.map((s) => s.id)));
  }, [allSelected, students]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const startStr = start ? formatISO(start, { representation: 'date' }) : '';
  const endStr = end ? formatISO(end, { representation: 'date' }) : '';

  const handleGenerate = useCallback(async () => {
    setError(null);
    if (!startStr || !endStr || selectedIds.size === 0) return;
    setLoading(true);
    try {
      const data = await api.sessions.getLog(startStr, endStr, [...selectedIds].join(','));
      setRows(data);
    } catch (e) {
      logError('Session log failed', e);
      setError(e instanceof Error ? e.message : 'Failed to load session log');
    } finally {
      setLoading(false);
    }
  }, [startStr, endStr, selectedIds]);

  const multiStudent = selectedIds.size > 1;

  const grouped = useMemo(() => {
    if (!multiStudent) return null;
    const map = new Map<string, SessionLogRow[]>();
    for (const r of rows) {
      const k = sessionDateKey(r.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows, multiStudent]);

  const printTitle = useMemo(() => {
    const range =
      start && end
        ? `${format(start, 'M/d/yyyy')} – ${format(end, 'M/d/yyyy')}`
        : '';
    if (selectedIds.size === 1) {
      const st = students.find((s) => selectedIds.has(s.id));
      return `${st?.name ?? 'Student'} — ${range}`;
    }
    return `Session log — ${range}`;
  }, [start, end, selectedIds, students]);

  const canGenerate = Boolean(startStr && endStr && selectedIds.size > 0);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box
        component="style"
        dangerouslySetInnerHTML={{
          __html: `@media print { .no-print { display: none !important; } body { print-color-adjust: exact; } }`,
        }}
      />
      <Box sx={{ p: 2, maxWidth: 1100, mx: 'auto' }} id="session-log-root">
        <Typography variant="h5" gutterBottom className="no-print">
          Session log
        </Typography>

        <Stack spacing={2} className="no-print" sx={{ mb: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <DatePicker label="Start date" value={start} onChange={setStart} slotProps={{ textField: { size: 'small' } }} />
            <DatePicker label="End date" value={end} onChange={setEnd} slotProps={{ textField: { size: 'small' } }} />
            <Button variant="contained" disabled={!canGenerate || loading} onClick={handleGenerate}>
              {loading ? 'Generating…' : 'Generate log'}
            </Button>
            <Button startIcon={<PrintIcon />} variant="outlined" disabled={rows.length === 0} onClick={() => window.print()}>
              Print
            </Button>
          </Stack>

          <Paper variant="outlined" sx={{ p: 2, maxHeight: 280, overflow: 'auto' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleAll}
                />
              }
              label="Select all students"
            />
            <Stack spacing={0.5}>
              {students.map((s) => (
                <FormControlLabel
                  key={s.id}
                  control={
                    <Checkbox checked={selectedIds.has(s.id)} onChange={() => toggleOne(s.id)} />
                  }
                  label={`${s.name} (${s.grade})`}
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

          {!multiStudent && rows.length > 0 && (
            <Typography variant="subtitle2" gutterBottom className="no-print">
              {students.find((s) => selectedIds.has(s.id))?.name}
            </Typography>
          )}

          {rows.length === 0 ? (
            <Typography color="text.secondary" className="no-print">
              Select students and a date range, then generate the log.
            </Typography>
          ) : multiStudent && grouped ? (
            grouped.map(([dateKey, list]) => (
              <Box key={dateKey} sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 1, borderBottom: 1, borderColor: 'divider' }}>
                  {format(new Date(dateKey + 'T12:00:00'), 'EEEE, MMM d, yyyy')}
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date / time</TableCell>
                      <TableCell>Student</TableCell>
                      <TableCell align="right">Min</TableCell>
                      <TableCell>Goals addressed</TableCell>
                      <TableCell>Ind / group</TableCell>
                      <TableCell>CPT</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {list.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{format(new Date(r.date), 'M/d/yyyy h:mm a')}</TableCell>
                        <TableCell>{r.studentName}</TableCell>
                        <TableCell align="right">{r.durationMinutes ?? '—'}</TableCell>
                        <TableCell sx={{ maxWidth: 360 }}>
                          {r.goalsAddressedTexts.length ? r.goalsAddressedTexts.join('; ') : '—'}
                        </TableCell>
                        <TableCell>{r.isGroup ? 'Group' : 'Individual'}</TableCell>
                        <TableCell>{r.cptCode}</TableCell>
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
                  <TableCell>Date / time</TableCell>
                  <TableCell align="right">Min</TableCell>
                  <TableCell>Goals addressed</TableCell>
                  <TableCell>Ind / group</TableCell>
                  <TableCell>CPT</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{format(new Date(r.date), 'M/d/yyyy h:mm a')}</TableCell>
                    <TableCell align="right">{r.durationMinutes ?? '—'}</TableCell>
                    <TableCell sx={{ maxWidth: 480 }}>
                      {r.goalsAddressedTexts.length ? r.goalsAddressedTexts.join('; ') : '—'}
                    </TableCell>
                    <TableCell>{r.isGroup ? 'Group' : 'Individual'}</TableCell>
                    <TableCell>{r.cptCode}</TableCell>
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
