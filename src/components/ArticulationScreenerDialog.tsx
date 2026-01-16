import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Grid,
  Paper,
  Chip,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  Save as SaveIcon,
  Print as PrintIcon,
  PictureAsPdf as PdfIcon,
  Edit as EditIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import type { Student, ArticulationScreener, DisorderedPhoneme, Evaluation } from '../types';
import { generateArticulationScreeningReport } from '../utils/gemini';
import {
  getArticulationScreeners,
  addArticulationScreener,
  updateArticulationScreener,
} from '../utils/storage-api';
import { formatDate, generateId } from '../utils/helpers';
import { useAIGeneration } from '../hooks/useAIGeneration';
import { useSnackbar } from '../hooks/useSnackbar';
import { logError } from '../utils/logger';

interface ArticulationScreenerDialogProps {
  open: boolean;
  onClose: () => void;
  student: Student;
  evaluation?: Evaluation;
  existingScreener?: ArticulationScreener;
  onScreenerCreated?: (screenerId: string) => void;
}

// Phoneme chart data structure based on Place-Manner-Voice chart
const PHONEME_CHART = {
  stops: {
    bilabial: { VL: 'p', V: 'b' },
    alveolar: { VL: 't', V: 'd' },
    velar: { VL: 'k', V: 'g' },
    glottal: { VL: 'ʔ', V: null },
  },
  fricatives: {
    labiodental: { VL: 'f', V: 'v' },
    dental: { VL: 'θ', V: 'ð' },
    alveolar: { VL: 's', V: 'z' },
    'post-alveolar': { VL: 'ʃ', V: 'ʒ' },
    glottal: { VL: 'h', V: null },
  },
  affricates: {
    'post-alveolar': { VL: 'tʃ', V: 'dʒ' },
  },
  nasals: {
    bilabial: { VL: 'm', V: null },
    alveolar: { VL: 'n', V: null },
    velar: { VL: 'ŋ', V: null },
  },
  liquids: {
    alveolar: { VL: 'l', V: null },
    'post-alveolar': { VL: 'ɹ', V: null },
  },
  glides: {
    bilabial: { VL: 'w', V: null },
    palatal: { VL: 'j', V: null },
    velar: { VL: 'w', V: null }, // labial-velar
  },
};

const PLACE_ORDER = ['bilabial', 'labiodental', 'dental', 'alveolar', 'post-alveolar', 'palatal', 'velar', 'glottal'];
const MANNER_ORDER = ['stops', 'fricatives', 'affricates', 'nasals', 'liquids', 'glides'];

export const ArticulationScreenerDialog = ({
  open,
  onClose,
  student,
  evaluation,
  existingScreener,
  onScreenerCreated,
}: ArticulationScreenerDialogProps) => {
  const [activeTab, setActiveTab] = useState(0);
  const [disorderedPhonemes, setDisorderedPhonemes] = useState<DisorderedPhoneme[]>([]);
  const [phonemeNotes, setPhonemeNotes] = useState<Record<string, string>>({});
  const [report, setReport] = useState<string>('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingScreener, setEditingScreener] = useState<ArticulationScreener | null>(null);
  const [screeningDate, setScreeningDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  
  const { requireApiKey } = useAIGeneration();
  const { showSnackbar, SnackbarComponent } = useSnackbar();

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (open) {
      isMountedRef.current = true;
      setError(null);
      setActiveTab(0);
      const screenerToEdit = existingScreener || editingScreener;
      if (screenerToEdit) {
        setDisorderedPhonemes(screenerToEdit.disorderedPhonemes || []);
        setReport(screenerToEdit.report || '');
        setScreeningDate(screenerToEdit.date.split('T')[0]);
        setEditingScreener(screenerToEdit);
        // Initialize phoneme notes
        const notesMap: Record<string, string> = {};
        screenerToEdit.disorderedPhonemes.forEach(dp => {
          if (dp.note) {
            notesMap[dp.phoneme] = dp.note;
          }
        });
        setPhonemeNotes(notesMap);
      } else {
        setDisorderedPhonemes([]);
        setPhonemeNotes({});
        setReport('');
        setScreeningDate(new Date().toISOString().split('T')[0]);
        setEditingScreener(null);
      }
    }
  }, [open, existingScreener]);

  const handlePhonemeToggle = (phoneme: string) => {
    if (!isMountedRef.current) return;
    
    const isSelected = disorderedPhonemes.some(dp => dp.phoneme === phoneme);
    
    if (isSelected) {
      // Remove phoneme
      setDisorderedPhonemes(prev => prev.filter(dp => dp.phoneme !== phoneme));
      setPhonemeNotes(prev => {
        const updated = { ...prev };
        delete updated[phoneme];
        return updated;
      });
    } else {
      // Add phoneme
      const existingNote = phonemeNotes[phoneme] || '';
      setDisorderedPhonemes(prev => [...prev, { phoneme, note: existingNote || undefined }]);
    }
  };

  const handlePhonemeNoteChange = (phoneme: string, note: string) => {
    if (!isMountedRef.current) return;
    
    setPhonemeNotes(prev => ({ ...prev, [phoneme]: note }));
    
    // Update the note in disorderedPhonemes array
    setDisorderedPhonemes(prev => prev.map(dp => 
      dp.phoneme === phoneme ? { ...dp, note: note || undefined } : dp
    ));
  };

  const handleGenerateReport = async () => {
    if (disorderedPhonemes.length === 0) {
      setError('Please select at least one disordered phoneme before generating a report.');
      return;
    }

    const apiKey = requireApiKey();
    if (!apiKey) return;

    setGeneratingReport(true);
    setError(null);

    try {
      // Update notes from phonemeNotes map
      const phonemesWithNotes = disorderedPhonemes.map(dp => ({
        phoneme: dp.phoneme,
        note: phonemeNotes[dp.phoneme] || dp.note || undefined,
      }));

      // Get SLP name from localStorage
      const slpName = localStorage.getItem('user_name') || 'Aaron Pope';
      
      const generatedReport = await generateArticulationScreeningReport(
        apiKey,
        student.name,
        student.age,
        student.grade,
        phonemesWithNotes,
        slpName
      );

      if (!isMountedRef.current) return;

      setReport(generatedReport);
      setActiveTab(1); // Switch to report tab
      showSnackbar('Report generated successfully', 'success');
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate report';
      setError(errorMessage);
      logError('Failed to generate articulation screening report', err);
    } finally {
      if (isMountedRef.current) {
        setGeneratingReport(false);
      }
    }
  };

  const handleSave = async () => {
    if (disorderedPhonemes.length === 0) {
      setError('Please select at least one disordered phoneme before saving.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Update notes from phonemeNotes map
      const phonemesWithNotes = disorderedPhonemes.map(dp => ({
        phoneme: dp.phoneme,
        note: phonemeNotes[dp.phoneme] || dp.note || undefined,
      }));

      const screenerData: ArticulationScreener = {
        id: editingScreener?.id || generateId(),
        studentId: student.id,
        date: new Date(screeningDate).toISOString(),
        disorderedPhonemes: phonemesWithNotes,
        report: report || undefined,
        evaluationId: evaluation?.id,
        dateCreated: editingScreener?.dateCreated || new Date().toISOString(),
        dateUpdated: new Date().toISOString(),
      };

      if (editingScreener) {
        await updateArticulationScreener(editingScreener.id, screenerData);
        showSnackbar('Screening saved successfully', 'success');
      } else {
        await addArticulationScreener(screenerData);
        showSnackbar('Screening saved successfully', 'success');
        if (onScreenerCreated) {
          onScreenerCreated(screenerData.id);
        }
      }

      if (!isMountedRef.current) return;

      onClose();
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to save screening';
      setError(errorMessage);
      logError('Failed to save articulation screener', err);
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const reportContent = `
      <html>
        <head>
          <title>Articulation Screening Report - ${student.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; }
            .student-info { margin-bottom: 20px; }
            .report-content { white-space: pre-wrap; line-height: 1.6; }
          </style>
        </head>
        <body>
          <h1>Articulation Screening Report</h1>
          <div class="student-info">
            <p><strong>Student:</strong> ${student.name}</p>
            <p><strong>Age:</strong> ${student.age}</p>
            <p><strong>Grade:</strong> ${student.grade}</p>
            <p><strong>Screening Date:</strong> ${formatDate(screeningDate)}</p>
          </div>
          <div class="report-content">${report || 'No report generated yet.'}</div>
        </body>
      </html>
    `;

    printWindow.document.write(reportContent);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportPDF = () => {
    // Simple PDF export using browser print-to-PDF
    handlePrint();
  };

  const isPhonemeSelected = (phoneme: string) => {
    return disorderedPhonemes.some(dp => dp.phoneme === phoneme);
  };

  const renderPhonemeChart = () => {
    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          IPA Place-Manner-Voice Chart: Consonants
        </Typography>
        <Box sx={{ overflowX: 'auto', mt: 2 }}>
          <Paper sx={{ p: 2 }}>
            <Grid container spacing={1}>
              {/* Header row */}
              <Grid item xs={12}>
                <Grid container spacing={1}>
                  <Grid item xs={2}>
                    <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                      MANNER / PLACE
                    </Typography>
                  </Grid>
                  {PLACE_ORDER.map(place => (
                    <Grid item xs={1.25} key={place}>
                      <Typography variant="caption" sx={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                        {place.replace('-', ' ')}
                      </Typography>
                      <Grid container spacing={0.5}>
                        <Grid item xs={6}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>VL</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>V</Typography>
                        </Grid>
                      </Grid>
                    </Grid>
                  ))}
                </Grid>
              </Grid>

              {/* Manner rows */}
              {MANNER_ORDER.map(manner => {
                const mannerData = PHONEME_CHART[manner as keyof typeof PHONEME_CHART];
                if (!mannerData) return null;

                return (
                  <Grid item xs={12} key={manner}>
                    <Grid container spacing={1} alignItems="center">
                      <Grid item xs={2}>
                        <Typography variant="caption" sx={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                          {manner}
                        </Typography>
                      </Grid>
                      {PLACE_ORDER.map(place => {
                        const placeData = mannerData[place as keyof typeof mannerData];
                        if (!placeData) {
                          return <Grid item xs={1.25} key={place} />;
                        }

                        return (
                          <Grid item xs={1.25} key={place}>
                            <Grid container spacing={0.5}>
                              {/* Voiceless */}
                              <Grid item xs={6}>
                                {placeData.VL && (
                                  <Box
                                    sx={{
                                      border: isPhonemeSelected(placeData.VL) ? '2px solid' : '1px solid',
                                      borderColor: isPhonemeSelected(placeData.VL) ? 'primary.main' : 'divider',
                                      bgcolor: isPhonemeSelected(placeData.VL) ? 'primary.light' : 'transparent',
                                      borderRadius: 1,
                                      p: 0.5,
                                      textAlign: 'center',
                                      cursor: 'pointer',
                                      '&:hover': {
                                        bgcolor: 'action.hover',
                                      },
                                    }}
                                    onClick={() => handlePhonemeToggle(placeData.VL!)}
                                  >
                                    <Typography variant="body2">{placeData.VL}</Typography>
                                  </Box>
                                )}
                              </Grid>
                              {/* Voiced */}
                              <Grid item xs={6}>
                                {placeData.V && (
                                  <Box
                                    sx={{
                                      border: isPhonemeSelected(placeData.V) ? '2px solid' : '1px solid',
                                      borderColor: isPhonemeSelected(placeData.V) ? 'primary.main' : 'divider',
                                      bgcolor: isPhonemeSelected(placeData.V) ? 'primary.light' : 'transparent',
                                      borderRadius: 1,
                                      p: 0.5,
                                      textAlign: 'center',
                                      cursor: 'pointer',
                                      '&:hover': {
                                        bgcolor: 'action.hover',
                                      },
                                    }}
                                    onClick={() => handlePhonemeToggle(placeData.V!)}
                                  >
                                    <Typography variant="body2">{placeData.V}</Typography>
                                  </Box>
                                )}
                              </Grid>
                            </Grid>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Grid>
                );
              })}
            </Grid>
          </Paper>
        </Box>

        {/* Selected phonemes list with notes */}
        {disorderedPhonemes.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Disordered Phonemes ({disorderedPhonemes.length})
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
              {disorderedPhonemes.map(dp => (
                <Box key={dp.phoneme} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Chip
                    label={dp.phoneme}
                    color="primary"
                    onDelete={() => handlePhonemeToggle(dp.phoneme)}
                    sx={{ 
                      '& .MuiChip-label': {
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        color: 'white',
                        px: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'visible',
                      },
                    }}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Add note about this phoneme (optional)"
                    value={phonemeNotes[dp.phoneme] || dp.note || ''}
                    onChange={(e) => handlePhonemeNoteChange(dp.phoneme, e.target.value)}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box>
            <Box component="span">Articulation Screener</Box>
            <Box component="div" sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
              {student.name} (Age: {student.age}, Grade: {student.grade})
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <TextField
              label="Screening Date"
              type="date"
              fullWidth
              value={screeningDate}
              onChange={(e) => setScreeningDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
              <Tab label="Phoneme Selection" />
              <Tab label="Report" disabled={!report} />
            </Tabs>

            {activeTab === 0 && (
              <Box>
                {renderPhonemeChart()}
                <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={generatingReport ? <CircularProgress size={20} /> : <PsychologyIcon />}
                    onClick={handleGenerateReport}
                    disabled={generatingReport || disorderedPhonemes.length === 0}
                  >
                    Generate Report
                  </Button>
                  {disorderedPhonemes.length > 0 && (
                    <Chip
                      label={`${disorderedPhonemes.length} phoneme${disorderedPhonemes.length !== 1 ? 's' : ''} selected`}
                      color="primary"
                    />
                  )}
                </Box>
              </Box>
            )}

            {activeTab === 1 && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Screening Report</Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Print">
                      <IconButton onClick={handlePrint} size="small">
                        <PrintIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Export PDF">
                      <IconButton onClick={handleExportPDF} size="small">
                        <PdfIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                <TextField
                  fullWidth
                  multiline
                  rows={20}
                  value={report}
                  onChange={(e) => setReport(e.target.value)}
                  placeholder="Report will appear here after generation..."
                  sx={{ fontFamily: 'monospace' }}
                />
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || disorderedPhonemes.length === 0}
          >
            Save Screening
          </Button>
        </DialogActions>
      </Dialog>
      <SnackbarComponent />
    </>
  );
};

