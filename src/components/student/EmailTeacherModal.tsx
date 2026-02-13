import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Checkbox,
  FormControlLabel,
  Alert,
  Stack,
  Box,
  Typography,
} from '@mui/material';
import {
  Email as EmailIcon,
} from '@mui/icons-material';
import type { Student, Teacher, CaseManager, Communication } from '../../types';
import { api } from '../../utils/api';
import { logError } from '../../utils/logger';
import { getErrorMessage } from '../../utils/validators';

interface EmailTeacherModalProps {
  open: boolean;
  onClose: () => void;
  student: Student;
  teacher: Teacher | null;
  caseManager: CaseManager | null;
  onEmailSent?: () => void;
}

export const EmailTeacherModal = ({
  open,
  onClose,
  student,
  teacher,
  caseManager,
  onEmailSent,
}: EmailTeacherModalProps) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [ccCaseManager, setCcCaseManager] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Generate greeting based on teacher gender (e.g. "Dear Mr. Jensen," or "Dear Ms. Smith,")
  const getGreeting = (): string => {
    if (!teacher) return '';
    const parts = teacher.name.trim().split(/\s+/);
    const lastName = parts.length > 1 ? parts[parts.length - 1] : teacher.name.trim();

    if (teacher.gender === 'male') {
      return `Dear Mr. ${lastName},`;
    } else if (teacher.gender === 'female') {
      return `Dear Ms. ${lastName},`;
    } else {
      // No gender assigned, use full teacher name
      return `Dear ${teacher.name},`;
    }
  };

  // Generate email template
  // TODO: Make signature configurable from logged-in user values (name, credentials, phone)
  // Currently hardcoded: "Aaron Pope, M.S. CCC-SLP" and "(612) 310-9661"
  const generateTemplate = (): string => {
    const greeting = getGreeting();
    const signature = `Best regards,\n\nAaron Pope, M.S. CCC-SLP\n(612) 310-9661`;
    
    return `${greeting}\n\n\n\n${signature}`;
  };

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open && teacher) {
      setSubject('');
      setBody(generateTemplate());
      setCcCaseManager(caseManager !== null);
      setError(null);
      setSuccess(false);
    }
  }, [open, teacher, caseManager]);

  const handleSend = async () => {
    if (!teacher || !teacher.emailAddress) {
      setError('Teacher email address is required.');
      return;
    }

    // Check email credentials
    const emailAddress = localStorage.getItem('email_address');
    const emailPassword = localStorage.getItem('email_password');

    if (!emailAddress || !emailPassword) {
      setError('Email credentials not configured. Please add your Gmail address and App Password in Settings.');
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(false);

    try {
      const userName = localStorage.getItem('user_name') || 'Aaron Pope';
      
      // Build CC list
      const ccEmails: string[] = [];
      if (ccCaseManager && caseManager?.emailAddress?.trim()) {
        ccEmails.push(caseManager.emailAddress.trim());
      }

      // Same as missed-session flow: BCC so the user gets a copy
      const bccToSelf = 'aaronpope007@gmail.com';

      // Send email
      const sendPayload: Parameters<typeof api.email.send>[0] = {
        to: teacher.emailAddress,
        subject: subject,
        body: body.trim(),
        fromEmail: emailAddress,
        fromName: userName,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpUser: emailAddress,
        smtpPassword: emailPassword,
        bcc: bccToSelf,
      };

      if (ccEmails.length > 0) {
        sendPayload.cc = ccEmails;
      }

      await api.email.send(sendPayload);

      // Automatically log the communication
      try {
        const communicationData: Omit<Communication, 'id' | 'dateCreated'> = {
          studentId: student.id,
          contactType: 'teacher',
          contactId: teacher.id,
          contactName: teacher.name,
          contactEmail: teacher.emailAddress,
          subject: subject,
          body: body.trim(),
          method: 'email' as const,
          date: new Date().toISOString(),
        };

        await api.communications.create(communicationData);
      } catch (loggingError: unknown) {
        // Don't fail the email send if logging fails, but log the error
        logError('Failed to log communication', loggingError);
      }

      setSuccess(true);
      if (onEmailSent) {
        onEmailSent();
      }
      
      // Close dialog after a short delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      logError('Error sending email', err);
      setError(errorMessage || 'Failed to send email. Please check your email settings and try again.');
    } finally {
      setSending(false);
    }
  };

  const canSend = teacher?.emailAddress && subject.trim() && body.trim();

  if (!teacher) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Email Teacher</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Student: <strong>{student.name}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Teacher: <strong>{teacher.name}</strong>
              {teacher.emailAddress && ` (${teacher.emailAddress})`}
            </Typography>
          </Box>

          {caseManager && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={ccCaseManager}
                  onChange={(e) => setCcCaseManager(e.target.checked)}
                  disabled={sending}
                />
              }
              label={`CC Case Manager: ${caseManager.name}${caseManager.emailAddress ? ` (${caseManager.emailAddress})` : ''}`}
            />
          )}

          <TextField
            fullWidth
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            disabled={sending}
          />

          <TextField
            fullWidth
            multiline
            rows={12}
            label="Email Body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            disabled={sending}
          />

          {success && (
            <Alert severity="success">Email sent successfully and logged!</Alert>
          )}
          {error && (
            <Alert severity="error">{error}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={sending}>
          Cancel
        </Button>
        <Button
          onClick={handleSend}
          startIcon={<EmailIcon />}
          variant="contained"
          disabled={!canSend || sending}
        >
          {sending ? 'Sending...' : 'Send Email'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
