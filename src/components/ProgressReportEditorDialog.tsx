import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import { useState, useEffect, useRef } from 'react';
import type { ProgressReport, Student, Goal, Session, ProgressReportTemplate } from '../types';
import { formatDate, generateId } from '../utils/helpers';
import { useConfirm, useAIGeneration, useSnackbar } from '../hooks';
import {
  getProgressReportTemplate,
  getProgressReportTemplates,
  getGoals,
  getSessions,
  updateProgressReport,
} from '../utils/storage-api';
import { logError } from '../utils/logger';

interface ProgressReportEditorDialogProps {
  open: boolean;
  report: ProgressReport;
  student: Student;
  template?: ProgressReportTemplate;
  onClose: () => void;
  onSave: () => void;
}

interface SectionContent {
  [sectionId: string]: string;
}

export const ProgressReportEditorDialog = ({
  open,
  report,
  student,
  template: initialTemplate,
  onClose,
  onSave,
}: ProgressReportEditorDialogProps) => {
  const [template, setTemplate] = useState<ProgressReportTemplate | null>(initialTemplate || null);
  const [templates, setTemplates] = useState<ProgressReportTemplate[]>([]);
  const [sectionContents, setSectionContents] = useState<SectionContent>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const originalContentsRef = useRef<SectionContent | null>(null);
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  const { confirm, ConfirmDialog } = useConfirm();
  const { requireApiKey } = useAIGeneration();
  const { showSnackbar, SnackbarComponent } = useSnackbar();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      // Reset mounted flag when dialog opens
      isMountedRef.current = true;
      loadData();
    }
    return () => {
      // Cleanup: mark as unmounted when dialog closes or component unmounts
      isMountedRef.current = false;
    };
  }, [open, report.id, student.id]);

  const loadData = async () => {
    if (!isMountedRef.current) return;
    setLoading(true);
    try {
      // Load templates
      const allTemplates = await getProgressReportTemplates(report.reportType);
      setTemplates(allTemplates);
      
      // Find default template or use first one
      let selectedTemplate = initialTemplate || allTemplates.find(t => t.isDefault) || allTemplates[0];
      if (!selectedTemplate && report.templateId) {
        selectedTemplate = await getProgressReportTemplate(report.templateId) || null;
      }
      setTemplate(selectedTemplate);

      // Load goals and sessions for the reporting period
      const allGoals = await getGoals();
      const studentGoals = allGoals.filter(g => g.studentId === student.id);
      setGoals(studentGoals);

      const allSessions = await getSessions();
      const periodSessions = allSessions.filter(s => 
        s.studentId === student.id &&
        s.date >= report.periodStart &&
        s.date <= report.periodEnd
      );
      setSessions(periodSessions);

      // Initialize section contents from saved report or template
      const savedContent = report.content ? JSON.parse(report.content) : {};
      const initialContents: SectionContent = {};
      
      if (selectedTemplate) {
        selectedTemplate.sections
          .sort((a, b) => a.order - b.order)
          .forEach(section => {
            if (savedContent[section.id]) {
              initialContents[section.id] = savedContent[section.id];
            } else if (section.includeGoals || section.includeSessions) {
              // Auto-populate from goals/sessions
              initialContents[section.id] = generateSectionContent(section, studentGoals, periodSessions);
            } else {
              initialContents[section.id] = section.content || '';
            }
          });
      }
      
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setSectionContents(initialContents);
        originalContentsRef.current = { ...initialContents };
      }
    } catch (error) {
      if (isMountedRef.current) {
        logError('Failed to load progress report data', error);
        showSnackbar('Failed to load report data', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const generateSectionContent = (
    section: { includeGoals?: boolean; includeSessions?: boolean },
    studentGoals: Goal[],
    periodSessions: Session[]
  ): string => {
    let content = '';

    if (section.includeGoals && studentGoals.length > 0) {
      content += '**Goals Progress:**\n\n';
      studentGoals.forEach((goal, index) => {
        const goalSessions = periodSessions.filter(s => (s.goalsTargeted || []).includes(goal.id));
        const performanceData = goalSessions.flatMap(s => 
          s.performanceData.filter(p => p.goalId === goal.id)
        );
        
        const latestPerformance = performanceData[performanceData.length - 1];
        const averageAccuracy = performanceData.length > 0
          ? Math.round(performanceData.reduce((sum, p) => sum + (parseFloat(p.accuracy?.toString() || '0') || 0), 0) / performanceData.length)
          : null;

        content += `${index + 1}. **${goal.description}**\n`;
        content += `   - Baseline: ${goal.baseline}\n`;
        content += `   - Target: ${goal.target}\n`;
        if (averageAccuracy !== null) {
          content += `   - Average Performance: ${averageAccuracy}%\n`;
        }
        if (latestPerformance) {
          content += `   - Latest Performance: ${latestPerformance.accuracy || 'N/A'}\n`;
        }
        content += `   - Status: ${goal.status}\n`;
        if (goalSessions.length > 0) {
          content += `   - Sessions Targeting Goal: ${goalSessions.length}\n`;
        }
        content += '\n';
      });
    }

    if (section.includeSessions && periodSessions.length > 0) {
      if (content) content += '\n';
      content += '**Session Summary:**\n\n';
      content += `Total Sessions: ${periodSessions.length}\n`;
      content += `Period: ${formatDate(report.periodStart)} - ${formatDate(report.periodEnd)}\n`;
      content += `Attendance Rate: ${periodSessions.filter(s => !s.missedSession).length}/${periodSessions.length} sessions attended\n\n`;
      
      const uniqueActivities = new Set<string>();
      periodSessions.forEach(s => {
        s.activitiesUsed.forEach(a => uniqueActivities.add(a));
      });
      if (uniqueActivities.size > 0) {
        content += `Activities Used: ${Array.from(uniqueActivities).join(', ')}\n`;
      }
    }

    return content.trim();
  };

  const handleTemplateChange = (templateId: string) => {
    const newTemplate = templates.find(t => t.id === templateId);
    if (newTemplate) {
      setTemplate(newTemplate);
      const newContents: SectionContent = {};
      newTemplate.sections
        .sort((a, b) => a.order - b.order)
        .forEach(section => {
          if (section.includeGoals || section.includeSessions) {
            newContents[section.id] = generateSectionContent(section, goals, sessions);
          } else {
            newContents[section.id] = section.content || '';
          }
        });
      setSectionContents(newContents);
      originalContentsRef.current = { ...newContents };
    }
  };

  const handleSectionContentChange = (sectionId: string, value: string) => {
    setSectionContents(prev => ({
      ...prev,
      [sectionId]: value,
    }));
  };

  const handleGenerateWithAI = async (sectionId: string) => {
    const apiKey = requireApiKey();
    if (!apiKey) return;

    const section = template?.sections.find(s => s.id === sectionId);
    if (!section) return;

    // Check if component is still mounted before starting
    if (!isMountedRef.current) return;

    setGenerating(true);
    try {
      // Build context for AI generation
      const goalSummary = goals.map(g => `Goal: ${g.description} (Baseline: ${g.baseline}, Target: ${g.target}, Status: ${g.status})`).join('\n');
      const sessionSummary = `Total sessions: ${sessions.length} between ${formatDate(report.periodStart)} and ${formatDate(report.periodEnd)}`;

      const prompt = `Generate professional content for a ${report.reportType} progress report section titled "${section.title}" for student ${student.name} (Age: ${student.age}, Grade: ${student.grade}).

Goals Summary:
${goalSummary}

Session Summary:
${sessionSummary}

${section.content ? `Template instructions: ${section.content}` : ''}

Generate concise, professional, clinically appropriate content for this section.`;

      // Use Gemini API to generate content
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Try models in order of preference (Gemini 3 first, then fallbacks)
      const modelsToTry = ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
      let generatedText = '';
      let lastError: Error | null = null;
      
      for (const modelName of modelsToTry) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(prompt);
          const response = result.response;
          generatedText = response.text();
          break; // Success, exit loop
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStatus = (error as { status?: number })?.status;
          lastError = error instanceof Error ? error : new Error(errorMessage);
          
          // If it's a 404, try the next model
          if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
            continue;
          }
          // For other errors, stop trying
          break;
        }
      }
      
      if (!generatedText) {
        throw lastError || new Error('Failed to generate content with any available model');
      }

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        handleSectionContentChange(sectionId, generatedText);
        showSnackbar('Content generated successfully', 'success');
      }
    } catch (error) {
      if (isMountedRef.current) {
        logError('Failed to generate content with AI', error);
        showSnackbar('Failed to generate content. Please try again.', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setGenerating(false);
      }
    }
  };

  const handleSave = async () => {
    try {
      const content = JSON.stringify(sectionContents);
      await updateProgressReport(report.id, {
        content,
        templateId: template?.id,
        status: report.status === 'scheduled' ? 'in-progress' : report.status,
        dateUpdated: new Date().toISOString(),
      });
      onSave();
      showSnackbar('Progress report saved successfully', 'success');
      onClose();
    } catch (error) {
      logError('Failed to save progress report', error);
      showSnackbar('Failed to save report. Please try again.', 'error');
    }
  };

  const handleMarkComplete = async () => {
    try {
      const content = JSON.stringify(sectionContents);
      await updateProgressReport(report.id, {
        content,
        templateId: template?.id,
        status: 'completed',
        completedDate: new Date().toISOString(),
        dateUpdated: new Date().toISOString(),
      });
      onSave();
      showSnackbar('Progress report marked as complete', 'success');
      onClose();
    } catch (error) {
      logError('Failed to complete progress report', error);
      showSnackbar('Failed to mark report as complete. Please try again.', 'error');
    }
  };

  const handleExport = () => {
    // Generate plain text report
    if (!template) return;

    let reportText = `Progress Report - ${student.name}\n`;
    reportText += `Report Type: ${report.reportType === 'quarterly' ? 'Quarterly' : 'Annual'}\n`;
    reportText += `Period: ${formatDate(report.periodStart)} - ${formatDate(report.periodEnd)}\n`;
    reportText += `Due Date: ${formatDate(report.dueDate)}\n`;
    reportText += `Status: ${report.status}\n`;
    reportText += '\n' + '='.repeat(50) + '\n\n';

    template.sections
      .sort((a, b) => a.order - b.order)
      .forEach(section => {
        const content = sectionContents[section.id] || '';
        if (content.trim()) {
          reportText += `${section.title}\n`;
          reportText += '-'.repeat(30) + '\n';
          reportText += content + '\n\n';
        }
      });

    // Create download - ensure URL is always revoked
    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = `Progress_Report_${student.name.replace(/\s+/g, '_')}_${formatDate(report.periodStart)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showSnackbar('Report exported successfully', 'success');
    } catch (error) {
      logError('Failed to export report', error);
      showSnackbar('Failed to export report', 'error');
    } finally {
      // Always revoke URL to prevent memory leak
      URL.revokeObjectURL(url);
    }
  };

  const hasUnsavedChanges = (): boolean => {
    if (!originalContentsRef.current) return false;
    return JSON.stringify(sectionContents) !== JSON.stringify(originalContentsRef.current);
  };

  const handleCancel = () => {
    if (hasUnsavedChanges()) {
      confirm({
        title: 'Discard Changes?',
        message: 'You have unsaved changes. Are you sure you want to cancel? All changes will be lost.',
        confirmText: 'Discard',
        cancelText: 'Keep Editing',
        onConfirm: () => {
          onClose();
        },
      });
    } else {
      onClose();
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  if (!template) {
    return (
      <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
        <DialogTitle>Progress Report - {student.name}</DialogTitle>
        <DialogContent>
          <Typography color="error">
            No template found. Please create a template for {report.reportType} reports first.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onClose={handleCancel} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Box component="span">Progress Report - {student.name}</Box>
              <Box component="div" sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                {report.reportType === 'quarterly' ? 'Quarterly' : 'Annual'} Report | 
                Period: {formatDate(report.periodStart)} - {formatDate(report.periodEnd)} | 
                Due: {formatDate(report.dueDate)}
              </Box>
            </Box>
            <Chip
              label={report.status.charAt(0).toUpperCase() + report.status.slice(1).replace('-', ' ')}
              color={
                report.status === 'completed' ? 'success' :
                report.status === 'overdue' ? 'error' :
                report.status === 'in-progress' ? 'warning' : 'info'
              }
              size="small"
            />
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* Template Selector */}
            {templates.length > 1 && (
              <FormControl fullWidth>
                <InputLabel>Template</InputLabel>
                <Select
                  value={template.id}
                  label="Template"
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  {templates.map(t => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.name} {t.isDefault && '(Default)'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Report Sections */}
            {template.sections
              .sort((a, b) => a.order - b.order)
              .map((section) => (
                <Accordion key={section.id} defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 2 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {section.title}
                      </Typography>
                      {(section.includeGoals || section.includeSessions) && (
                        <Chip label="Auto-populated" size="small" color="info" sx={{ ml: 2 }} />
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {section.content && (
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                          {section.content}
                        </Typography>
                      )}
                      <TextField
                        fullWidth
                        multiline
                        rows={8}
                        value={sectionContents[section.id] || ''}
                        onChange={(e) => handleSectionContentChange(section.id, e.target.value)}
                        placeholder={section.includeGoals || section.includeSessions 
                          ? 'Auto-populated from goals and sessions. Edit as needed.'
                          : 'Enter content for this section...'}
                      />
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                        <Button
                          size="small"
                          startIcon={generating ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                          onClick={() => handleGenerateWithAI(section.id)}
                          disabled={generating}
                        >
                          Generate with AI
                        </Button>
                      </Box>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}

            {/* Summary Stats Card */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Report Period Summary
                </Typography>
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mt: 1 }}>
                  <Typography variant="body2">
                    <strong>Goals:</strong> {goals.length}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Sessions:</strong> {sessions.length}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Attendance:</strong> {sessions.filter(s => !s.missedSession).length}/{sessions.length}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Period:</strong> {formatDate(report.periodStart)} - {formatDate(report.periodEnd)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleExport} startIcon={<DownloadIcon />}>
            Export
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" startIcon={<SaveIcon />}>
            Save
          </Button>
          {report.status !== 'completed' && (
            <Button onClick={handleMarkComplete} variant="contained" color="success">
              Mark Complete
            </Button>
          )}
        </DialogActions>
      </Dialog>
      <ConfirmDialog />
      <SnackbarComponent />
    </>
  );
};

