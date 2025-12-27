import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Alert,
} from '@mui/material';
import {
  ContentCopy as ContentCopyIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import type { Student, Teacher, ScheduledSession, Session } from '../types';
import { getTeachers, getSessionsBySchool, getSchoolByName } from '../utils/storage-api';
import { getScheduledSessions } from '../utils/storage';
import { format, isBefore, isAfter, addMinutes, parse, isSameDay, startOfDay } from 'date-fns';
import { api } from '../utils/api';

interface EmailTeacherDialogProps {
  open: boolean;
  onClose: () => void;
  student: Student | null;
  sessionDate?: string; // ISO date string of the session
  sessionStartTime?: string; // ISO date string of session start
  sessionEndTime?: string; // ISO date string of session end
}

export const EmailTeacherDialog = ({
  open,
  onClose,
  student,
  sessionDate,
  sessionStartTime,
  sessionEndTime,
}: EmailTeacherDialogProps) => {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [emailText, setEmailText] = useState('');
  const [copied, setCopied] = useState(false);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  useEffect(() => {
    if (open && student) {
      loadTeacherAndGenerateEmail();
    }
  }, [open, student, sessionDate, sessionStartTime, sessionEndTime]);

  // Helper function to parse date string (handles both ISO strings and yyyy-MM-dd format)
  const parseDateString = (dateStr: string): Date => {
    // If it's an ISO string, extract just the date part (yyyy-MM-dd)
    if (dateStr.includes('T')) {
      const datePart = dateStr.split('T')[0];
      return parse(datePart, 'yyyy-MM-dd', new Date());
    }
    // Otherwise, parse as yyyy-MM-dd
    return parse(dateStr, 'yyyy-MM-dd', new Date());
  };

  const formatTimeFromMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
  };

  const loadTeacherAndGenerateEmail = async () => {
    if (!student) return;

    // Load teacher
    let foundTeacher: Teacher | null = null;
    if (student.teacherId) {
      const teachers = await getTeachers();
      foundTeacher = teachers.find(t => t.id === student.teacherId) || null;
    }
    setTeacher(foundTeacher);

    // Calculate missed session duration in minutes
    let missedSessionDurationMinutes = 30; // Default 30 minutes
    if (sessionStartTime && sessionEndTime) {
      const start = new Date(sessionStartTime);
      const end = new Date(sessionEndTime);
      missedSessionDurationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
    } else if (sessionStartTime) {
      // If only start time, try to get duration from scheduled session
      const scheduledSessions = getScheduledSessions(student.school);
      const sessionDate = sessionStartTime ? new Date(sessionStartTime) : new Date();
      const sessionTime = format(sessionDate, 'HH:mm');
      
      // Find matching scheduled session
      const matchingScheduled = scheduledSessions.find(ss => {
        if (ss.startTime === sessionTime) {
          // Check if it matches the day
          const today = sessionDate;
          const dayOfWeek = today.getDay();
          if (ss.recurrencePattern === 'weekly' && ss.dayOfWeek?.includes(dayOfWeek)) {
            return true;
          }
        }
        return false;
      });
      
      if (matchingScheduled?.duration) {
        missedSessionDurationMinutes = matchingScheduled.duration;
      } else if (matchingScheduled?.endTime) {
        const [startH, startM] = matchingScheduled.startTime.split(':').map(Number);
        const [endH, endM] = matchingScheduled.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        missedSessionDurationMinutes = endMinutes - startMinutes;
      }
    }

    // Get available times for today based on open slots
    const today = sessionDate ? new Date(sessionDate) : (sessionStartTime ? new Date(sessionStartTime) : new Date());
    const todayStr = format(today, 'yyyy-MM-dd');
    const todayStart = startOfDay(today);
    
    // Get the missed session start time in minutes
    let missedSessionStartMinutes = 0;
    if (sessionStartTime) {
      const missedSessionDate = new Date(sessionStartTime);
      const missedHour = missedSessionDate.getHours();
      const missedMinute = missedSessionDate.getMinutes();
      missedSessionStartMinutes = missedHour * 60 + missedMinute;
    }
    
    // Get ALL scheduled sessions for the school
    const allScheduledSessions = getScheduledSessions(student.school);
    
    // Get ALL logged sessions for the school (actual completed sessions)
    const allLoggedSessions = await getSessionsBySchool(student.school);
    
    // Filter scheduled sessions for today (ALL students, not just this one)
    const todayScheduledSessions = allScheduledSessions.filter(ss => {
      if (ss.active === false) return false;
      
      if (ss.recurrencePattern === 'weekly' && ss.dayOfWeek) {
        const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
        return ss.dayOfWeek.includes(dayOfWeek);
      } else if (ss.recurrencePattern === 'specific-dates' && ss.specificDates) {
        return ss.specificDates.some(date => date.startsWith(todayStr));
      } else if (ss.recurrencePattern === 'daily') {
        return true;
      } else if (ss.recurrencePattern === 'none') {
        // One-time sessions - check if date matches
        const sessionDate = parseDateString(ss.startDate);
        return isSameDay(sessionDate, today);
      }
      return false;
    });

    // Check if scheduled session dates are within start/end range
    const validScheduledSessions = todayScheduledSessions.filter(ss => {
      const startDate = parseDateString(ss.startDate);
      const endDate = ss.endDate ? parseDateString(ss.endDate) : null;
      const checkDate = new Date(today);
      
      if (isBefore(checkDate, startDate)) return false;
      if (endDate && isAfter(checkDate, endDate)) return false;
      return true;
    });

    // Filter logged sessions for today (ALL students, not just this one)
    // Exclude the missed session itself (if it's already logged)
    const todayLoggedSessions = allLoggedSessions.filter(session => {
      const sessionDate = startOfDay(new Date(session.date));
      const isToday = isSameDay(sessionDate, todayStart);
      
      // Exclude the missed session itself if we have sessionStartTime
      if (sessionStartTime && isToday) {
        const sessionTime = new Date(session.date);
        const missedTime = new Date(sessionStartTime);
        // If times match (within 5 minutes), it's likely the same session
        const timeDiff = Math.abs(sessionTime.getTime() - missedTime.getTime());
        if (timeDiff < 5 * 60 * 1000 && session.studentId === student.id) {
          return false; // Exclude this session
        }
      }
      
      return isToday;
    });

    // Get school hours from school settings
    const school = await getSchoolByName(student.school);
    const schoolHours = {
      start: school?.schoolHours?.startHour ?? 8,
      end: school?.schoolHours?.endHour ?? 17,
    };

    // Build occupied time slots from scheduled sessions (for ALL students, not just this one)
    const occupiedSlotsFromScheduled: Array<{ start: number; end: number }> = validScheduledSessions.map(ss => {
      const [startH, startM] = ss.startTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      
      let endMinutes: number;
      if (ss.endTime) {
        const [endH, endM] = ss.endTime.split(':').map(Number);
        endMinutes = endH * 60 + endM;
      } else if (ss.duration) {
        endMinutes = startMinutes + ss.duration;
      } else {
        endMinutes = startMinutes + 30; // Default 30 minutes
      }
      
      return { start: startMinutes, end: endMinutes };
    });

    // Build occupied time slots from logged sessions (for ALL students, not just this one)
    const occupiedSlotsFromLogged: Array<{ start: number; end: number }> = todayLoggedSessions.map(session => {
      const sessionDate = new Date(session.date);
      const startMinutes = sessionDate.getHours() * 60 + sessionDate.getMinutes();
      
      let endMinutes: number;
      if (session.endTime) {
        const endDate = new Date(session.endTime);
        endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
      } else {
        // Default to 30 minutes if no end time
        endMinutes = startMinutes + 30;
      }
      
      return { start: startMinutes, end: endMinutes };
    });

    // Combine both scheduled and logged sessions, then sort
    const allOccupiedSlots = [...occupiedSlotsFromScheduled, ...occupiedSlotsFromLogged];
    
    // Remove duplicates and merge overlapping slots
    const mergedOccupiedSlots: Array<{ start: number; end: number }> = [];
    allOccupiedSlots.sort((a, b) => a.start - b.start);
    
    for (const slot of allOccupiedSlots) {
      if (mergedOccupiedSlots.length === 0) {
        mergedOccupiedSlots.push(slot);
      } else {
        const lastSlot = mergedOccupiedSlots[mergedOccupiedSlots.length - 1];
        // If this slot overlaps or is adjacent to the last one, merge them
        if (slot.start <= lastSlot.end) {
          lastSlot.end = Math.max(lastSlot.end, slot.end);
        } else {
          mergedOccupiedSlots.push(slot);
        }
      }
    }
    
    const occupiedSlots = mergedOccupiedSlots;

    // Find open time slots that are at least as long as the missed session duration
    const openSlots: string[] = [];
    const workStartMinutes = schoolHours.start * 60; // 8 AM
    const workEndMinutes = schoolHours.end * 60; // 5 PM

    // Helper function to add multiple slots for a gap
    const addSlotsForGap = (gapStart: number, gapEnd: number) => {
      // Only consider slots that start AFTER the missed session time
      const actualGapStart = Math.max(gapStart, missedSessionStartMinutes);
      if (actualGapStart >= gapEnd) return; // No valid slots after missed session
      
      const gapDuration = gapEnd - actualGapStart;
      if (gapDuration < missedSessionDurationMinutes) return;
      
      // Calculate how many slots can fit - show ALL available slots
      const numSlots = Math.floor(gapDuration / missedSessionDurationMinutes);
      
      // Add slots starting from the gap start, spaced by the session duration
      for (let i = 0; i < numSlots; i++) {
        const slotStart = actualGapStart + (i * missedSessionDurationMinutes);
        const slotEnd = slotStart + missedSessionDurationMinutes;
        
        // Make sure the slot doesn't exceed the gap end
        if (slotEnd <= gapEnd) {
          const startTime = formatTimeFromMinutes(slotStart);
          const endTime = formatTimeFromMinutes(slotEnd);
          openSlots.push(`${startTime} - ${endTime}`);
        }
      }
    };

    // Only check gaps AFTER the missed session time
    // Find occupied slots that are relevant (end after missed session start)
    const relevantOccupiedSlots = occupiedSlots.filter(slot => slot.end > missedSessionStartMinutes);
    
    if (relevantOccupiedSlots.length === 0) {
      // No occupied slots after missed session - show all available slots until end of day
      const actualStart = Math.max(missedSessionStartMinutes, workStartMinutes);
      if (actualStart < workEndMinutes) {
        addSlotsForGap(actualStart, workEndMinutes);
      }
    } else {
      // Sort by start time to ensure proper order
      relevantOccupiedSlots.sort((a, b) => a.start - b.start);
      
      // Check gap between missed session and first occupied slot
      const firstOccupiedAfterMissed = relevantOccupiedSlots[0];
      if (firstOccupiedAfterMissed.start > missedSessionStartMinutes) {
        const gapStart = Math.max(missedSessionStartMinutes, workStartMinutes);
        addSlotsForGap(gapStart, firstOccupiedAfterMissed.start);
      }

      // Check gaps between occupied sessions
      for (let i = 0; i < relevantOccupiedSlots.length - 1; i++) {
        const gapStart = relevantOccupiedSlots[i].end;
        const gapEnd = relevantOccupiedSlots[i + 1].start;
        addSlotsForGap(gapStart, gapEnd);
      }

      // Check gap after last occupied session - show all slots until end of day
      const lastEnd = relevantOccupiedSlots[relevantOccupiedSlots.length - 1].end;
      if (lastEnd < workEndMinutes) {
        addSlotsForGap(lastEnd, workEndMinutes);
      }
    }

    setAvailableTimes(openSlots);

    // Generate email text (always generate, even if no teacher)
    generateEmailText(foundTeacher, openSlots);
  };

  const formatTime = (timeStr: string): string => {
    // Convert HH:mm to 12-hour format
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const generateEmailText = (teacher: Teacher | null, times: string[]) => {
    if (!student) return;

    const teacherName = teacher?.name || 'Teacher';
    const studentName = student.name;
    const userName = localStorage.getItem('user_name') || 'Aaron Pope';
    const zoomLink = localStorage.getItem('zoom_link') || '';
    
    // Debug: Log zoom link to help diagnose issues
    if (!zoomLink) {
      console.warn('Zoom link not found in localStorage. Please configure it in Settings.');
    }

    let email = `Dear ${teacherName},\n\n`;
    email += `${studentName} is late for their speech therapy session. Will they be able to attend the session? The zoom link is below.\n\n`;
    
    if (times.length > 0) {
      email += `If not, I have additional openings at these times:\n`;
      times.forEach(time => {
        email += `• ${time}\n`;
      });
      email += `\n`;
    }

    email += `Thank you,\n\n`;
    email += `${userName}\n\n`;
    email += `Zoom link:\n`;
    // Preserve the zoom link formatting - ensure newlines are preserved
    // The zoom link from localStorage should already have newlines as \n characters
    if (zoomLink) {
      email += zoomLink;
    } else {
      email += '[Zoom link not configured. Please add it in Settings.]';
    }

    setEmailText(email);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(emailText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEmail = async () => {
    if (!teacher?.emailAddress) {
      setSendError('No email address found for teacher');
      return;
    }

    const emailAddress = localStorage.getItem('email_address');
    const emailPassword = localStorage.getItem('email_password');

    if (!emailAddress || !emailPassword) {
      setSendError('Email credentials not configured. Please add your Gmail address and App Password in Settings.');
      return;
    }

    setSending(true);
    setSendError(null);
    setSendSuccess(false);

    try {
      const userName = localStorage.getItem('user_name') || 'Aaron Pope';
      const emailSubject = `Speech Therapy Session - ${student?.name || 'Student'}`;
      
      await api.email.send({
        to: teacher.emailAddress,
        subject: emailSubject,
        body: emailText,
        fromEmail: emailAddress,
        fromName: userName,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpUser: emailAddress,
        smtpPassword: emailPassword,
      });

      // Automatically log the communication
      try {
        // Determine if this is related to a missed session
        const relatedTo = sessionDate || sessionStartTime ? 'Missed Session' : undefined;
        
        // Parse date - handle both ISO strings and datetime-local format (YYYY-MM-DDTHH:mm)
        let communicationDate: string;
        if (sessionStartTime) {
          // sessionStartTime is already an ISO string from fromLocalDateTimeString
          communicationDate = sessionStartTime;
        } else if (sessionDate) {
          // sessionDate might be datetime-local format, convert to ISO
          const dateObj = new Date(sessionDate);
          if (isNaN(dateObj.getTime())) {
            // If parsing fails, use current date
            communicationDate = new Date().toISOString();
          } else {
            communicationDate = dateObj.toISOString();
          }
        } else {
          // Use current date/time when email is sent
          communicationDate = new Date().toISOString();
        }

        // Ensure we have all required fields
        if (!student?.id) {
          console.warn('⚠️ No student ID available when logging communication');
        }
        if (!teacher?.id) {
          console.warn('⚠️ No teacher ID available when logging communication');
        }

        // Ensure we have a valid student ID
        if (!student?.id) {
          console.error('❌ Cannot log communication: student is null or has no ID', {
            student,
            studentName: student?.name,
          });
        }

        const communicationData = {
          studentId: student?.id || undefined,
          contactType: 'teacher' as const,
          contactId: teacher.id,
          contactName: teacher.name,
          contactEmail: teacher.emailAddress,
          subject: emailSubject,
          body: emailText,
          method: 'email' as const,
          date: communicationDate,
          relatedTo: relatedTo || undefined,
        };

        // Validate data before sending
        if (!communicationDate) {
          console.error('❌ Communication date is missing!');
        }
        if (!communicationData.contactName) {
          console.error('❌ Contact name is missing!');
        }
        if (!communicationData.subject) {
          console.error('❌ Subject is missing!');
        }

        console.log('📧 Logging communication with data:', {
          ...communicationData,
          body: communicationData.body.substring(0, 50) + '...', // Truncate body for logging
        });
        const result = await api.communications.create(communicationData);
        console.log('✅ Communication logged successfully:', result);
        console.log('📋 Full communication data saved:', communicationData);
      } catch (logError: any) {
        // Don't fail the email send if logging fails, but log the error
        console.error('Failed to log communication:', logError);
        console.error('Error details:', {
          message: logError?.message,
          stack: logError?.stack,
          response: logError?.response,
        });
      }

      setSendSuccess(true);
      setTimeout(() => {
        setSendSuccess(false);
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error('Error sending email:', error);
      setSendError(error.message || 'Failed to send email. Please check your email settings and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Email Teacher
        {teacher ? (
          <Typography variant="body2" color="text.secondary">
            {teacher.name} {teacher.emailAddress && `(${teacher.emailAddress})`}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No teacher assigned - using "Dear Teacher" placeholder
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {!teacher && (
          <Alert severity="info" sx={{ mb: 2 }}>
            No teacher assigned to this student. The email template uses "Dear Teacher" as a placeholder. You can edit it before sending.
          </Alert>
        )}
        {teacher && !teacher.emailAddress && (
          <Alert severity="info" sx={{ mb: 2 }}>
            No email address found for this teacher. You can copy the email text and send it manually.
          </Alert>
        )}
        <TextField
          fullWidth
          multiline
          rows={20}
          value={emailText}
          onChange={(e) => setEmailText(e.target.value)}
          sx={{ mt: 1 }}
        />
        {copied && (
          <Alert severity="success" sx={{ mt: 1 }}>
            Email text copied to clipboard!
          </Alert>
        )}
        {sendSuccess && (
          <Alert severity="success" sx={{ mt: 1 }}>
            Email sent successfully!
          </Alert>
        )}
        {sendError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {sendError}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={sending}>Close</Button>
        <Button
          onClick={handleCopy}
          startIcon={<ContentCopyIcon />}
          variant="outlined"
          disabled={sending}
        >
          Copy
        </Button>
        {teacher?.emailAddress && (
          <Button
            onClick={handleEmail}
            startIcon={<EmailIcon />}
            variant="contained"
            disabled={sending}
          >
            {sending ? 'Sending...' : 'Send Email'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

