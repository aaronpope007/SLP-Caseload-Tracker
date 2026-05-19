import { useCallback, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, formatISO, parse, startOfMonth } from 'date-fns';
import { ApiError, api } from '../../utils/api';
import type { MaBillingLogFilterBy, MaBillingLogResponse } from '../../types';
import type { MaBillingStudentForTimesheet } from '../../utils/timesheetNoteGenerator';
import { logError } from '../../utils/logger';

function formatYmd(d: Date): string {
  return formatISO(d, { representation: 'date' });
}

function formatDateMmDd(ymd: string): string {
  try {
    return format(parse(ymd, 'yyyy-MM-dd', new Date()), 'MM/dd');
  } catch {
    return ymd;
  }
}

function buildSteppingStonesCopy(students: MaBillingLogResponse['students']): string {
  return students
    .slice()
    .sort((a, b) => a.initials.localeCompare(b.initials))
    .map((s) => `${s.initials} (${s.grade})`)
    .join(', ');
}

function buildMaBillingLineCopy(students: MaBillingLogResponse['students']): string {
  const parts = students
    .slice()
    .sort((a, b) => a.initials.localeCompare(b.initials))
    .map((s) => `${s.initials}(${s.grade}) x${s.sessionCount}`);
  return `MA Billing: ${parts.join(', ')}`;
}

function buildEvalMaLineCopy(evalStudents: MaBillingLogResponse['evalStudents']): string {
  const parts = evalStudents
    .slice()
    .sort((a, b) => a.initials.localeCompare(b.initials))
    .map((s) => {
      const titlePart = s.titles.length > 0 ? ` [${s.titles.join(', ')}]` : '';
      return `${s.initials}(${s.grade}) x${s.evalCount}${titlePart}`;
    });
  return `MA Evals: ${parts.join(', ')}`;
}

function DatesCell({
  studentId,
  dates,
  expanded,
  onToggleExpand,
}: {
  studentId: string;
  dates: string[];
  expanded: boolean;
  onToggleExpand: (studentId: string) => void;
}) {
  const formatted = dates.map(formatDateMmDd);
  if (formatted.length === 0) {
    return <Typography variant="body2">—</Typography>;
  }
  if (formatted.length <= 3 || expanded) {
    return <Typography variant="body2">{formatted.join(', ')}</Typography>;
  }
  const shown = formatted.slice(0, 3).join(', ');
  const more = dates.length - 3;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
      <Typography variant="body2" component="span">
        {shown}
      </Typography>
      <Chip
        size="small"
        label={`+ ${more} more`}
        onClick={() => onToggleExpand(studentId)}
        sx={{ cursor: 'pointer' }}
      />
    </Box>
  );
}

export interface MaBillingLogSectionProps {
  onStudentsLoaded?: (students: MaBillingStudentForTimesheet[]) => void;
  onNotify?: (message: string, severity?: 'success' | 'error') => void;
}

export function MaBillingLogSection({ onStudentsLoaded, onNotify }: MaBillingLogSectionProps) {
  const [maBillingStartDate, setMaBillingStartDate] = useState<Date>(() => startOfMonth(new Date()));
  const [maBillingEndDate, setMaBillingEndDate] = useState<Date>(() => new Date());
  const [filterBy, setFilterBy] = useState<MaBillingLogFilterBy>('serviceDate');
  const [report, setReport] = useState<MaBillingLogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const [expandedDateRows, setExpandedDateRows] = useState<Set<string>>(() => new Set());

  const toggleDateExpand = useCallback((studentId: string) => {
    setExpandedDateRows((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }, []);

  const handleRunReport = useCallback(async () => {
    setError(null);
    setLoading(true);
    setFetched(false);
    setReport(null);
    setExpandedDateRows(new Set());
    try {
      const startDate = formatYmd(maBillingStartDate);
      const endDate = formatYmd(maBillingEndDate);
      const res = await api.sessions.getMaBillingLog({ startDate, endDate, filterBy });
      setReport(res);
      setFetched(true);
      const forTimesheet: MaBillingStudentForTimesheet[] = res.students.map((s) => ({
        initials: s.initials,
        grade: s.grade,
        sessionCount: s.sessionCount,
      }));
      onStudentsLoaded?.(forTimesheet);
    } catch (e) {
      logError('MA billing log fetch failed', e);
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Failed to load report');
      onStudentsLoaded?.([]);
    } finally {
      setLoading(false);
    }
  }, [maBillingStartDate, maBillingEndDate, filterBy, onStudentsLoaded]);

  const copyText = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        onNotify?.(`${label} copied to clipboard.`, 'success');
      } catch (e) {
        logError('Clipboard copy failed', e);
        onNotify?.('Could not copy to clipboard.', 'error');
      }
    },
    [onNotify]
  );

  const hasResults = fetched && !loading && !error;
  const isEmpty =
    hasResults &&
    report !== null &&
    report.students.length === 0 &&
    (report.evalStudents?.length ?? 0) === 0;

  const summaryLine = useMemo(() => {
    if (!report) return '';
    return `Total: ${report.totalSessions} MA-logged session${report.totalSessions === 1 ? '' : 's'} across ${report.students.length} student${report.students.length === 1 ? '' : 's'}`;
  }, [report]);

  const evalSummaryLine = useMemo(() => {
    if (!report || (report.evalStudents?.length ?? 0) === 0) return '';
    const n = report.totalEvals ?? 0;
    const m = report.evalStudents.length;
    return `Total: ${n} MA-logged evaluation${n === 1 ? '' : 's'} across ${m} student${m === 1 ? '' : 's'}`;
  }, [report]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Accordion defaultExpanded sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" component="span">
            MA Billing Log
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'flex-start' }}>
              <DatePicker
                label="Start Date"
                value={maBillingStartDate}
                onChange={(d) => d && setMaBillingStartDate(d)}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
              <DatePicker
                label="End Date"
                value={maBillingEndDate}
                onChange={(d) => d && setMaBillingEndDate(d)}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Stack>

            <Box>
              <ToggleButtonGroup
                value={filterBy}
                exclusive
                onChange={(_e, value: MaBillingLogFilterBy | null) => {
                  if (value) setFilterBy(value);
                }}
                size="small"
              >
                <ToggleButton value="serviceDate">By Service Date</ToggleButton>
                <ToggleButton value="loggedDate">By Logged Date</ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {filterBy === 'serviceDate'
                  ? 'Showing sessions whose service date falls in this range'
                  : "Showing sessions where you checked 'Logged to MA' within this range. Sessions logged before today's update will not appear until re-toggled."}
              </Typography>
            </Box>

            <Button
              variant="contained"
              color="primary"
              onClick={() => void handleRunReport()}
              disabled={loading}
              sx={{ minWidth: 120, alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
            >
              Run Report
            </Button>

            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={32} />
              </Box>
            )}

            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {isEmpty && (
              <Typography color="text.secondary">No MA-logged sessions found for this date range.</Typography>
            )}

            {hasResults && report && report.students.length > 0 && (
              <>
                <Table size="small" component={Paper} variant="outlined">
                  <TableHead>
                    <TableRow>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        Sessions Logged
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Grade</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Initials</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Dates</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.students.map((row) => (
                      <TableRow key={row.studentId}>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={700}>
                            {row.sessionCount}
                          </Typography>
                        </TableCell>
                        <TableCell>{row.studentName}</TableCell>
                        <TableCell>{row.grade || '—'}</TableCell>
                        <TableCell>{row.initials}</TableCell>
                        <TableCell>
                          <DatesCell
                            studentId={row.studentId}
                            dates={row.dates}
                            expanded={expandedDateRows.has(row.studentId)}
                            onToggleExpand={toggleDateExpand}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <Typography variant="body2" color="text.secondary">
                  {summaryLine}
                </Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => void copyText(buildSteppingStonesCopy(report.students), 'Stepping Stones format')}
                  >
                    Copy Stepping Stones format
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => void copyText(buildMaBillingLineCopy(report.students), 'MA Billing line')}
                  >
                    Copy MA Billing line
                  </Button>
                </Stack>
              </>
            )}

            {hasResults && report && (report.evalStudents?.length ?? 0) > 0 && (
              <Box sx={{ mt: report.students.length > 0 ? 3 : 0 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                  Evaluations
                </Typography>
                <Table size="small" component={Paper} variant="outlined">
                  <TableHead>
                    <TableRow>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        Evals Logged
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Grade</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Initials</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Assessments</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Dates</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.evalStudents.map((row) => (
                      <TableRow key={row.studentId}>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={700}>
                            {row.evalCount}
                          </Typography>
                        </TableCell>
                        <TableCell>{row.studentName}</TableCell>
                        <TableCell>{row.grade || '—'}</TableCell>
                        <TableCell>{row.initials}</TableCell>
                        <TableCell sx={{ maxWidth: 280, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                          {row.titles.length > 0 ? row.titles.join(', ') : '—'}
                        </TableCell>
                        <TableCell>
                          <DatesCell
                            studentId={row.studentId}
                            dates={row.dates}
                            expanded={expandedDateRows.has(row.studentId)}
                            onToggleExpand={toggleDateExpand}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {evalSummaryLine}
                </Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => void copyText(buildEvalMaLineCopy(report.evalStudents), 'Eval MA line')}
                  >
                    Copy Eval MA line
                  </Button>
                </Stack>
              </Box>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </LocalizationProvider>
  );
}
