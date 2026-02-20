import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  TextField,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Stack,
  Divider,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import {
  Print as PrintIcon,
  PictureAsPdf as PdfIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import type { Student, Goal, Session } from '../types';
import { getStudents } from '../utils/storage-api';
import { api } from '../utils/api';
import { useSchool } from '../context/SchoolContext';
import { formatDate } from '../utils/helpers';
import { logError } from '../utils/logger';

interface GoalPerformance {
  goalId: string;
  goal: Goal;
  sessions: Array<{
    sessionId: string;
    date: string;
    accuracy?: number;
    correctTrials?: number;
    incorrectTrials?: number;
    notes?: string;
  }>;
  averageAccuracy?: number;
}

export const Reports = () => {
  const { selectedSchool } = useSchool();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<'comprehensive' | 'current'>('comprehensive');
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printContent, setPrintContent] = useState<string>('');

  const selectedStudent = useMemo(
    () => students.find(s => s.id === selectedStudentId),
    [students, selectedStudentId]
  );

  useEffect(() => {
    const loadStudents = async () => {
      try {
        const schoolStudents = await getStudents(selectedSchool);
        setStudents(schoolStudents.filter(s => s.status === 'active' && !s.archived));
      } catch (error) {
        logError('Failed to load students', error);
      }
    };
    loadStudents();
  }, [selectedSchool]);

  const filterStudentOptions = useCallback((options: Student[], inputValue: string) => {
    if (!inputValue) return options;
    const searchTerm = inputValue.toLowerCase().trim();
    const seen = new Set<string>();
    return options.filter((student) => {
      if (seen.has(student.id)) return false;
      const nameMatch = (student.name || '').toLowerCase().includes(searchTerm);
      const gradeMatch = (student.grade || '').toLowerCase().includes(searchTerm);
      const concernsMatch = student.concerns?.some((c) => c.toLowerCase().includes(searchTerm)) || false;
      const matches = nameMatch || gradeMatch || concernsMatch;
      if (matches) seen.add(student.id);
      return matches;
    });
  }, []);

  useEffect(() => {
    if (!selectedStudentId) {
      setGoals([]);
      setSessions([]);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const [studentGoals, studentSessions] = await Promise.all([
          api.goals.getAll(selectedStudentId, selectedSchool),
          api.sessions.getAll(selectedStudentId, selectedSchool),
        ]);
        setGoals(studentGoals);
        setSessions(studentSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } catch (error) {
        logError('Failed to load student data', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedStudentId, selectedSchool]);

  // Calculate goal performance data
  const goalPerformanceData = useMemo<GoalPerformance[]>(() => {
    if (!goals.length || !sessions.length) return [];

    return goals.map(goal => {
      const goalSessions = sessions
        .filter(session => 
          session.goalsTargeted.includes(goal.id) && 
          !session.missedSession &&
          session.isDirectServices !== false
        )
        .map(session => {
          const perfData = session.performanceData.find(p => p.goalId === goal.id);
          return {
            sessionId: session.id,
            date: session.date,
            accuracy: perfData?.accuracy,
            correctTrials: perfData?.correctTrials,
            incorrectTrials: perfData?.incorrectTrials,
            notes: perfData?.notes,
          };
        })
        .filter(s => s.accuracy !== undefined || s.correctTrials !== undefined);

      // Calculate average accuracy
      const accuracies = goalSessions
        .map(s => s.accuracy)
        .filter((acc): acc is number => acc !== undefined);
      
      const averageAccuracy = accuracies.length > 0
        ? accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length
        : undefined;

      return {
        goalId: goal.id,
        goal,
        sessions: goalSessions,
        averageAccuracy,
      };
    });
  }, [goals, sessions]);

  // Get current goals (in-progress)
  const currentGoals = useMemo(() => {
    return goals.filter(g => g.status === 'in-progress');
  }, [goals]);

  // Get last 3 sessions for each current goal
  const currentPerformanceData = useMemo<GoalPerformance[]>(() => {
    if (!currentGoals.length || !sessions.length) return [];

    return currentGoals.map(goal => {
      const goalSessions = sessions
        .filter(session => 
          session.goalsTargeted.includes(goal.id) && 
          !session.missedSession &&
          session.isDirectServices !== false
        )
        .slice(0, 3) // Get last 3 sessions
        .map(session => {
          const perfData = session.performanceData.find(p => p.goalId === goal.id);
          return {
            sessionId: session.id,
            date: session.date,
            accuracy: perfData?.accuracy,
            correctTrials: perfData?.correctTrials,
            incorrectTrials: perfData?.incorrectTrials,
            notes: perfData?.notes,
          };
        })
        .filter(s => s.accuracy !== undefined || s.correctTrials !== undefined);

      // Calculate average of last 3 sessions
      const accuracies = goalSessions
        .map(s => s.accuracy)
        .filter((acc): acc is number => acc !== undefined);
      
      const averageAccuracy = accuracies.length > 0
        ? accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length
        : undefined;

      return {
        goalId: goal.id,
        goal,
        sessions: goalSessions,
        averageAccuracy,
      };
    });
  }, [currentGoals, sessions]);

  const handlePrint = () => {
    const content = generatePrintContent();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportPDF = () => {
    const content = generatePrintContent();
    setPrintContent(content);
    setPrintDialogOpen(true);
  };

  const handlePrintExecute = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
    setPrintDialogOpen(false);
  };

  const generatePrintContent = (): string => {
    if (!selectedStudent) return '';

    const reportData = reportType === 'comprehensive' ? goalPerformanceData : currentPerformanceData;
    const reportTitle = reportType === 'comprehensive' 
      ? 'Comprehensive Session Report' 
      : 'Current Performance Report';

    let html = `
      <html>
        <head>
          <title>${reportTitle} - ${selectedStudent.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
            h1 { color: #333; font-size: 1.8rem; font-weight: bold; margin-bottom: 0.5rem; }
            h2 { color: #333; font-size: 1.3rem; font-weight: bold; margin-top: 1.5rem; margin-bottom: 0.75rem; }
            h3 { color: #333; font-size: 1.1rem; font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; }
            .student-info { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #ddd; }
            .student-info p { margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .goal-section { margin-top: 25px; page-break-inside: avoid; }
            .goal-header { background-color: #f5f5f5; padding: 10px; margin-bottom: 10px; }
            .session-row { }
            .no-data { color: #666; font-style: italic; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>${reportTitle}</h1>
          <div class="student-info">
            <p><strong>Student:</strong> ${selectedStudent.name}</p>
            <p><strong>Age:</strong> ${selectedStudent.age}</p>
            <p><strong>Grade:</strong> ${selectedStudent.grade}</p>
            <p><strong>School:</strong> ${selectedStudent.school}</p>
            <p><strong>Report Date:</strong> ${formatDate(new Date().toISOString())}</p>
          </div>
    `;

    if (reportType === 'comprehensive') {
      // Comprehensive report - all sessions
      reportData.forEach((gp, idx) => {
        html += `
          <div class="goal-section">
            <div class="goal-header">
              <h3>Goal ${idx + 1}: ${gp.goal.description}</h3>
              <p><strong>Baseline:</strong> ${gp.goal.baseline}</p>
              <p><strong>Target:</strong> ${gp.goal.target}</p>
              ${gp.averageAccuracy !== undefined ? `<p><strong>Overall Average Performance:</strong> ${gp.averageAccuracy.toFixed(1)}%</p>` : ''}
            </div>
            ${gp.sessions.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Accuracy (%)</th>
                    <th>Correct Trials</th>
                    <th>Incorrect Trials</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${gp.sessions.map(s => `
                    <tr class="session-row">
                      <td>${formatDate(s.date)}</td>
                      <td>${s.accuracy !== undefined ? s.accuracy.toFixed(1) : 'N/A'}</td>
                      <td>${s.correctTrials ?? 'N/A'}</td>
                      <td>${s.incorrectTrials ?? 'N/A'}</td>
                      <td>${s.notes || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p class="no-data">No session data available for this goal.</p>'}
          </div>
        `;
      });
    } else {
      // Current performance report - current goals with last 3 sessions average
      reportData.forEach((gp, idx) => {
        html += `
          <div class="goal-section">
            <div class="goal-header">
              <h3>Goal ${idx + 1}: ${gp.goal.description}</h3>
              <p><strong>Baseline:</strong> ${gp.goal.baseline}</p>
              <p><strong>Target:</strong> ${gp.goal.target}</p>
              ${gp.averageAccuracy !== undefined ? `<p><strong>Average Performance (Last 3 Sessions):</strong> ${gp.averageAccuracy.toFixed(1)}%</p>` : '<p><strong>Average Performance:</strong> No data available</p>'}
            </div>
            ${gp.sessions.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Accuracy (%)</th>
                    <th>Correct Trials</th>
                    <th>Incorrect Trials</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${gp.sessions.map(s => `
                    <tr class="session-row">
                      <td>${formatDate(s.date)}</td>
                      <td>${s.accuracy !== undefined ? s.accuracy.toFixed(1) : 'N/A'}</td>
                      <td>${s.correctTrials ?? 'N/A'}</td>
                      <td>${s.incorrectTrials ?? 'N/A'}</td>
                      <td>${s.notes || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p class="no-data">No recent session data available for this goal.</p>'}
          </div>
        `;
      });
    }

    html += `
        </body>
      </html>
    `;

    return html;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Reports
        </Typography>
        {selectedStudentId && (
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              disabled={loading}
            >
              Print Report
            </Button>
            <Button
              variant="outlined"
              startIcon={<PdfIcon />}
              onClick={handleExportPDF}
              disabled={loading}
            >
              Export PDF
            </Button>
          </Stack>
        )}
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
            <Autocomplete
              sx={{ minWidth: 250 }}
              options={students}
              getOptionLabel={(option) => `${option.name}${option.grade ? ` (${option.grade})` : ''}`}
              filterOptions={(options, state) => filterStudentOptions(options, state.inputValue)}
              value={selectedStudent ?? null}
              onChange={(_, newValue) => setSelectedStudentId(newValue?.id ?? '')}
              renderInput={(params) => (
                <TextField {...params} label="Student" placeholder="Search by name, grade, or concerns" />
              )}
              isOptionEqualToValue={(option, value) => value != null && option.id === value.id}
              clearText="Clear"
            />
            <FormControl sx={{ minWidth: 250 }}>
              <InputLabel>Report Type</InputLabel>
              <Select
                value={reportType}
                label="Report Type"
                onChange={(e) => setReportType(e.target.value as 'comprehensive' | 'current')}
                disabled={!selectedStudentId}
              >
                <MenuItem value="comprehensive">Comprehensive Session Report</MenuItem>
                <MenuItem value="current">Current Performance Report</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && selectedStudentId && !selectedStudent && (
        <Alert severity="error">Student not found</Alert>
      )}

      {!loading && selectedStudentId && selectedStudent && (
        <>
          {reportType === 'comprehensive' ? (
            <Box>
              <Typography variant="h5" sx={{ mb: 2 }}>
                Comprehensive Session Report
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                All sessions, goals worked on, and performance percentages
              </Typography>

              {goalPerformanceData.length === 0 ? (
                <Alert severity="info">
                  No session data available for this student.
                </Alert>
              ) : (
                goalPerformanceData.map((gp, idx) => (
                  <Card key={gp.goalId} sx={{ mb: 3 }}>
                    <CardContent>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="h6" gutterBottom>
                          Goal {idx + 1}: {gp.goal.description}
                        </Typography>
                        <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
                          <Typography variant="body2">
                            <strong>Baseline:</strong> {gp.goal.baseline}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Target:</strong> {gp.goal.target}
                          </Typography>
                          {gp.averageAccuracy !== undefined && (
                            <Chip
                              label={`Average: ${gp.averageAccuracy.toFixed(1)}%`}
                              color="primary"
                              size="small"
                            />
                          )}
                        </Stack>
                      </Box>
                      <Divider sx={{ my: 2 }} />
                      {gp.sessions.length > 0 ? (
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell><strong>Date</strong></TableCell>
                                <TableCell><strong>Accuracy (%)</strong></TableCell>
                                <TableCell><strong>Correct Trials</strong></TableCell>
                                <TableCell><strong>Incorrect Trials</strong></TableCell>
                                <TableCell><strong>Notes</strong></TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {gp.sessions.map((session) => (
                                <TableRow key={session.sessionId}>
                                  <TableCell>{formatDate(session.date)}</TableCell>
                                  <TableCell>
                                    {session.accuracy !== undefined
                                      ? `${session.accuracy.toFixed(1)}%`
                                      : 'N/A'}
                                  </TableCell>
                                  <TableCell>{session.correctTrials ?? 'N/A'}</TableCell>
                                  <TableCell>{session.incorrectTrials ?? 'N/A'}</TableCell>
                                  <TableCell>{session.notes || '-'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No session data available for this goal.
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </Box>
          ) : (
            <Box>
              <Typography variant="h5" sx={{ mb: 2 }}>
                Current Performance Report
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Current goals and average performance of the last 3 sessions worked on
              </Typography>

              {currentPerformanceData.length === 0 ? (
                <Alert severity="info">
                  No current goals with session data available for this student.
                </Alert>
              ) : (
                currentPerformanceData.map((gp, idx) => (
                  <Card key={gp.goalId} sx={{ mb: 3 }}>
                    <CardContent>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="h6" gutterBottom>
                          Goal {idx + 1}: {gp.goal.description}
                        </Typography>
                        <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
                          <Typography variant="body2">
                            <strong>Baseline:</strong> {gp.goal.baseline}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Target:</strong> {gp.goal.target}
                          </Typography>
                          {gp.averageAccuracy !== undefined ? (
                            <Chip
                              label={`Average (Last 3): ${gp.averageAccuracy.toFixed(1)}%`}
                              color="primary"
                              size="small"
                            />
                          ) : (
                            <Chip
                              label="No data available"
                              color="default"
                              size="small"
                            />
                          )}
                        </Stack>
                      </Box>
                      <Divider sx={{ my: 2 }} />
                      {gp.sessions.length > 0 ? (
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell><strong>Date</strong></TableCell>
                                <TableCell><strong>Accuracy (%)</strong></TableCell>
                                <TableCell><strong>Correct Trials</strong></TableCell>
                                <TableCell><strong>Incorrect Trials</strong></TableCell>
                                <TableCell><strong>Notes</strong></TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {gp.sessions.map((session) => (
                                <TableRow key={session.sessionId}>
                                  <TableCell>{formatDate(session.date)}</TableCell>
                                  <TableCell>
                                    {session.accuracy !== undefined
                                      ? `${session.accuracy.toFixed(1)}%`
                                      : 'N/A'}
                                  </TableCell>
                                  <TableCell>{session.correctTrials ?? 'N/A'}</TableCell>
                                  <TableCell>{session.incorrectTrials ?? 'N/A'}</TableCell>
                                  <TableCell>{session.notes || '-'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No recent session data available for this goal.
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </Box>
          )}
        </>
      )}

      {!selectedStudentId && (
        <Alert severity="info">
          Please select a student to generate a report.
        </Alert>
      )}

      <Dialog open={printDialogOpen} onClose={() => setPrintDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Print Preview
          <IconButton
            aria-label="close"
            onClick={() => setPrintDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{ mt: 2 }}
            dangerouslySetInnerHTML={{ __html: printContent }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrintDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => {
              handlePrintExecute();
              setPrintDialogOpen(false);
            }} 
            variant="contained" 
            startIcon={<PrintIcon />}
          >
            Print
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
