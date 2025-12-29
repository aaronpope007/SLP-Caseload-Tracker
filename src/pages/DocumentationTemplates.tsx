import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  Grid,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  CircularProgress,
} from '@mui/material';
import {
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { generateDocumentationTemplate } from '../utils/gemini';
import { useDialog, useSnackbar, useAIGeneration } from '../hooks';
import { getErrorMessage } from '../utils/validators';
import { logError } from '../utils/logger';

export const DocumentationTemplates = () => {
  const [templateType, setTemplateType] = useState<'evaluation' | 'progress-note' | 'discharge-summary' | 'treatment-plan' | 'soap-note'>('progress-note');
  const [studentName, setStudentName] = useState('');
  const [studentAge, setStudentAge] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [template, setTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const dialog = useDialog();
  const { showSnackbar, SnackbarComponent } = useSnackbar();
  const { requireApiKey } = useAIGeneration();

  const handleGenerate = async () => {
    if (!studentName.trim()) {
      showSnackbar('Please enter student name', 'error');
      return;
    }

    const apiKey = requireApiKey();
    if (!apiKey) {
      return;
    }

    setLoading(true);

    try {
      const generatedTemplate = await generateDocumentationTemplate(
        apiKey,
        templateType,
        studentName,
        parseInt(studentAge) || 0,
        studentGrade,
        additionalContext || undefined
      );
      setTemplate(generatedTemplate);
      dialog.openDialog();
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      showSnackbar(errorMessage, 'error');
      logError('Failed to generate documentation template', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (template) {
      try {
        await navigator.clipboard.writeText(template);
        showSnackbar('Template copied to clipboard!', 'success');
      } catch (err: unknown) {
        const errorMessage = getErrorMessage(err);
        showSnackbar(`Failed to copy to clipboard: ${errorMessage}`, 'error');
        logError('Failed to copy template to clipboard', err);
      }
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Documentation Templates
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Generate professional documentation templates for various clinical documentation needs.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Template Type</InputLabel>
              <Select
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value as typeof templateType)}
                label="Template Type"
              >
                <MenuItem value="evaluation">Evaluation Report</MenuItem>
                <MenuItem value="progress-note">Progress Note</MenuItem>
                <MenuItem value="discharge-summary">Discharge Summary</MenuItem>
                <MenuItem value="treatment-plan">Treatment Plan</MenuItem>
                <MenuItem value="soap-note">SOAP Note</MenuItem>
              </Select>
            </FormControl>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Student Name"
                  fullWidth
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Age"
                  type="number"
                  fullWidth
                  value={studentAge}
                  onChange={(e) => setStudentAge(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Grade"
                  fullWidth
                  value={studentGrade}
                  onChange={(e) => setStudentGrade(e.target.value)}
                />
              </Grid>
            </Grid>

            <TextField
              label="Additional Context (Optional)"
              fullWidth
              multiline
              rows={4}
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              helperText="Add any additional information that should be included in the template (e.g., diagnosis, specific areas to address, etc.)"
            />

            <Button
              variant="contained"
              size="large"
              onClick={handleGenerate}
              disabled={loading || !studentName.trim()}
              startIcon={loading ? <CircularProgress size={20} /> : <DescriptionIcon />}
            >
              Generate Template
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Template Types
          </Typography>
          <Typography variant="body2" color="text.secondary" component="div">
            <ul>
              <li><strong>Evaluation Report:</strong> Comprehensive speech-language evaluation report template</li>
              <li><strong>Progress Note:</strong> Template for documenting ongoing therapy sessions</li>
              <li><strong>Discharge Summary:</strong> Template for discharge documentation</li>
              <li><strong>Treatment Plan:</strong> Template for creating treatment plans</li>
              <li><strong>SOAP Note:</strong> Subjective, Objective, Assessment, Plan format template</li>
            </ul>
          </Typography>
        </CardContent>
      </Card>

      <Dialog open={dialog.open} onClose={dialog.closeDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          Generated {templateType === 'evaluation' ? 'Evaluation Report' :
            templateType === 'progress-note' ? 'Progress Note' :
            templateType === 'discharge-summary' ? 'Discharge Summary' :
            templateType === 'treatment-plan' ? 'Treatment Plan' :
            'SOAP Note'} Template
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Typography
              component="div"
              sx={{
                whiteSpace: 'pre-wrap',
                p: 2,
                bgcolor: 'background.paper',
                borderRadius: 1,
                maxHeight: '500px',
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
              }}
            >
              {template}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCopyToClipboard}>Copy to Clipboard</Button>
          <Button onClick={dialog.closeDialog} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <SnackbarComponent />
    </Box>
  );
};

