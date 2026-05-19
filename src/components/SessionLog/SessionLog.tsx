import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Alert,
  Tooltip,
  TextField,
  IconButton,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { DOMAIN_META } from '../../utils/goalDomainMap';
import { GoalDomainDot } from '../goal/GoalDomainDot';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, formatISO, startOfMonth } from 'date-fns';
import { ApiError, api } from '../../utils/api';
import { getStudents } from '../../utils/storage-api';
import type { EvalLogEntry, SessionLogEntry, Student } from '../../types';
import { groupSessionHasInsufficientData } from '../../utils/sessionValidation';
import { GroupSessionDataWarning } from './GroupSessionDataWarning';
import { MaActivityLogNoteDisplay } from './MaActivityLogNoteDisplay';
import { useSchool } from '../../context/SchoolContext';
import { logError } from '../../utils/logger';
import { useSnackbar } from '../../hooks';

/** Bold column headers; body rows stay default weight */
const sessionLogHeaderRowSx = { '& > .MuiTableCell-root': { fontWeight: 700 } };

function sessionLogMaMutedSx(maLogged: boolean) {
  return maLogged ? { opacity: 0.45, textDecoration: 'line-through' as const } : {};
}

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

type SessionClipKind = 'note' | 'date';

function effectiveAiNote(r: SessionLogEntry, map: Record<string, string>): string {
  const fromMap = map[r.id]?.trim();
  if (fromMap) return fromMap;
  return (r.aiGeneratedNote || '').trim();
}

function sessionHasAiNote(r: SessionLogEntry, map: Record<string, string>): boolean {
  return Boolean(effectiveAiNote(r, map));
}

function goalsAddressedList(entry: SessionLogEntry): string[] {
  return Array.isArray(entry.goalsAddressedText) ? entry.goalsAddressedText : [];
}

function performanceSummaryList(entry: SessionLogEntry): NonNullable<SessionLogEntry['performanceSummary']> {
  return Array.isArray(entry.performanceSummary) ? entry.performanceSummary : [];
}

function GoalWithDomainLabel({
  goalText,
  truncateMax,
}: {
  goalText: string;
  truncateMax?: number;
}) {
  const label =
    truncateMax != null ? truncateGoalDescription(goalText, truncateMax) : (goalText || '').trim();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <GoalDomainDot goalText={goalText} />
      <Typography component="span" variant="body2" sx={{ ml: '6px' }}>
        {label || '—'}
      </Typography>
    </Box>
  );
}

const GOALS_DOMAIN_LEGEND = (
  <Stack spacing={0.5} sx={{ py: 0.25 }}>
    {(['articulation', 'language', 'pragmatics', 'unknown'] as const).map((key) => (
      <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: DOMAIN_META[key].color }} />
        <Typography variant="caption" component="span">
          {DOMAIN_META[key].label}
        </Typography>
      </Box>
    ))}
  </Stack>
);

function GoalsAddressedHeaderCell({ className }: { className?: string }) {
  return (
    <TableCell className={className}>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        Goals Addressed
        <Tooltip title={GOALS_DOMAIN_LEGEND} placement="top">
          <Box
            component="span"
            sx={{ display: 'inline-flex', alignItems: 'center', color: 'text.secondary', cursor: 'help' }}
          >
            <InfoOutlinedIcon sx={{ fontSize: 12 }} />
          </Box>
        </Tooltip>
      </Box>
    </TableCell>
  );
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

function evalMaNotePreview(note: string | null | undefined): string {
  const t = (note || '').trim();
  if (!t) return '';
  if (t.length <= 60) return t;
  return `${t.slice(0, 60)}…`;
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

function EvalLogTable({
  rows,
  evalMaNoteGeneratingId,
  evalMaNoteCopiedId,
  onMaLoggedChange,
  onGenerateMaNote,
  onCopyMaNote,
}: {
  rows: EvalLogEntry[];
  evalMaNoteGeneratingId: string | null;
  evalMaNoteCopiedId: string | null;
  onMaLoggedChange: (meetingId: string, checked: boolean) => void;
  onGenerateMaNote: (meetingId: string) => void;
  onCopyMaNote: (meetingId: string, text: string) => void;
}) {
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
          <TableCell className="no-print">Logged to MA</TableCell>
          <TableCell>MA Note</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((e) => {
          const noteText = (e.maNote || '').trim();
          const preview = evalMaNotePreview(e.maNote);
          const generating = evalMaNoteGeneratingId === e.id;
          return (
            <TableRow key={`${e.id}-${e.studentId}`} sx={sessionLogMaMutedSx(e.maLogged)}>
              <TableCell>{e.studentName}</TableCell>
              <TableCell>{formatSessionDateOnly(`${e.date}T12:00:00`)}</TableCell>
              <TableCell>{e.startTime ? formatSessionClock(e.startTime) : '—'}</TableCell>
              <TableCell>{formatSessionEnd(e.endTime)}</TableCell>
              <TableCell sx={{ maxWidth: 280, whiteSpace: 'normal', wordBreak: 'break-word' }}>{e.title}</TableCell>
              <TableCell>{e.cptCode?.trim() ? e.cptCode : '—'}</TableCell>
              <TableCell>{evalLogStatusChip(e)}</TableCell>
              <TableCell className="no-print" align="center" sx={{ opacity: 1, textDecoration: 'none' }}>
                <Tooltip
                  title={e.billable ? '' : 'Not billable — cannot log to MA'}
                  disableHoverListener={e.billable}
                >
                  <span>
                    <Checkbox
                      size="small"
                      checked={e.maLogged}
                      disabled={!e.billable}
                      onChange={(ev) => onMaLoggedChange(e.id, ev.target.checked)}
                      inputProps={{ 'aria-label': 'Logged to MA' }}
                    />
                  </span>
                </Tooltip>
              </TableCell>
              <TableCell sx={{ maxWidth: 220, verticalAlign: 'middle' }}>
                {generating ? (
                  <CircularProgress size={22} />
                ) : noteText ? (
                  <Stack direction="row" alignItems="center" spacing={0.5} flexWrap="nowrap">
                    <Typography variant="body2" component="span" sx={{ flex: 1, minWidth: 0 }}>
                      {preview}
                    </Typography>
                    <Tooltip title="Copy MA note">
                      <IconButton
                        className="no-print"
                        size="small"
                        aria-label="Copy MA note"
                        color={evalMaNoteCopiedId === e.id ? 'success' : 'default'}
                        onClick={() => onCopyMaNote(e.id, noteText)}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ) : (
                  <Tooltip title="Generate MA note">
                    <span>
                      <IconButton
                        className="no-print"
                        size="small"
                        aria-label="Generate MA note"
                        onClick={() => onGenerateMaNote(e.id)}
                      >
                        <AutoAwesomeIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function SessionLogTableDateCell({
  entry,
  muted,
  clipFeedback,
  onCopyDate,
}: {
  entry: SessionLogEntry;
  muted: boolean;
  clipFeedback: { sessionId: string; kind: SessionClipKind } | null;
  onCopyDate: (e: SessionLogEntry) => void;
}) {
  const copied = clipFeedback?.sessionId === entry.id && clipFeedback?.kind === 'date';
  return (
    <TableCell sx={sessionLogMaMutedSx(muted)}>
      <Stack direction="row" alignItems="center" spacing={0.25} flexWrap="nowrap">
        <Typography component="span" variant="body2">
          {formatSessionDateOnly(entry.startTime || entry.date)}
        </Typography>
        <Tooltip title="Copy date">
          <IconButton
            className="no-print"
            size="small"
            aria-label="Copy session date"
            color={copied ? 'success' : 'default'}
            onClick={() => onCopyDate(entry)}
          >
            <ContentCopyIcon sx={{ fontSize: '0.9rem' }} />
          </IconButton>
        </Tooltip>
      </Stack>
    </TableCell>
  );
}

function SessionLogGoalsCell({ entry, muted }: { entry: SessionLogEntry; muted?: boolean }) {
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
        ...(muted ? { opacity: 0.45, textDecoration: 'line-through' } : {}),
      }}
    >
      {hasPerf ? (
        <Stack spacing={1.25} className="session-log-performance">
          {perf.map((p) => (
            <Box key={p.goalId}>
              <GoalWithDomainLabel goalText={p.goalDescription} truncateMax={80} />
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
            <Box key={i} component="li" sx={{ display: 'list-item', listStyle: 'disc' }}>
              <GoalWithDomainLabel goalText={g} />
            </Box>
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
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const [aiNotesBySessionId, setAiNotesBySessionId] = useState<Record<string, string>>({});
  const [aiNotesLoading, setAiNotesLoading] = useState(false);
  const [lastSoapNotesProvider, setLastSoapNotesProvider] = useState<'gemini' | 'anthropic' | null>(null);
  const [preferClaudeOnlyForSoap, setPreferClaudeOnlyForSoap] = useState(false);
  const [maBillingSessionContext, setMaBillingSessionContext] = useState('');
  const [maBillingModality, setMaBillingModality] = useState('');
  const [maBillingActivities, setMaBillingActivities] = useState('');
  const [clipFeedback, setClipFeedback] = useState<{ sessionId: string; kind: SessionClipKind } | null>(null);
  const [showUnloggedOnly, setShowUnloggedOnly] = useState(false);
  const [evalMaNoteGeneratingId, setEvalMaNoteGeneratingId] = useState<string | null>(null);
  const [evalMaNoteCopiedId, setEvalMaNoteCopiedId] = useState<string | null>(null);

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
    setAiNotesBySessionId({});
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
      const normalized = sessionData.map((s) => ({ ...s, maLogged: Boolean(s.maLogged) }));
      setSessions(normalized);
      const nextAi: Record<string, string> = {};
      for (const s of normalized) {
        if (s.aiGeneratedNote?.trim()) nextAi[s.id] = s.aiGeneratedNote.trim();
      }
      setAiNotesBySessionId(nextAi);
      setEvaluations(evalData.map((e) => ({ ...e, maLogged: Boolean(e.maLogged) })));
      setLogGenerated(true);
    } catch (e) {
      logError('Session log failed', e);
      setError(e instanceof Error ? e.message : 'Failed to load session log');
    } finally {
      setLoading(false);
    }
  }, [school, startStr, endStr, selectedIds, allSelected]);

  const visibleSessions = useMemo(() => {
    const nonMissed = sessions.filter((s) => !s.missedSession);
    return showUnloggedOnly ? nonMissed.filter((s) => !s.maLogged) : nonMissed;
  }, [sessions, showUnloggedOnly]);

  const visibleSessionCountLabel = useMemo(() => {
    const n = visibleSessions.length;
    return `(${n} ${n === 1 ? 'session' : 'sessions'})`;
  }, [visibleSessions.length]);

  const handleMaLoggedToggle = useCallback(
    async (sessionId: string, checked: boolean): Promise<boolean> => {
      const was = sessions.find((s) => s.id === sessionId)?.maLogged ?? false;
      setSessions((prev) => prev.map((row) => (row.id === sessionId ? { ...row, maLogged: checked } : row)));
      try {
        await api.sessions.patchMaLogged(sessionId, { maLogged: checked });
        return true;
      } catch (e) {
        setSessions((prev) => prev.map((row) => (row.id === sessionId ? { ...row, maLogged: was } : row)));
        const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Failed to update MA log';
        logError('MA logged toggle', e);
        showSnackbar(msg, 'error');
        return false;
      }
    },
    [sessions, showSnackbar]
  );

  const updateEvaluationsForMeeting = useCallback(
    (meetingId: string, patch: Partial<EvalLogEntry>) => {
      setEvaluations((prev) => prev.map((row) => (row.id === meetingId ? { ...row, ...patch } : row)));
    },
    []
  );

  const handleEvalMaLoggedToggle = useCallback(
    async (meetingId: string, checked: boolean) => {
      const was = evaluations.find((e) => e.id === meetingId)?.maLogged ?? false;
      updateEvaluationsForMeeting(meetingId, {
        maLogged: checked,
        maLoggedAt: checked ? new Date().toISOString() : null,
      });
      try {
        const res = await api.meetings.patchMaLogged(meetingId, { maLogged: checked });
        updateEvaluationsForMeeting(meetingId, {
          maLogged: res.maLogged,
          maLoggedAt: res.maLoggedAt,
        });
      } catch (e) {
        updateEvaluationsForMeeting(meetingId, { maLogged: was });
        const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Failed to update MA log';
        logError('Eval MA logged toggle', e);
        showSnackbar(msg, 'error');
      }
    },
    [evaluations, updateEvaluationsForMeeting, showSnackbar]
  );

  const handleGenerateEvalMaNote = useCallback(
    async (meetingId: string) => {
      setEvalMaNoteGeneratingId(meetingId);
      try {
        const storedGeminiKey =
          typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key')?.trim() : '';
        const storedAnthropicKey =
          typeof localStorage !== 'undefined' ? localStorage.getItem('anthropic_api_key')?.trim() : '';
        if (!storedGeminiKey && !storedAnthropicKey) {
          showSnackbar('Add a Gemini and/or Anthropic API key in Settings to generate MA notes.', 'error');
          return;
        }
        const res = await api.meetings.generateMaNote(meetingId, {
          ...(storedGeminiKey ? { geminiKey: storedGeminiKey } : {}),
          ...(storedAnthropicKey ? { anthropicKey: storedAnthropicKey } : {}),
        });
        updateEvaluationsForMeeting(meetingId, { maNote: res.maNote });
        showSnackbar('MA eval note generated.', 'success');
      } catch (e) {
        const msg =
          e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Failed to generate MA note';
        logError('Eval MA note generation', e);
        showSnackbar(msg, 'error');
      } finally {
        setEvalMaNoteGeneratingId(null);
      }
    },
    [updateEvaluationsForMeeting, showSnackbar]
  );

  const handleCopyEvalMaNote = useCallback(
    async (meetingId: string, text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setEvalMaNoteCopiedId(meetingId);
        showSnackbar('MA note copied to clipboard.', 'success');
      } catch {
        showSnackbar('Could not copy to clipboard', 'error');
      }
    },
    [showSnackbar]
  );

  useEffect(() => {
    if (!evalMaNoteCopiedId) return;
    const t = window.setTimeout(() => setEvalMaNoteCopiedId(null), 2000);
    return () => window.clearTimeout(t);
  }, [evalMaNoteCopiedId]);

  const evalLogTableProps = useMemo(
    () => ({
      evalMaNoteGeneratingId,
      evalMaNoteCopiedId,
      onMaLoggedChange: (meetingId: string, checked: boolean) => void handleEvalMaLoggedToggle(meetingId, checked),
      onGenerateMaNote: (meetingId: string) => void handleGenerateEvalMaNote(meetingId),
      onCopyMaNote: (meetingId: string, text: string) => void handleCopyEvalMaNote(meetingId, text),
    }),
    [
      evalMaNoteGeneratingId,
      evalMaNoteCopiedId,
      handleEvalMaLoggedToggle,
      handleGenerateEvalMaNote,
      handleCopyEvalMaNote,
    ]
  );

  const multiStudent = selectedIds.length > 1 || allSelected;

  const handleGenerateAiNotes = useCallback(async (onlySessionId?: string) => {
    if (multiStudent || selectedIds.length !== 1 || sessions.length === 0) return;
    const st = students.find((s) => s.id === selectedIds[0]);
    const eligibleSessions = sessions.filter((s) => !s.missedSession && !s.maLogged);
    if (onlySessionId) {
      const row = sessions.find((s) => s.id === onlySessionId);
      if (row?.maLogged) {
        showSnackbar(
          'This session is logged to MA. Uncheck Logged to MA before regenerating its note.',
          'error'
        );
        return;
      }
      if (row?.missedSession) {
        showSnackbar('Missed sessions cannot be regenerated.', 'error');
        return;
      }
    }
    const selectedSessions = onlySessionId
      ? eligibleSessions.filter((s) => s.id === onlySessionId)
      : eligibleSessions;
    if (selectedSessions.length === 0) {
      showSnackbar(
        onlySessionId
          ? 'Session not found or not eligible for note generation.'
          : 'No sessions available for note generation. Sessions already logged to MA are excluded.',
        'error'
      );
      return;
    }
    setAiNotesLoading(true);
    try {
      const storedGeminiKey =
        typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key')?.trim() : '';
      const storedAnthropicKey =
        typeof localStorage !== 'undefined' ? localStorage.getItem('anthropic_api_key')?.trim() : '';
      if (preferClaudeOnlyForSoap && !storedAnthropicKey) {
        showSnackbar('Claude-only mode needs an Anthropic API key in Settings.', 'error');
        return;
      }
      const soapName = typeof localStorage !== 'undefined' ? localStorage.getItem('soap_provider_name')?.trim() : '';
      const soapCred = typeof localStorage !== 'undefined' ? localStorage.getItem('soap_provider_credentials')?.trim() : '';
      const soapNpi = typeof localStorage !== 'undefined' ? localStorage.getItem('soap_provider_npi')?.trim() : '';
      const body = {
        ...(storedGeminiKey ? { apiKey: storedGeminiKey } : {}),
        ...(storedAnthropicKey ? { anthropicApiKey: storedAnthropicKey } : {}),
        ...(preferClaudeOnlyForSoap ? { preferAnthropic: true } : {}),
        ...(soapName ? { providerName: soapName } : {}),
        ...(soapCred ? { providerCredentials: soapCred } : {}),
        ...(soapNpi ? { providerNpi: soapNpi } : {}),
        studentId: selectedIds[0],
        studentName: st?.name ?? 'Student',
        grade: st?.grade ?? '',
        sessions: selectedSessions.map((s) => ({
          id: s.id,
          date: s.date,
          startTime: s.startTime || s.date,
          endTime: s.endTime ?? '',
          isGroup: s.isGroup,
          cptCode: s.resolvedCptCode ?? '',
          icd10Codes: s.icd10Codes,
          icd10Descriptions: s.icd10Descriptions,
          performanceSummary: s.performanceSummary.map((p) => ({
            ...(p.goalId ? { goalId: p.goalId } : {}),
            goalDescription: p.goalDescription,
            accuracy: p.accuracy,
            correctTrials: p.correctTrials,
            totalTrials: p.totalTrials,
            cuingLevels: p.cuingLevels || [],
            notes: p.notes || '',
          })),
          goalsAddressedText: s.goalsAddressedText,
          sessionNotes: s.notes?.trim() ? s.notes : '',
          domain: s.domain,
          ...(maBillingSessionContext.trim()
            ? { billingSessionContext: maBillingSessionContext.trim() }
            : {}),
          ...(maBillingModality.trim()
            ? { communicationModalityBilling: maBillingModality.trim() }
            : {}),
          ...(maBillingActivities.trim() ? { clinicalActivitiesBilling: maBillingActivities.trim() } : {}),
        })),
      };
      const res = await api.sessions.generateNotes(body);
      const providerLabel =
        res.generatedBy === 'anthropic' ? 'Claude (Anthropic)' : res.generatedBy === 'gemini' ? 'Gemini' : 'AI';
      setLastSoapNotesProvider(res.generatedBy === 'anthropic' ? 'anthropic' : 'gemini');
      const next: Record<string, string> = {};
      for (const n of res.notes) {
        next[n.sessionId] = n.note;
      }
      setAiNotesBySessionId((prev) => ({ ...prev, ...next }));
      setSessions((prev) =>
        prev.map((row) => {
          const hit = res.notes.find((n) => n.sessionId === row.id);
          return hit ? { ...row, aiGeneratedNote: hit.note } : row;
        })
      );
      const suspectSessions = selectedSessions.filter(groupSessionHasInsufficientData);
      if (suspectSessions.length > 0) {
        const names = [...new Set(suspectSessions.map((s) => s.studentName))].join(', ');
        showSnackbar(
          `MA clinical descriptions saved (${providerLabel}). Warning: ${names} may have incomplete data for this group session. Notes were generated but should be reviewed before billing.`,
          'warning'
        );
      } else {
        showSnackbar(`MA clinical descriptions saved (${providerLabel}).`, 'success');
      }
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Failed to generate notes';
      logError('AI session notes', e);
      showSnackbar(msg, 'error');
    } finally {
      setAiNotesLoading(false);
    }
  }, [multiStudent, selectedIds, sessions, students, showSnackbar, preferClaudeOnlyForSoap, maBillingSessionContext, maBillingModality, maBillingActivities]);

  const copySessionField = useCallback(
    async (r: SessionLogEntry, kind: SessionClipKind, text: string, successMessage: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setClipFeedback({ sessionId: r.id, kind });
        if (kind === 'note' && !r.maLogged) {
          const marked = await handleMaLoggedToggle(r.id, true);
          showSnackbar(
            marked ? `${successMessage} Marked as logged to MA.` : `${successMessage} Could not update logged status.`,
            marked ? 'success' : 'warning'
          );
        } else {
          showSnackbar(successMessage, 'success');
        }
      } catch {
        showSnackbar('Could not copy to clipboard', 'error');
      }
    },
    [showSnackbar, handleMaLoggedToggle]
  );

  useEffect(() => {
    if (!clipFeedback) return;
    const t = window.setTimeout(() => setClipFeedback(null), 2000);
    return () => window.clearTimeout(t);
  }, [clipFeedback]);

  const grouped = useMemo(() => {
    if (!multiStudent) return null;
    const map = new Map<string, SessionLogEntry[]>();
    for (const r of visibleSessions) {
      const k = sessionDateKey(r.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visibleSessions, multiStudent]);

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

  const showAiNotesLayout = useMemo(
    () =>
      !multiStudent &&
      selectedIds.length === 1 &&
      sessions.length > 0 &&
      sessions.every((s) => sessionHasAiNote(s, aiNotesBySessionId)),
    [multiStudent, selectedIds, sessions, aiNotesBySessionId]
  );

  const sessionLogTableShowsGoalsColumn = useMemo(
    () => visibleSessions.some((s) => !sessionHasAiNote(s, aiNotesBySessionId)),
    [visibleSessions, aiNotesBySessionId]
  );

  const canShowAiNotesButton = !multiStudent && selectedIds.length === 1 && sessions.length > 0;

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
              <FormControlLabel
                className="no-print"
                sx={{ ml: { xs: 0, md: 1 } }}
                control={
                  <Switch
                    checked={showUnloggedOnly}
                    onChange={(_, v) => setShowUnloggedOnly(v)}
                    size="small"
                  />
                }
                label="Show unlogged only"
              />
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
          ) : sessions.length > 0 && visibleSessions.length === 0 && showUnloggedOnly ? (
            <Typography color="text.secondary" sx={{ mb: 2 }} className="no-print">
              No unlogged sessions in this range (all visible sessions are already marked logged to MA).
            </Typography>
          ) : !multiStudent && selectedIds.length === 1 ? (
            <>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {students.find((s) => s.id === selectedIds[0])?.name ?? 'Student'} —{' '}
                {format(startDate, 'M/d/yyyy')} – {format(endDate, 'M/d/yyyy')}{' '}
                <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.92rem', fontWeight: 400 }}>
                  {visibleSessionCountLabel}
                </Box>
              </Typography>
              {canShowAiNotesButton && (
                <Stack spacing={1} className="no-print" sx={{ mb: 1.5 }}>
                  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                    <Tooltip
                      title={
                        lastSoapNotesProvider
                          ? `Last batch: ${lastSoapNotesProvider === 'anthropic' ? 'Claude (Anthropic)' : 'Gemini'}. Only sessions not logged to MA are regenerated.`
                          : preferClaudeOnlyForSoap
                            ? 'Notes will be generated with Claude only (Anthropic key required). Sessions already logged to MA are skipped.'
                            : 'Uses Gemini first; falls back to Claude if Gemini fails. Sessions already logged to MA are skipped.'
                      }
                    >
                      <span>
                        <Button
                          variant="contained"
                          color="secondary"
                          disabled={
                            aiNotesLoading ||
                            (preferClaudeOnlyForSoap &&
                              typeof window !== 'undefined' &&
                              !localStorage.getItem('anthropic_api_key')?.trim())
                          }
                          onClick={() => void handleGenerateAiNotes()}
                        >
                          {showAiNotesLayout ? '✨ Regenerate AI Notes' : '✨ Generate AI Notes'}
                        </Button>
                      </span>
                    </Tooltip>
                    {lastSoapNotesProvider && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={lastSoapNotesProvider === 'anthropic' ? 'Claude' : 'Gemini'}
                        color={lastSoapNotesProvider === 'anthropic' ? 'secondary' : 'primary'}
                      />
                    )}
                    {aiNotesLoading && (
                      <>
                        <CircularProgress size={22} />
                        <Typography variant="body2" color="text.secondary">
                          Generating MA descriptions…
                        </Typography>
                      </>
                    )}
                  </Stack>
                  <FormControlLabel
                    sx={{ alignItems: 'flex-start', ml: 0, mr: 0 }}
                    control={
                      <Switch
                        checked={preferClaudeOnlyForSoap}
                        onChange={(_, checked) => setPreferClaudeOnlyForSoap(checked)}
                        color="secondary"
                        disabled={aiNotesLoading}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" component="span">
                          Use Claude only (skip Gemini)
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Off: try Gemini first, then Claude on failure. On: requires an Anthropic key in Settings.
                        </Typography>
                      </Box>
                    }
                  />
                  <Box className="no-print" sx={{ maxWidth: 560 }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                      Optional — applies to this run (all sessions below). Helps the MA description field without
                      pasting a SOAP note.
                    </Typography>
                    <Stack spacing={1}>
                      <TextField
                        size="small"
                        fullWidth
                        label="Session context"
                        placeholder="e.g. First session after winter break"
                        value={maBillingSessionContext}
                        onChange={(e) => setMaBillingSessionContext(e.target.value)}
                        disabled={aiNotesLoading}
                      />
                      <TextField
                        size="small"
                        fullWidth
                        label="Communication modality"
                        placeholder="e.g. Zoom chat (selective mutism)"
                        value={maBillingModality}
                        onChange={(e) => setMaBillingModality(e.target.value)}
                        disabled={aiNotesLoading}
                      />
                      <TextField
                        size="small"
                        fullWidth
                        label="Clinical activities (brief)"
                        placeholder="e.g. Social scenario via screen share; responses via chat"
                        value={maBillingActivities}
                        onChange={(e) => setMaBillingActivities(e.target.value)}
                        disabled={aiNotesLoading}
                      />
                    </Stack>
                  </Box>
                </Stack>
              )}
              <Table size="small">
                <TableHead>
                  <TableRow sx={sessionLogHeaderRowSx}>
                    <>
                      <TableCell>Date</TableCell>
                      <TableCell>Start</TableCell>
                      <TableCell>End</TableCell>
                      <TableCell>Individual/Group</TableCell>
                      <TableCell>CPT Code</TableCell>
                      <TableCell>ICD-10 Codes</TableCell>
                      <TableCell className="no-print">Logged to MA</TableCell>
                      {sessionLogTableShowsGoalsColumn ? <GoalsAddressedHeaderCell /> : null}
                    </>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleSessions.map((r) =>
                    sessionHasAiNote(r, aiNotesBySessionId) ? (
                      <Fragment key={r.id}>
                        <TableRow>
                          <SessionLogTableDateCell
                            entry={r}
                            muted={r.maLogged}
                            clipFeedback={clipFeedback}
                            onCopyDate={(e) =>
                              void copySessionField(
                                e,
                                'date',
                                formatSessionDateOnly(e.startTime || e.date),
                                'Date copied to clipboard.'
                              )
                            }
                          />
                          <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>
                            {formatSessionClock(r.startTime || r.date)}
                          </TableCell>
                          <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>{formatSessionEnd(r.endTime)}</TableCell>
                          <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>
                            {r.isGroup ? `Group${r.groupSize ? ` (${r.groupSize})` : ''}` : 'Individual'}
                          </TableCell>
                          <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>{r.resolvedCptCode}</TableCell>
                          <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>
                            <Typography variant="body2" component="span">
                              {r.icd10Codes.length ? r.icd10Codes.join(', ') : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell className="no-print" align="center" sx={{ opacity: 1, textDecoration: 'none' }}>
                            <Checkbox
                              size="small"
                              checked={r.maLogged}
                              onChange={(e) => handleMaLoggedToggle(r.id, e.target.checked)}
                              inputProps={{ 'aria-label': 'Logged to MA' }}
                            />
                          </TableCell>
                          {sessionLogTableShowsGoalsColumn ? <TableCell sx={sessionLogMaMutedSx(r.maLogged)} /> : null}
                        </TableRow>
                        <TableRow
                          sx={{
                            '& > td': {
                              borderTop: (t) => `1px solid ${t.palette.divider}`,
                              pt: 1,
                            },
                          }}
                        >
                          <TableCell
                            colSpan={sessionLogTableShowsGoalsColumn ? 7 : 6}
                            sx={{ ...sessionLogMaMutedSx(r.maLogged), p: 1.5, verticalAlign: 'top' }}
                          >
                            <Stack spacing={1.25}>
                              <Paper
                                variant="outlined"
                                sx={{
                                  p: 1.5,
                                  bgcolor: 'action.hover',
                                  maxHeight: { xs: 280, sm: 420 },
                                  overflow: 'auto',
                                }}
                              >
                                <MaActivityLogNoteDisplay
                                  entry={r}
                                  noteText={effectiveAiNote(r, aiNotesBySessionId)}
                                />
                              </Paper>
                              {groupSessionHasInsufficientData(r) ? <GroupSessionDataWarning /> : null}
                            </Stack>
                          </TableCell>
                          <TableCell align="right" valign="top" className="no-print" sx={{ opacity: 1, textDecoration: 'none' }}>
                            <Stack spacing={1} alignItems="flex-end">
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<ContentCopyIcon fontSize="small" />}
                                onClick={async () => {
                                  const text = effectiveAiNote(r, aiNotesBySessionId);
                                  await copySessionField(r, 'note', text, 'Note copied to clipboard.');
                                }}
                              >
                                {clipFeedback?.sessionId === r.id && clipFeedback?.kind === 'note'
                                  ? 'Copied ✓'
                                  : 'Copy'}
                              </Button>
                              <Tooltip
                                title={
                                  r.maLogged
                                    ? 'Logged to MA — uncheck the checkbox to regenerate this note'
                                    : 'Regenerate this session only'
                                }
                              >
                                <span>
                                  <Button
                                    size="small"
                                    variant="text"
                                    disabled={aiNotesLoading || r.maLogged}
                                    onClick={() => void handleGenerateAiNotes(r.id)}
                                  >
                                    Regenerate
                                  </Button>
                                </span>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    ) : (
                      <TableRow key={r.id}>
                        <SessionLogTableDateCell
                          entry={r}
                          muted={r.maLogged}
                          clipFeedback={clipFeedback}
                          onCopyDate={(e) =>
                            void copySessionField(
                              e,
                              'date',
                              formatSessionDateOnly(e.startTime || e.date),
                              'Date copied to clipboard.'
                            )
                          }
                        />
                        <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>
                          {formatSessionClock(r.startTime || r.date)}
                        </TableCell>
                        <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>{formatSessionEnd(r.endTime)}</TableCell>
                        <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>
                          {r.isGroup ? `Group${r.groupSize ? ` (${r.groupSize})` : ''}` : 'Individual'}
                        </TableCell>
                        <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>{r.resolvedCptCode}</TableCell>
                        <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>
                          <Typography variant="body2" component="span">
                            {r.icd10Codes.length ? r.icd10Codes.join(', ') : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell className="no-print" align="center" sx={{ opacity: 1, textDecoration: 'none' }}>
                          <Checkbox
                            size="small"
                            checked={r.maLogged}
                            onChange={(e) => handleMaLoggedToggle(r.id, e.target.checked)}
                            inputProps={{ 'aria-label': 'Logged to MA' }}
                          />
                        </TableCell>
                        <SessionLogGoalsCell entry={r} muted={r.maLogged} />
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </>
          ) : multiStudent && grouped != null && grouped.length > 0 ? (
            <>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {format(startDate, 'M/d/yyyy')} – {format(endDate, 'M/d/yyyy')}{' '}
                <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.92rem', fontWeight: 400 }}>
                  {visibleSessionCountLabel}
                </Box>
              </Typography>
              {grouped.map(([dateKey, list]) => (
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
                      <TableCell className="no-print">Logged to MA</TableCell>
                      <GoalsAddressedHeaderCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {list.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>{r.studentName}</TableCell>
                        <SessionLogTableDateCell
                          entry={r}
                          muted={r.maLogged}
                          clipFeedback={clipFeedback}
                          onCopyDate={(e) =>
                            void copySessionField(
                              e,
                              'date',
                              formatSessionDateOnly(e.startTime || e.date),
                              'Date copied to clipboard.'
                            )
                          }
                        />
                        <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>
                          {formatSessionClock(r.startTime || r.date)}
                        </TableCell>
                        <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>{formatSessionEnd(r.endTime)}</TableCell>
                        <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>
                          {r.isGroup ? `Group${r.groupSize ? ` (${r.groupSize})` : ''}` : 'Individual'}
                        </TableCell>
                        <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>{r.resolvedCptCode}</TableCell>
                        <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>
                          <Typography variant="body2" component="span">
                            {r.icd10Codes.length ? r.icd10Codes.join(', ') : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell className="no-print" align="center" sx={{ opacity: 1, textDecoration: 'none' }}>
                          <Checkbox
                            size="small"
                            checked={r.maLogged}
                            onChange={(e) => handleMaLoggedToggle(r.id, e.target.checked)}
                            inputProps={{ 'aria-label': 'Logged to MA' }}
                          />
                        </TableCell>
                        <SessionLogGoalsCell entry={r} muted={r.maLogged} />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ))}
            </>
          ) : (
            <>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {format(startDate, 'M/d/yyyy')} – {format(endDate, 'M/d/yyyy')}{' '}
                <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.92rem', fontWeight: 400 }}>
                  {visibleSessionCountLabel}
                </Box>
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
                  <TableCell className="no-print">Logged to MA</TableCell>
                  <GoalsAddressedHeaderCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleSessions.map((r) => (
                  <TableRow key={r.id}>
                    <SessionLogTableDateCell
                      entry={r}
                      muted={r.maLogged}
                      clipFeedback={clipFeedback}
                      onCopyDate={(e) =>
                        void copySessionField(
                          e,
                          'date',
                          formatSessionDateOnly(e.startTime || e.date),
                          'Date copied to clipboard.'
                        )
                      }
                    />
                    <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>
                      {formatSessionClock(r.startTime || r.date)}
                    </TableCell>
                    <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>{formatSessionEnd(r.endTime)}</TableCell>
                    <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>
                      {r.isGroup ? `Group${r.groupSize ? ` (${r.groupSize})` : ''}` : 'Individual'}
                    </TableCell>
                    <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>{r.resolvedCptCode}</TableCell>
                    <TableCell sx={sessionLogMaMutedSx(r.maLogged)}>
                      <Typography variant="body2" component="span">
                        {r.icd10Codes.length ? r.icd10Codes.join(', ') : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell className="no-print" align="center" sx={{ opacity: 1, textDecoration: 'none' }}>
                      <Checkbox
                        size="small"
                        checked={r.maLogged}
                        onChange={(e) => handleMaLoggedToggle(r.id, e.target.checked)}
                        inputProps={{ 'aria-label': 'Logged to MA' }}
                      />
                    </TableCell>
                    <SessionLogGoalsCell entry={r} muted={r.maLogged} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </>
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
                    <EvalLogTable rows={rows} {...evalLogTableProps} />
                  </Box>
                ))
              ) : (
                <EvalLogTable rows={evaluations} {...evalLogTableProps} />
              )}
            </Box>
          )}
        </Box>
      </Box>
      <SnackbarComponent />
    </LocalizationProvider>
  );
}
