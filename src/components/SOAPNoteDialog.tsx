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
import { useState, useEffect, useRef } from 'react';
import type { Session, Student, Goal, SOAPNote } from '../types';
import { generateSOAPNote } from '../utils/soapNoteGenerator';
import { formatDateTime, generateId } from '../utils/helpers';
import { useConfirm } from '../hooks';

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
  const originalValuesRef = useRef<{ subjective: string; objective: string; assessment: string; plan: string } | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    if (open) {
      if (existingSOAPNote) {
        // Load existing SOAP note
        setSubjective(existingSOAPNote.subjective);
        setObjective(existingSOAPNote.objective);
        setAssessment(existingSOAPNote.assessment);
        setPlan(existingSOAPNote.plan);
        // Store original values for comparison
        originalValuesRef.current = {
          subjective: existingSOAPNote.subjective,
          objective: existingSOAPNote.objective,
          assessment: existingSOAPNote.assessment,
          plan: existingSOAPNote.plan,
        };
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
        originalValuesRef.current = null;
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

  const hasUnsavedChanges = (): boolean => {
    if (!existingSOAPNote || !originalValuesRef.current) {
      return false;
    }
    return (
      subjective !== originalValuesRef.current.subjective ||
      objective !== originalValuesRef.current.objective ||
      assessment !== originalValuesRef.current.assessment ||
      plan !== originalValuesRef.current.plan
    );
  };

  const handleCancel = () => {
    if (existingSOAPNote && hasUnsavedChanges()) {
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

  return (
    <>
      <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box>
            <Box component="span">SOAP Note - {student.name}</Box>
            <Box component="div" sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
              {formatDateTime(session.date)}
            </Box>
          </Box>
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
          <Button onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {existingSOAPNote ? 'Update' : 'Save'} SOAP Note
          </Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog />
    </>
  );
};

