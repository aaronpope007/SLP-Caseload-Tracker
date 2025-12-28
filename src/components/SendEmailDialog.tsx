import { useState, useEffect } from 'react';
import { logError } from '../utils/logger';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Stack,
  Box,
  Typography,
} from '@mui/material';
import {
  Email as EmailIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import type { Student, Teacher, CaseManager, Communication } from '../types';
import { api } from '../utils/api';

interface SendEmailDialogProps {
  open: boolean;
  onClose: () => void;
  students: Student[];
  teachers: Teacher[];
  caseManagers: CaseManager[];
  selectedSchool?: string;
  onEmailSent?: () => void;
}

export const SendEmailDialog = ({
  open,
  onClose,
  students,
  teachers,
  caseManagers,
  selectedSchool,
  onEmailSent,
}: SendEmailDialogProps) => {
  const [contactType, setContactType] = useState<Communication['contactType']>('teacher');
  const [contactId, setContactId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [relatedTo, setRelatedTo] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setContactType('teacher');
      setContactId('');
      setContactName('');
      setContactEmail('');
      setStudentId('');
      setSubject('');
      setBody('');
      setRelatedTo('');
      setError(null);
      setSuccess(false);
      setCopied(false);
    }
  }, [open]);

  // Handle contact type change
  const handleContactTypeChange = (type: Communication['contactType']) => {
    setContactType(type);
    setContactId('');
    setContactName('');
    setContactEmail('');
    
    // If switching to teacher and we have a student selected, try to auto-select their teacher
    if (type === 'teacher' && studentId) {
      const filteredStudents = selectedSchool 
        ? students.filter(s => s.school === selectedSchool)
        : students;
      const selectedStudent = filteredStudents.find(s => s.id === studentId);
      if (selectedStudent?.teacherId) {
        const studentTeacher = teachers.find(t => t.id === selectedStudent.teacherId);
        if (studentTeacher) {
          setContactId(studentTeacher.id);
          setContactName(studentTeacher.name);
          setContactEmail(studentTeacher.emailAddress || '');
        }
      }
    }
  };

  // Handle student selection - auto-select teacher if student has one assigned
  const handleStudentSelect = (id: string) => {
    setStudentId(id);
    
    // If contact type is teacher and student has a teacherId, auto-select that teacher
    if (contactType === 'teacher' && id) {
      const filteredStudents = selectedSchool 
        ? students.filter(s => s.school === selectedSchool)
        : students;
      const selectedStudent = filteredStudents.find(s => s.id === id);
      if (selectedStudent?.teacherId) {
        const studentTeacher = teachers.find(t => t.id === selectedStudent.teacherId);
        if (studentTeacher) {
          setContactId(studentTeacher.id);
          setContactName(studentTeacher.name);
          setContactEmail(studentTeacher.emailAddress || '');
        }
      }
    }
  };

  // Handle contact selection
  const handleContactSelect = (id: string) => {
    let contact: Teacher | CaseManager | undefined;
    
    if (contactType === 'teacher') {
      contact = teachers.find(t => t.id === id);
    } else if (contactType === 'case-manager') {
      contact = caseManagers.find(c => c.id === id);
    }
    
    if (contact) {
      setContactId(contact.id);
      setContactName(contact.name);
      setContactEmail(contact.emailAddress || '');
    }
  };

  // Get available contacts based on type
  const getAvailableContacts = () => {
    if (contactType === 'teacher') {
      return teachers;
    } else if (contactType === 'case-manager') {
      return caseManagers;
    }
    return [];
  };

  const handleCopy = () => {
    const emailText = body || '';
    navigator.clipboard.writeText(emailText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    // Validation
    if (!contactName.trim()) {
      setError('Please enter or select a contact name');
      return;
    }
    if (!contactEmail.trim() && contactType !== 'parent') {
      setError('Please enter or select a contact email address');
      return;
    }
    if (!subject.trim()) {
      setError('Please enter a subject');
      return;
    }
    if (!body.trim()) {
      setError('Please enter email body');
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
      
      // Add signature to email body
      const emailSignature = '\n\nThank you,\nAaron Pope, MS, CCC-SLP\nc. (612) 310-9661';
      const bodyWithSignature = body.trim() + emailSignature;
      
      // Send email
      await api.email.send({
        to: contactEmail,
        subject: subject,
        body: bodyWithSignature,
        fromEmail: emailAddress,
        fromName: userName,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpUser: emailAddress,
        smtpPassword: emailPassword,
      });

      // Automatically log the communication
      try {
        const communicationData: Omit<Communication, 'id' | 'dateCreated'> = {
          studentId: studentId || undefined,
          contactType: contactType,
          contactId: contactId || undefined,
          contactName: contactName,
          contactEmail: contactEmail || undefined,
          subject: subject,
          body: bodyWithSignature,
          method: 'email' as const,
          date: new Date().toISOString(),
          relatedTo: relatedTo || undefined,
        };

        await api.communications.create(communicationData);
      } catch (loggingError: any) {
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
    } catch (err: any) {
      logError('Error sending email', err);
      setError(err.message || 'Failed to send email. Please check your email settings and try again.');
    } finally {
      setSending(false);
    }
  };

  const canSend = contactName.trim() && (contactType === 'parent' || contactEmail.trim()) && subject.trim() && body.trim();

  // Filter students by selected school
  const filteredStudents = selectedSchool 
    ? students.filter(s => s.school === selectedSchool)
    : students;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Send Email</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Contact Type</InputLabel>
            <Select
              value={contactType}
              label="Contact Type"
              onChange={(e) => handleContactTypeChange(e.target.value as Communication['contactType'])}
            >
              <MenuItem value="teacher">Teacher</MenuItem>
              <MenuItem value="parent">Parent</MenuItem>
              <MenuItem value="case-manager">Case Manager</MenuItem>
            </Select>
          </FormControl>

          {/* For teacher emails, show student dropdown first to help select the right teacher */}
          {contactType === 'teacher' && (
            <FormControl fullWidth>
              <InputLabel>Student</InputLabel>
              <Select
                value={studentId}
                label="Student"
                onChange={(e) => handleStudentSelect(e.target.value)}
              >
                <MenuItem value="">Select Student (Optional)</MenuItem>
                {filteredStudents.map((student) => (
                  <MenuItem key={student.id} value={student.id}>
                    {student.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {contactType === 'teacher' && (
            <FormControl fullWidth>
              <InputLabel>Teacher</InputLabel>
              <Select
                value={contactId}
                label="Teacher"
                onChange={(e) => handleContactSelect(e.target.value)}
              >
                <MenuItem value="">Select Teacher</MenuItem>
                {teachers.map((teacher) => (
                  <MenuItem key={teacher.id} value={teacher.id}>
                    {teacher.name} {teacher.emailAddress && `(${teacher.emailAddress})`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {contactType === 'case-manager' && (
            <FormControl fullWidth>
              <InputLabel>Case Manager</InputLabel>
              <Select
                value={contactId}
                label="Case Manager"
                onChange={(e) => handleContactSelect(e.target.value)}
              >
                <MenuItem value="">Select Case Manager</MenuItem>
                {caseManagers.map((cm) => (
                  <MenuItem key={cm.id} value={cm.id}>
                    {cm.name} {cm.emailAddress && `(${cm.emailAddress})`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {(contactType === 'parent' || !contactId) && (
            <>
              <TextField
                fullWidth
                label="Contact Name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
              />
              <TextField
                fullWidth
                label="Contact Email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required={contactType !== 'parent'}
              />
            </>
          )}

          {/* Student dropdown for non-teacher contact types */}
          {contactType !== 'teacher' && (
            <FormControl fullWidth>
              <InputLabel>Student (Optional)</InputLabel>
              <Select
                value={studentId}
                label="Student (Optional)"
                onChange={(e) => setStudentId(e.target.value)}
              >
                <MenuItem value="">No Student</MenuItem>
                {filteredStudents.map((student) => (
                  <MenuItem key={student.id} value={student.id}>
                    {student.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            fullWidth
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />

          <TextField
            fullWidth
            label="Related To (Optional)"
            value={relatedTo}
            onChange={(e) => setRelatedTo(e.target.value)}
            placeholder="e.g., Missed Session, IEP Meeting, etc."
          />

          <TextField
            fullWidth
            multiline
            rows={12}
            label="Email Body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            placeholder="Type your email message here..."
          />

          {copied && (
            <Alert severity="success">Email text copied to clipboard!</Alert>
          )}
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
          onClick={handleCopy}
          startIcon={<ContentCopyIcon />}
          variant="outlined"
          disabled={sending || !body.trim()}
        >
          Copy
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

