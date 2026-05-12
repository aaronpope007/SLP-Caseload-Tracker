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
import type { EvalLogEntry, SessionLogEntry, Student } from '../../types';
import { useSchool } from '../../context/SchoolContext';
import { logError } from '../../utils/logger';

/** Bold column headers; body rows stay default weight */
const sessionLogHeaderRowSx = { '& > .MuiTableCell-root': { fontWeight: 700 } };

function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function sessionDateKey(iso: string): string {
  try {
    return format(new Date(iso), 'yyyy-MM-dd');
  } catch {
    return iso.slice(0, 10);
  }
}

function formatSessionDateOnly(iso: string): string {
  try {
    return format(new Date(iso), 'M/d/yyyy');
  } catch {
    return '—';
  }
}

function formatSessionClock(iso: string): string {
  try {
    return format(new Date(iso), 'h:mm a');
  } catch {
    return '—';
  }
}

function formatSessionEnd(iso: string | null | undefined): string {
  if (iso == null || iso === '') return '—';
  return formatSessionClock(iso);
}

function goalsAddressedList(entry: SessionLogEntry): string[] {
  return Array.isArray(entry.goalsAddressedText) ? entry.goalsAddressedText : [];
}

function performanceSummaryList(entry: SessionLogEntry): NonNullable<SessionLogEntry['performanceSummary']> {
  return Array.isArray(entry.performanceSummary) ? entry.performanceSummary : [];
}

function truncateGoalDescription(text: string, max: number): string {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function formatPerformanceCues(levels: string[] | undefined): string {
  const raw = Array.isArray(levels) ? levels.map((l) => String(l).trim()).filter(Boolean) : [];
  if (raw.length === 0) return 'Independent';
  const lower = raw.map((l) => l.toLowerCase());
  if (lower.every((l) => l === 'independent')) return 'Independent';
  return raw.join(', ');
}

function evalLogStatusChip(entry: EvalLogEntry) {
  if (!entry.billable) {
    return <Chip size="small" color="error" label="Non-Billable" />;
  }
  if (entry.needsReview) {
    return <Chip size="small" color="warning" label="⚠️ Review Code" />;
  }
  if (entry.cptCode?.trim()) {
    return <Chip size="small" color="success" label="Billable" />;
  }
  return <Chip size="small" color="warning" label="⚠️ Review Code" />;
}

function EvalLogTable({ rows }: { rows: EvalLogEntry[] }) {
  return (
    <Table size="small" sx={{ mb: 2 }}>
      <TableHead>
        <TableRow sx={sessionLogHeaderRowSx}>
          <TableCell>Student Name</TableCell>
          <TableCell>Date</TableCell>
          <TableCell>Start</TableCell>
          <TableCell>End</TableCell>
          <TableCell>Assessment</TableCell>
          <TableCell>CPT Code</TableCell>
          <TableCell>Status</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((e) => (
          <TableRow key={`${e.id}-${e.studentId}`}>
            <TableCell>{e.studentName}</TableCell>
            <TableCell>{formatSessionDateOnly(`${e.date}T12:00:00`)}</TableCell>
            <TableCell>{e.startTime ? formatSessionClock(e.startTime) : '—'}</TableCell>
            <TableCell>{formatSessionEnd(e.endTime)}</TableCell>
            <TableCell sx={{ maxWidth: 280, whiteSpace: 'normal', wordBreak: 'break-word' }}>{e.title}</TableCell>
            <TableCell>{e.cptCode?.trim() ? e.cptCode : '—'}</TableCell>
            <TableCell>{evalLogStatusChip(e)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SessionLogGoalsCell({ entry }: { entry: SessionLogEntry }) {
  const perf = performanceSummaryList(entry);
  const goals = goalsAddressedList(entry);
  const hasSessionNotes = Boolean(entry.notes?.trim());
  const hasPerf = perf.length > 0;
  const hasGoalsOnly = !hasPerf && goals.length > 0;
  const hasAnyGoalsContent = hasPerf || hasGoalsOnly;

  return (
    <TableCell
      sx={{
        maxWidth: 560,
        verticalAlign: 'top',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
      }}
    >
      {hasPerf ? (
        <Stack spacing={1.25} className="session-log-performance">
          {perf.map((p) => (
            <Box key={p.goalId}>
              <Typography variant="body2" component="div">
                {truncateGoalDescription(p.goalDescription, 80)}
              </Typography>
              <Typography
                variant="body2"
                component="div"
                sx={{ color: 'text.secondary', fontSize: '0.8125rem', mt: 0.25 }}
              >
                {p.accuracy}% accuracy ({p.correctTrials}/{p.totalTrials} trials) | Cues:{' '}
                {formatPerformanceCues(p.cuingLevels)}
              </Typography>
              {p.notes?.trim() ? (
                <Typography
                  variant="body2"
                  component="div"
                  sx={{
                    fontStyle: 'italic',
                    color: 'text.secondary',
                    fontSize: '0.8125rem',
                    mt: 0.25,
                  }}
                >
                  {p.notes}
                </Typography>
              ) : null}
            </Box>
          ))}
        </Stack>
      ) : hasGoalsOnly ? (
        <Box
          component="ul"
          className="session-log-goals-ul"
          sx={{ m: 0, pl: 2.25, mb: hasSessionNotes ? 1 : 0, listStyleType: 'disc' }}
        >
          {goals.map((g, i) => (
            <Typography key={i} component="li" variant="body2" sx={{ display: 'list-item' }}>
              {g}
            </Typography>
          ))}
        </Box>
      ) : (
        <Typography variant="body2" component="span">
          —
        </Typography>
      )}
      {hasSessionNotes ? (
        <Typography
          variant="body2"
          component="div"
          sx={{
            fontStyle: 'italic',
            color: 'text.secondary',
            mt: hasAnyGoalsContent ? 1 : 0,
          }}
        >
          {entry.notes}
        </Typography>
      ) : null}
    </TableCell>
  );
}

export function SessionLog() {
  const { selectedSchool, setSelectedSchool, availableSchools } = useSchool();
  const [school, setSchool] = useState('');
  const [startDate, setStartDate] = useState<Date>(() => startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(() => new Date());
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sessions, setSessions] = useState<SessionLogEntry[]>([]);
  const [evaluations, setEvaluations] = useState<EvalLogEntry[]>([]);
  const [logGenerated, setLogGenerated] = useState(false);
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

  const startStr = useMemo(() => {
    if (!isValidDate(startDate)) return '';
    return formatISO(startDate, { representation: 'date' });
  }, [startDate]);
  const endStr = useMemo(() => {
    if (!isValidDate(endDate)) return '';
    return formatISO(endDate, { representation: 'date' });
  }, [endDate]);

  useEffect(() => {
    setLogGenerated(false);
    setSessions([]);
    setEvaluations([]);
  }, [school, startStr, endStr, selectedIds.join(',')]);

  const handleGenerate = useCallback(async () => {
    setError(null);
    if (!school || !startStr || !endStr || selectedIds.length === 0) return;
    setLoading(true);
    try {
      const idsParam = allSelected ? 'all' : selectedIds.join(',');
      const params = { startDate: startStr, endDate: endStr, studentIds: idsParam, school };
      const [sessionData, evalData] = await Promise.all([
        api.sessions.getLog(params),
        api.meetings.getEvalLog(params),
      ]);
      setSessions(sessionData);
      setEvaluations(evalData);
      setLogGenerated(true);
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

  const evaluationsByStudent = useMemo(() => {
    if (evaluations.length === 0) return [];
    const map = new Map<string, EvalLogEntry[]>();
    for (const e of evaluations) {
      if (!map.has(e.studentId)) map.set(e.studentId, []);
      map.get(e.studentId)!.push(e);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        if (d !== 0) return d;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
    }
    return [...map.entries()].sort((a, b) =>
      (a[1][0]?.studentName || '').localeCompare(b[1][0]?.studentName || '', undefined, { sensitivity: 'base' })
    );
  }, [evaluations]);

  const printTitle = useMemo(() => {
    const range =
      isValidDate(startDate) && isValidDate(endDate)
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
          <Button
            startIcon={<PrintIcon />}
            variant="outlined"
            disabled={!logGenerated || (sessions.length === 0 && evaluations.length === 0)}
            onClick={() => window.print()}
          >
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

          {!logGenerated ? (
            <Typography color="text.secondary" className="no-print">
              Select students and a date range, then generate the log.
            </Typography>
          ) : sessions.length === 0 ? (
            <Typography color="text.secondary" sx={{ mb: 2 }} className="no-print">
              No therapy sessions in this range.
            </Typography>
          ) : !multiStudent && selectedIds.length === 1 ? (
            <>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {students.find((s) => s.id === selectedIds[0])?.name ?? 'Student'} —{' '}
                {format(startDate, 'M/d/yyyy')} – {format(endDate, 'M/d/yyyy')}
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow sx={sessionLogHeaderRowSx}>
                    <TableCell>Date</TableCell>
                    <TableCell>Start</TableCell>
                    <TableCell>End</TableCell>
                    <TableCell>Individual/Group</TableCell>
                    <TableCell>CPT Code</TableCell>
                    <TableCell>ICD-10 Codes</TableCell>
                    <TableCell>Goals Addressed</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sessions.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{formatSessionDateOnly(r.startTime || r.date)}</TableCell>
                      <TableCell>{formatSessionClock(r.startTime || r.date)}</TableCell>
                      <TableCell>{formatSessionEnd(r.endTime)}</TableCell>
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
                      <SessionLogGoalsCell entry={r} />
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
                    <TableRow sx={sessionLogHeaderRowSx}>
                      <TableCell>Student Name</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Start</TableCell>
                      <TableCell>End</TableCell>
                      <TableCell>Individual/Group</TableCell>
                      <TableCell>CPT Code</TableCell>
                      <TableCell>ICD-10 Codes</TableCell>
                      <TableCell>Goals Addressed</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {list.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.studentName}</TableCell>
                        <TableCell>{formatSessionDateOnly(r.startTime || r.date)}</TableCell>
                        <TableCell>{formatSessionClock(r.startTime || r.date)}</TableCell>
                        <TableCell>{formatSessionEnd(r.endTime)}</TableCell>
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
                        <SessionLogGoalsCell entry={r} />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ))
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={sessionLogHeaderRowSx}>
                  <TableCell>Date</TableCell>
                  <TableCell>Start</TableCell>
                  <TableCell>End</TableCell>
                  <TableCell>Individual/Group</TableCell>
                  <TableCell>CPT Code</TableCell>
                  <TableCell>ICD-10 Codes</TableCell>
                  <TableCell>Goals Addressed</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatSessionDateOnly(r.startTime || r.date)}</TableCell>
                    <TableCell>{formatSessionClock(r.startTime || r.date)}</TableCell>
                    <TableCell>{formatSessionEnd(r.endTime)}</TableCell>
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
                    <SessionLogGoalsCell entry={r} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {logGenerated && (
            <Box sx={{ mt: sessions.length > 0 ? 4 : 0 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Evaluation Log
              </Typography>
              {evaluations.length === 0 ? (
                <Typography color="text.secondary">No evaluations in this range.</Typography>
              ) : multiStudent ? (
                evaluationsByStudent.map(([studentId, rows]) => (
                  <Box key={studentId} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ mb: 0.5, fontWeight: 600 }}>
                      {rows[0]?.studentName ?? 'Student'}
                    </Typography>
                    <EvalLogTable rows={rows} />
                  </Box>
                ))
              ) : (
                <EvalLogTable rows={evaluations} />
              )}
            </Box>
          )}
        </Box>
      </Box>
    </LocalizationProvider>
  );
}
