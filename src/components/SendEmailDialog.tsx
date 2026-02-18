import { useState, useEffect } from 'react';
import { logError } from '../utils/logger';
import { getErrorMessage } from '../utils/validators';
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
  Autocomplete,
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
  const [ccTeacherId, setCcTeacherId] = useState('');
  const [ccCaseManagerId, setCcCaseManagerId] = useState('');
  const [ccFreeText, setCcFreeText] = useState('');
  const [ccTeacherInputValue, setCcTeacherInputValue] = useState('');
  const [ccCaseManagerInputValue, setCcCaseManagerInputValue] = useState('');
  const [contactInputValue, setContactInputValue] = useState('');
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
      setCcTeacherId('');
      setCcCaseManagerId('');
      setCcFreeText('');
      setCcTeacherInputValue('');
      setCcCaseManagerInputValue('');
      setContactInputValue('');
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
    setContactInputValue('');
    
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
          setContactInputValue(studentTeacher.name);
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
          setContactInputValue(studentTeacher.name);
        }
      }
    }
  };

  // Handle contact selection (from Autocomplete)
  const handleContactSelect = (contact: Teacher | CaseManager | null) => {
    if (!contact) {
      setContactId('');
      setContactName('');
      setContactEmail('');
      setContactInputValue('');
      return;
    }
    setContactId(contact.id);
    setContactName(contact.name);
    setContactEmail(contact.emailAddress || '');
    setContactInputValue(contact.name);
  };

  // Filter teachers by name, email, or grade
  const filterTeacherOptions = (options: Teacher[], inputValue: string) => {
    if (!inputValue.trim()) return options;
    const search = inputValue.toLowerCase().trim();
    return options.filter((t) => {
      const name = (t.name || '').toLowerCase();
      const email = (t.emailAddress || '').toLowerCase();
      const grade = (t.grade || '').toLowerCase();
      return name.includes(search) || email.includes(search) || grade.includes(search);
    });
  };

  // Filter case managers by name, email, or role
  const filterCaseManagerOptions = (options: CaseManager[], inputValue: string) => {
    if (!inputValue.trim()) return options;
    const search = inputValue.toLowerCase().trim();
    return options.filter((cm) => {
      const name = (cm.name || '').toLowerCase();
      const email = (cm.emailAddress || '').toLowerCase();
      const role = (cm.role || '').toLowerCase();
      return name.includes(search) || email.includes(search) || role.includes(search);
    });
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
      const sendPayload: Parameters<typeof api.email.send>[0] = {
        to: contactEmail,
        subject: subject,
        body: bodyWithSignature,
        fromEmail: emailAddress,
        fromName: userName,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpUser: emailAddress,
        smtpPassword: emailPassword,
      };
      // Build CC list: selected teacher, selected case manager, and free-text emails
      const ccEmails: string[] = [];
      if (ccTeacherId) {
        const t = teachers.find((te) => te.id === ccTeacherId);
        if (t?.emailAddress?.trim()) ccEmails.push(t.emailAddress.trim());
      }
      if (ccCaseManagerId) {
        const cm = caseManagers.find((c) => c.id === ccCaseManagerId);
        if (cm?.emailAddress?.trim()) ccEmails.push(cm.emailAddress.trim());
      }
      const freeTextEmails = ccFreeText
        .split(/[\n,]+/)
        .map((e) => e.trim())
        .filter((e) => e.length > 0);
      ccEmails.push(...freeTextEmails);
      if (ccEmails.length > 0) {
        sendPayload.cc = ccEmails;
      }
      // Always BCC the sender so they get a copy of their sent email
      sendPayload.bcc = emailAddress;
      await api.email.send(sendPayload);

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
            <Autocomplete
              fullWidth
              options={teachers}
              getOptionLabel={(option) => option.name}
              filterOptions={(options, state) => filterTeacherOptions(options, state.inputValue)}
              value={teachers.find((t) => t.id === contactId) ?? null}
              inputValue={contactInputValue}
              onInputChange={(_, value) => setContactInputValue(value)}
              onChange={(_, newValue) => handleContactSelect(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Teacher"
                  InputLabelProps={{ shrink: true }}
                />
              )}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  {option.name}
                  {option.emailAddress && (
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      ({option.emailAddress})
                    </Typography>
                  )}
                </li>
              )}
            />
          )}

          {contactType === 'case-manager' && (
            <Autocomplete
              fullWidth
              options={caseManagers}
              getOptionLabel={(option) => option.name}
              filterOptions={(options, state) => filterCaseManagerOptions(options, state.inputValue)}
              value={caseManagers.find((cm) => cm.id === contactId) ?? null}
              inputValue={contactInputValue}
              onInputChange={(_, value) => setContactInputValue(value)}
              onChange={(_, newValue) => handleContactSelect(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Case Manager"
                  InputLabelProps={{ shrink: true }}
                />
              )}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  {option.name}
                  {option.emailAddress && (
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      ({option.emailAddress})
                    </Typography>
                  )}
                </li>
              )}
            />
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

          <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
            CC (Carbon Copy)
          </Typography>
          <Autocomplete
            fullWidth
            options={teachers}
            getOptionLabel={(option) => option.name}
            filterOptions={(options, state) => filterTeacherOptions(options, state.inputValue)}
            value={teachers.find((t) => t.id === ccTeacherId) ?? null}
            inputValue={ccTeacherInputValue}
            onInputChange={(_, value) => setCcTeacherInputValue(value)}
            onChange={(_, newValue) => {
              setCcTeacherId(newValue?.id ?? '');
              setCcTeacherInputValue(newValue?.name ?? '');
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="CC Teacher (Optional)"
                InputLabelProps={{ shrink: true }}
              />
            )}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                {option.name}
                {option.emailAddress && (
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    ({option.emailAddress})
                  </Typography>
                )}
              </li>
            )}
          />
          <Autocomplete
            fullWidth
            options={caseManagers}
            getOptionLabel={(option) => option.name}
            filterOptions={(options, state) => filterCaseManagerOptions(options, state.inputValue)}
            value={caseManagers.find((cm) => cm.id === ccCaseManagerId) ?? null}
            inputValue={ccCaseManagerInputValue}
            onInputChange={(_, value) => setCcCaseManagerInputValue(value)}
            onChange={(_, newValue) => {
              setCcCaseManagerId(newValue?.id ?? '');
              setCcCaseManagerInputValue(newValue?.name ?? '');
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="CC Case Manager (Optional)"
                InputLabelProps={{ shrink: true }}
              />
            )}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                {option.name}
                {option.emailAddress && (
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    ({option.emailAddress})
                  </Typography>
                )}
              </li>
            )}
          />
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="CC Additional Emails (Optional)"
            value={ccFreeText}
            onChange={(e) => setCcFreeText(e.target.value)}
            placeholder="Additional CC emails, one per line or comma-separated"
            disabled={sending}
          />

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

