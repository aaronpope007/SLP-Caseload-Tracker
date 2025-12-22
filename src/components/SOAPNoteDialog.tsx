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
} from '@mui/material';
import { useState, useEffect } from 'react';
import type { Session, Student, Goal, SOAPNote } from '../types';
import { generateSOAPNote } from '../utils/soapNoteGenerator';
import { formatDateTime, generateId } from '../utils/helpers';

interface SOAPNoteDialogProps {
  open: boolean;
  session: Session;
  student: Student;
  goals: Goal[];
  existingSOAPNote?: SOAPNote;
  onClose: () => void;
  onSave: (soapNote: SOAPNote) => void;
}

export const SOAPNoteDialog = ({
  open,
  session,
  student,
  goals,
  existingSOAPNote,
  onClose,
  onSave,
}: SOAPNoteDialogProps) => {
  const [subjective, setSubjective] = useState('');
  const [objective, setObjective] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');

  useEffect(() => {
    if (open) {
      if (existingSOAPNote) {
        // Load existing SOAP note
        setSubjective(existingSOAPNote.subjective);
        setObjective(existingSOAPNote.objective);
        setAssessment(existingSOAPNote.assessment);
        setPlan(existingSOAPNote.plan);
      } else {
        // Generate new SOAP note from session data
        const generated = generateSOAPNote(
          session,
          student,
          goals,
          session.selectedSubjectiveStatements || [],
          session.customSubjective || ''
        );
        setSubjective(generated.subjective);
        setObjective(generated.objective);
        setAssessment(generated.assessment);
        setPlan(generated.plan);
      }
    }
  }, [open, session, student, goals, existingSOAPNote]);

  const handleSave = () => {
    const soapNote: SOAPNote = {
      id: existingSOAPNote?.id || generateId(),
      sessionId: session.id,
      studentId: student.id,
      date: session.date,
      subjective,
      objective,
      assessment,
      plan,
      dateCreated: existingSOAPNote?.dateCreated || new Date().toISOString(),
      dateUpdated: new Date().toISOString(),
    };
    onSave(soapNote);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        SOAP Note - {student.name}
        <Typography variant="caption" display="block" color="text.secondary">
          {formatDateTime(session.date)}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Box>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              S - Subjective
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={subjective}
              onChange={(e) => setSubjective(e.target.value)}
              placeholder="Subjective information from client, parent, teacher, or observations..."
            />
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              O - Objective
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Objective data: measurements, observations, test results..."
            />
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              A - Assessment
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={assessment}
              onChange={(e) => setAssessment(e.target.value)}
              placeholder="Clinical interpretation and analysis of the data..."
            />
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              P - Plan
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              placeholder="Next steps, modifications, recommendations..."
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          {existingSOAPNote ? 'Update' : 'Save'} SOAP Note
        </Button>
      </DialogActions>
    </Dialog>
  );
};

