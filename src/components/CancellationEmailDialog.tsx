import { useState, useEffect } from 'react';
import { logError, logWarn } from '../utils/logger';
import { getErrorMessage } from '../utils/validators';
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
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  ContentCopy as ContentCopyIcon,
  Email as EmailIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import type { Student, Teacher, ScheduledSession, Session } from '../types';
import { getTeachers, getSessionsBySchool, getSchoolByName } from '../utils/storage-api';
import { getScheduledSessions } from '../utils/storage-api';
import { format, isBefore, isAfter, parse, isSameDay, startOfDay } from 'date-fns';
import { api } from '../utils/api';

interface CancellationEmailDialogProps {
  open: boolean;
  onClose: () => void;
  studentIds: string[];
  students: Student[];
  sessionDate: Date;
  sessionTime: string; // HH:mm format
  sessionEndTime?: string; // HH:mm format
}

interface TeacherEmailData {
  teacher: Teacher;
  studentIds: string[]; // Students associated with this teacher
  emailText: string;
}

export const CancellationEmailDialog = ({
  open,
  onClose,
  studentIds,
  students,
  sessionDate,
  sessionTime,
  sessionEndTime,
}: CancellationEmailDialogProps) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherEmails, setTeacherEmails] = useState<TeacherEmailData[]>([]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string[]>([]); // Track which teachers received emails
  const [selectedTeacherIndex, setSelectedTeacherIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open && studentIds.length > 0) {
      loadTeachersAndGenerateEmails().catch((error) => {
        logError('Failed to load teachers and generate emails', error);
      });
    } else if (!open) {
      // Reset states when dialog closes
      setTeacherEmails([]);
      setSendError(null);
      setSendSuccess([]);
      setSelectedTeacherIndex(null);
    }
  }, [open, studentIds, sessionDate, sessionTime, sessionEndTime]);

  const formatTime12Hour = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const formatTimeRange = (startTime: string, endTime?: string): string => {
    const start = formatTime12Hour(startTime);
    if (endTime) {
      const end = formatTime12Hour(endTime);
      return `${start} - ${end}`;
    }
    return start;
  };

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

  const generateEmailText = (teacher: Teacher, associatedStudents: Student[], times: string[] = []): string => {
    const teacherName = teacher?.name || 'Teacher';
    const userName = localStorage.getItem('user_name') || 'Aaron Pope';
    
    // Format student names
    let studentNamesText = '';
    if (associatedStudents.length === 1) {
      studentNamesText = associatedStudents[0].name;
    } else if (associatedStudents.length === 2) {
      studentNamesText = `${associatedStudents[0].name} and ${associatedStudents[1].name}`;
    } else {
      const allButLast = associatedStudents.slice(0, -1).map(s => s.name).join(', ');
      const last = associatedStudents[associatedStudents.length - 1].name;
      studentNamesText = `${allButLast}, and ${last}`;
    }

    const dateStr = format(sessionDate, 'EEEE, MMMM d, yyyy');
    const timeStr = formatTimeRange(sessionTime, sessionEndTime);

    let email = `Dear ${teacherName},\n\n`;
    email += `I am writing to inform you that the speech therapy session scheduled for ${studentNamesText} on ${dateStr} at ${timeStr} has been cancelled.\n\n`;
    
    if (times.length > 0) {
      email += `I have additional openings at these times today:\n`;
      times.forEach(time => {
        email += `• ${time}\n`;
      });
      email += `\n`;
    }
    
    if (associatedStudents.length > 1) {
      email += `I will work with you to reschedule these sessions at a convenient time.\n\n`;
    } else {
      email += `I will work with you to reschedule this session at a convenient time.\n\n`;
    }

    email += `Thank you,\n${userName}, MS, CCC-SLP\nc. (612) 310-9661`;

    return email;
  };

  const findAvailableTimes = async (): Promise<string[]> => {
    if (studentIds.length === 0) return [];

    // Use the first student's school for finding available times
    const primaryStudent = students.find(s => studentIds.includes(s.id));
    if (!primaryStudent) return [];

    // Calculate cancelled session duration in minutes
    let cancelledSessionDurationMinutes = 30; // Default 30 minutes
    if (sessionTime && sessionEndTime) {
      const [startH, startM] = sessionTime.split(':').map(Number);
      const [endH, endM] = sessionEndTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      cancelledSessionDurationMinutes = endMinutes - startMinutes;
    } else if (sessionTime) {
      // Try to get duration from scheduled session
      const scheduledSessions = await getScheduledSessions(primaryStudent.school);
      const sessionTimeStr = sessionTime;
      
      // Find matching scheduled session
      const matchingScheduled = scheduledSessions.find(ss => {
        if (ss.startTime === sessionTimeStr) {
          const today = sessionDate;
          const dayOfWeek = today.getDay();
          if (ss.recurrencePattern === 'weekly' && ss.dayOfWeek?.includes(dayOfWeek)) {
            return true;
          }
        }
        return false;
      });
      
      if (matchingScheduled?.duration) {
        cancelledSessionDurationMinutes = matchingScheduled.duration;
      } else if (matchingScheduled?.endTime) {
        const [startH, startM] = matchingScheduled.startTime.split(':').map(Number);
        const [endH, endM] = matchingScheduled.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        cancelledSessionDurationMinutes = endMinutes - startMinutes;
      }
    }

    // Parse dates in local time to avoid timezone issues
    const todayStart = startOfDay(sessionDate);
    const today = todayStart;
    const todayStr = format(today, 'yyyy-MM-dd');
    
    // Get the cancelled session start time in minutes
    let cancelledSessionStartMinutes = 0;
    if (sessionTime) {
      const [hours, minutes] = sessionTime.split(':').map(Number);
      cancelledSessionStartMinutes = hours * 60 + minutes;
    }
    
    // Get ALL scheduled sessions for the school
    const allScheduledSessions = await getScheduledSessions(primaryStudent.school);
    
    // Get ALL logged sessions for the school (actual completed sessions)
    const allLoggedSessions = await getSessionsBySchool(primaryStudent.school);
    
    // Filter scheduled sessions for today
    const todayScheduledSessions = allScheduledSessions.filter(ss => {
      if (ss.active === false) return false;
      if (ss.cancelledDates && ss.cancelledDates.includes(todayStr)) return false;
      
      let matchesPattern = false;
      if (ss.recurrencePattern === 'weekly' && ss.dayOfWeek) {
        const dayOfWeek = todayStart.getDay();
        matchesPattern = ss.dayOfWeek.includes(dayOfWeek);
      } else if (ss.recurrencePattern === 'specific-dates' && ss.specificDates) {
        matchesPattern = ss.specificDates.some(date => {
          const datePart = date.includes('T') ? date.split('T')[0] : date;
          return datePart === todayStr;
        });
      } else if (ss.recurrencePattern === 'daily') {
        matchesPattern = true;
      } else if (ss.recurrencePattern === 'none') {
        matchesPattern = isSameDay(parseDateString(ss.startDate), today);
      }
      
      if (!matchesPattern) return false;
      
      const startDate = parseDateString(ss.startDate);
      const endDate = ss.endDate ? parseDateString(ss.endDate) : null;
      if (isBefore(today, startDate) && !isSameDay(today, startDate)) return false;
      if (endDate && isAfter(today, endDate) && !isSameDay(today, endDate)) return false;
      
      return true;
    });

    // Exclude the cancelled session itself
    const validScheduledSessions = todayScheduledSessions.filter(ss => {
      const startDate = parseDateString(ss.startDate);
      const endDate = ss.endDate ? parseDateString(ss.endDate) : null;
      if (isBefore(today, startDate) && !isSameDay(today, startDate)) return false;
      if (endDate && isAfter(today, endDate) && !isSameDay(today, endDate)) return false;
      
      // Exclude the cancelled session
      if (sessionTime && studentIds.some(id => ss.studentIds.includes(id))) {
        const [ssStartH, ssStartM] = ss.startTime.split(':').map(Number);
        const [cancelledH, cancelledM] = sessionTime.split(':').map(Number);
        if (ssStartH === cancelledH && Math.abs(ssStartM - cancelledM) < 5) {
          return false;
        }
      }
      
      return true;
    });

    // Filter logged sessions for today
    const todayLoggedSessions = allLoggedSessions.filter(session => {
      const sessionDate = startOfDay(new Date(session.date));
      return isSameDay(sessionDate, todayStart);
    });

    // Get school hours
    const school = await getSchoolByName(primaryStudent.school);
    const schoolHours = {
      start: school?.schoolHours?.startHour ?? 8,
      end: school?.schoolHours?.endHour ?? 17,
    };

    // Build occupied time slots
    const occupiedSlotsFromScheduled = validScheduledSessions.map(ss => {
      const [startH, startM] = ss.startTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      let endMinutes: number;
      if (ss.endTime) {
        const [endH, endM] = ss.endTime.split(':').map(Number);
        endMinutes = endH * 60 + endM;
      } else if (ss.duration) {
        endMinutes = startMinutes + ss.duration;
      } else {
        endMinutes = startMinutes + 30;
      }
      return { start: startMinutes, end: endMinutes };
    });

    const occupiedSlotsFromLogged = todayLoggedSessions.map(session => {
      const sessionDate = new Date(session.date);
      const startMinutes = sessionDate.getHours() * 60 + sessionDate.getMinutes();
      let endMinutes: number;
      if (session.endTime) {
        const endDate = new Date(session.endTime);
        endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
      } else {
        endMinutes = startMinutes + 30;
      }
      return { start: startMinutes, end: endMinutes };
    });

    // Merge occupied slots
    const allOccupiedSlots = [...occupiedSlotsFromScheduled, ...occupiedSlotsFromLogged];
    const mergedOccupiedSlots: Array<{ start: number; end: number }> = [];
    allOccupiedSlots.sort((a, b) => a.start - b.start);
    
    for (const slot of allOccupiedSlots) {
      if (mergedOccupiedSlots.length === 0) {
        mergedOccupiedSlots.push(slot);
      } else {
        const lastSlot = mergedOccupiedSlots[mergedOccupiedSlots.length - 1];
        if (slot.start <= lastSlot.end) {
          lastSlot.end = Math.max(lastSlot.end, slot.end);
        } else {
          mergedOccupiedSlots.push(slot);
        }
      }
    }

    const occupiedSlots = mergedOccupiedSlots;
    const openSlots: string[] = [];
    const workStartMinutes = schoolHours.start * 60;
    const workEndMinutes = schoolHours.end * 60;

    // Get current time
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const isToday = isSameDay(today, startOfDay(now));
    
    const cancelledSessionEndMinutes = cancelledSessionStartMinutes + cancelledSessionDurationMinutes;
    const earliestStartMinutes = isToday ? Math.max(cancelledSessionEndMinutes, currentMinutes) : cancelledSessionEndMinutes;
    let actualEarliestStart = earliestStartMinutes;
    
    if (isToday) {
      actualEarliestStart = Math.max(actualEarliestStart, currentMinutes);
      const currentOccupiedSlot = occupiedSlots.find(slot => 
        slot.start <= currentMinutes && slot.end > currentMinutes
      );
      if (currentOccupiedSlot) {
        actualEarliestStart = Math.max(currentOccupiedSlot.end, actualEarliestStart);
      }
    }

    const addSlotsForGap = (gapStart: number, gapEnd: number) => {
      const cappedGapEnd = Math.min(gapEnd, workEndMinutes);
      const actualGapStart = Math.max(gapStart, actualEarliestStart);
      if (actualGapStart >= cappedGapEnd) return;
      const gapDuration = cappedGapEnd - actualGapStart;
      if (gapDuration < cancelledSessionDurationMinutes) return;
      const startTime = formatTimeFromMinutes(actualGapStart);
      const endTime = formatTimeFromMinutes(cappedGapEnd);
      openSlots.push(`${startTime} - ${endTime}`);
    };

    const relevantOccupiedSlots = occupiedSlots.filter(slot => {
      if (isToday) {
        return slot.end > actualEarliestStart || 
               (slot.start <= currentMinutes && slot.end > currentMinutes) ||
               (slot.start < currentMinutes && slot.end > currentMinutes);
      }
      return slot.end > actualEarliestStart;
    });

    if (relevantOccupiedSlots.length === 0) {
      const gapStart = Math.max(actualEarliestStart, workStartMinutes);
      if (gapStart < workEndMinutes) {
        addSlotsForGap(gapStart, workEndMinutes);
      }
    } else {
      relevantOccupiedSlots.sort((a, b) => a.start - b.start);
      const firstOccupiedSlot = relevantOccupiedSlots[0];
      if (firstOccupiedSlot.start > actualEarliestStart) {
        const gapStart = Math.max(actualEarliestStart, workStartMinutes);
        addSlotsForGap(gapStart, firstOccupiedSlot.start);
      }
      for (let i = 0; i < relevantOccupiedSlots.length - 1; i++) {
        const gapStart = relevantOccupiedSlots[i].end;
        const gapEnd = Math.min(relevantOccupiedSlots[i + 1].start, workEndMinutes);
        if (gapStart >= actualEarliestStart && gapStart < gapEnd) {
          addSlotsForGap(gapStart, gapEnd);
        }
      }
      const lastSlot = relevantOccupiedSlots[relevantOccupiedSlots.length - 1];
      if (lastSlot.end >= actualEarliestStart && lastSlot.end < workEndMinutes) {
        addSlotsForGap(lastSlot.end, workEndMinutes);
      }
    }

    // Verify slots don't overlap
    const verifiedOpenSlots = openSlots.filter(slotStr => {
      const [startStr, endStr] = slotStr.split(' - ');
      if (!startStr || !endStr) return false;
      
      const parseTimeStr = (timeStr: string): number => {
        const trimmed = timeStr.trim();
        const [time, period] = trimmed.split(' ');
        const [hours, minutes] = time.split(':').map(Number);
        let hour24 = hours;
        if (period === 'PM' && hours !== 12) hour24 = hours + 12;
        if (period === 'AM' && hours === 12) hour24 = 0;
        return hour24 * 60 + minutes;
      };
      
      const slotStart = parseTimeStr(startStr);
      const slotEnd = parseTimeStr(endStr);
      const earliestAllowedStart = isToday ? Math.max(actualEarliestStart, currentMinutes) : actualEarliestStart;
      if (slotStart < earliestAllowedStart) return false;
      
      const overlaps = occupiedSlots.some(occupied => {
        return slotStart < occupied.end && slotEnd > occupied.start;
      });
      
      return !overlaps;
    });
    
    return verifiedOpenSlots;
  };

  const loadTeachersAndGenerateEmails = async () => {
    if (studentIds.length === 0) return;

    // Find available times first
    const availableTimesList = await findAvailableTimes();
    setAvailableTimes(availableTimesList);

    // Get all teachers
    const allTeachers = await getTeachers();
    setTeachers(allTeachers);

    // Group students by teacher
    const teacherMap = new Map<string, { teacher: Teacher; studentIds: string[] }>();
    const studentsWithoutTeacher: string[] = [];

    for (const studentId of studentIds) {
      const student = students.find(s => s.id === studentId);
      if (!student) continue;

      if (student.teacherId) {
        const teacher = allTeachers.find(t => t.id === student.teacherId);
        if (teacher) {
          const existing = teacherMap.get(teacher.id);
          if (existing) {
            existing.studentIds.push(studentId);
          } else {
            teacherMap.set(teacher.id, { teacher, studentIds: [studentId] });
          }
        } else {
          studentsWithoutTeacher.push(studentId);
        }
      } else {
        studentsWithoutTeacher.push(studentId);
      }
    }

    // Create a "No Teacher" entry for students without teachers
    if (studentsWithoutTeacher.length > 0) {
      const noTeacher: Teacher = {
        id: 'no-teacher',
        name: 'Teacher',
        grade: '',
        school: students.find(s => studentsWithoutTeacher.includes(s.id))?.school || '',
        dateCreated: new Date().toISOString(),
      };
      teacherMap.set('no-teacher', { teacher: noTeacher, studentIds: studentsWithoutTeacher });
    }

    // Generate email for each teacher
    const emails: TeacherEmailData[] = [];
    for (const [_, { teacher, studentIds: associatedStudentIds }] of teacherMap) {
      const associatedStudents = associatedStudentIds
        .map(id => students.find(s => s.id === id))
        .filter((s): s is Student => s !== undefined);
      
      const emailText = generateEmailText(teacher, associatedStudents, availableTimesList);
      emails.push({
        teacher,
        studentIds: associatedStudentIds,
        emailText,
      });
    }

    setTeacherEmails(emails);
    
    // Auto-select first teacher if available
    if (emails.length > 0) {
      setSelectedTeacherIndex(0);
    }
  };

  const handleCopy = (index: number) => {
    if (teacherEmails[index]) {
      navigator.clipboard.writeText(teacherEmails[index].emailText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEmail = async (index: number) => {
    const emailData = teacherEmails[index];
    if (!emailData) return;

    if (!emailData.teacher.emailAddress) {
      setSendError(`No email address found for ${emailData.teacher.name}`);
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

    try {
      const userName = localStorage.getItem('user_name') || 'Aaron Pope';
      const dateStr = format(sessionDate, 'MMMM d, yyyy');
      const associatedStudents = emailData.studentIds
        .map(id => students.find(s => s.id === id))
        .filter((s): s is Student => s !== undefined);
      
      const studentNames = associatedStudents.length === 1
        ? associatedStudents[0].name
        : associatedStudents.map(s => s.name).join(', ');
      
      const emailSubject = `Speech Therapy Session Cancellation - ${dateStr}`;
      
      await api.email.send({
        to: emailData.teacher.emailAddress,
        subject: emailSubject,
        body: emailData.emailText,
        fromEmail: emailAddress,
        fromName: userName,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpUser: emailAddress,
        smtpPassword: emailPassword,
      });

      // Log communication for each student
      try {
        for (const studentId of emailData.studentIds) {
          const student = students.find(s => s.id === studentId);
          if (!student) continue;

          const communicationData = {
            studentId: student.id,
            contactType: 'teacher' as const,
            contactId: emailData.teacher.id !== 'no-teacher' ? emailData.teacher.id : undefined,
            contactName: emailData.teacher.name,
            contactEmail: emailData.teacher.emailAddress || undefined,
            subject: emailSubject,
            body: emailData.emailText,
            method: 'email' as const,
            date: new Date().toISOString(),
            relatedTo: 'Session Cancellation',
          };

          await api.communications.create(communicationData);
        }
      } catch (loggingError: unknown) {
        logError('Failed to log communication', loggingError);
      }

      setSendSuccess([...sendSuccess, emailData.teacher.id]);
      setTimeout(() => {
        // If all teachers have been emailed, close the dialog
        if (sendSuccess.length + 1 >= teacherEmails.filter(e => e.teacher.emailAddress).length) {
          setTimeout(() => {
            onClose();
          }, 2000);
        }
      }, 100);
    } catch (error: unknown) {
      logError('Error sending email', error);
      setSendError(getErrorMessage(error) || 'Failed to send email. Please check your email settings and try again.');
    } finally {
      setSending(false);
    }
  };

  const handleSendAll = async () => {
    const teachersWithEmail = teacherEmails.filter(e => e.teacher.emailAddress && !sendSuccess.includes(e.teacher.id));
    if (teachersWithEmail.length === 0) {
      setSendError('No teachers have email addresses configured or all emails have been sent.');
      return;
    }

    setSending(true);
    setSendError(null);

    const errors: string[] = [];
    const successes: string[] = [];

    for (const emailData of teachersWithEmail) {
      const index = teacherEmails.indexOf(emailData);
      if (index === -1) continue;

      try {
        const emailAddress = localStorage.getItem('email_address');
        const emailPassword = localStorage.getItem('email_password');

        if (!emailAddress || !emailPassword) {
          errors.push(`${emailData.teacher.name} (credentials not configured)`);
          continue;
        }

        const userName = localStorage.getItem('user_name') || 'Aaron Pope';
        const dateStr = format(sessionDate, 'MMMM d, yyyy');
        const emailSubject = `Speech Therapy Session Cancellation - ${dateStr}`;
        
        await api.email.send({
          to: emailData.teacher.emailAddress!,
          subject: emailSubject,
          body: emailData.emailText,
          fromEmail: emailAddress,
          fromName: userName,
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpUser: emailAddress,
          smtpPassword: emailPassword,
        });

        // Log communication for each student
        try {
          for (const studentId of emailData.studentIds) {
            const student = students.find(s => s.id === studentId);
            if (!student) continue;

            const communicationData = {
              studentId: student.id,
              contactType: 'teacher' as const,
              contactId: emailData.teacher.id !== 'no-teacher' ? emailData.teacher.id : undefined,
              contactName: emailData.teacher.name,
              contactEmail: emailData.teacher.emailAddress || undefined,
              subject: emailSubject,
              body: emailData.emailText,
              method: 'email' as const,
              date: new Date().toISOString(),
              relatedTo: 'Session Cancellation',
            };

            await api.communications.create(communicationData);
          }
        } catch (loggingError: unknown) {
          logError('Failed to log communication', loggingError);
        }

        successes.push(emailData.teacher.id);
      } catch (error) {
        errors.push(emailData.teacher.name);
        logError(`Failed to send email to ${emailData.teacher.name}`, error);
      }
    }

    setSending(false);
    setSendSuccess([...sendSuccess, ...successes]);

    if (errors.length > 0) {
      setSendError(`Failed to send emails to: ${errors.join(', ')}`);
    }

    if (successes.length === teachersWithEmail.length) {
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  };

  const currentEmail = selectedTeacherIndex !== null ? teacherEmails[selectedTeacherIndex] : null;
  const associatedStudentsForCurrent = currentEmail
    ? currentEmail.studentIds.map(id => students.find(s => s.id === id)).filter((s): s is Student => s !== undefined)
    : [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Send Cancellation Email</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Session: {format(sessionDate, 'MMMM d, yyyy')} at {formatTimeRange(sessionTime, sessionEndTime)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Students: {students.filter(s => studentIds.includes(s.id)).map(s => s.name).join(', ')}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {teacherEmails.length === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Loading teacher information...
          </Alert>
        )}

        {teacherEmails.length > 0 && (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Teachers ({teacherEmails.length})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {teacherEmails.map((emailData, index) => {
                  const associatedStudents = emailData.studentIds
                    .map(id => students.find(s => s.id === id))
                    .filter((s): s is Student => s !== undefined);
                  const studentNames = associatedStudents.map(s => s.name).join(', ');
                  const isSelected = selectedTeacherIndex === index;
                  const isSent = sendSuccess.includes(emailData.teacher.id);
                  
                  return (
                    <Chip
                      key={emailData.teacher.id}
                      label={`${emailData.teacher.name}${emailData.teacher.id === 'no-teacher' ? ' (No teacher assigned)' : ''}${isSent ? ' ✓' : ''}`}
                      onClick={() => setSelectedTeacherIndex(index)}
                      color={isSelected ? 'primary' : 'default'}
                      variant={isSelected ? 'filled' : 'outlined'}
                      sx={{ cursor: 'pointer' }}
                    />
                  );
                })}
              </Box>
            </Box>

            {currentEmail && (
              <>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Students for {currentEmail.teacher.name}:
                  </Typography>
                  <List dense>
                    {associatedStudentsForCurrent.map(student => (
                      <ListItem key={student.id}>
                        <ListItemText primary={student.name} secondary={student.grade ? `Grade ${student.grade}` : ''} />
                      </ListItem>
                    ))}
                  </List>
                </Box>

                <Divider sx={{ my: 2 }} />

                {!currentEmail.teacher.emailAddress && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No email address found for {currentEmail.teacher.name}. You can copy the email text and send it manually.
                  </Alert>
                )}

                <TextField
                  fullWidth
                  multiline
                  rows={15}
                  value={currentEmail.emailText}
                  onChange={(e) => {
                    const updated = [...teacherEmails];
                    updated[selectedTeacherIndex!].emailText = e.target.value;
                    setTeacherEmails(updated);
                  }}
                  sx={{ mt: 1 }}
                />

                {copied && (
                  <Alert severity="success" sx={{ mt: 1 }}>
                    Email text copied to clipboard!
                  </Alert>
                )}
                {sendSuccess.includes(currentEmail.teacher.id) && (
                  <Alert severity="success" sx={{ mt: 1 }}>
                    Email sent successfully to {currentEmail.teacher.name}!
                  </Alert>
                )}
                {sendError && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    {sendError}
                  </Alert>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={sending}>Close</Button>
        {currentEmail && (
          <>
            <Button
              onClick={() => handleCopy(selectedTeacherIndex!)}
              startIcon={<ContentCopyIcon />}
              variant="outlined"
              disabled={sending}
            >
              Copy
            </Button>
            {currentEmail.teacher.emailAddress && (
              <Button
                onClick={() => handleEmail(selectedTeacherIndex!)}
                startIcon={<EmailIcon />}
                variant="contained"
                disabled={sending || sendSuccess.includes(currentEmail.teacher.id)}
              >
                {sending ? 'Sending...' : sendSuccess.includes(currentEmail.teacher.id) ? 'Sent' : 'Send Email'}
              </Button>
            )}
          </>
        )}
        {teacherEmails.filter(e => e.teacher.emailAddress && !sendSuccess.includes(e.teacher.id)).length > 1 && (
          <Button
            onClick={handleSendAll}
            startIcon={<EmailIcon />}
            variant="contained"
            color="secondary"
            disabled={sending}
          >
            {sending ? 'Sending All...' : `Send All (${teacherEmails.filter(e => e.teacher.emailAddress && !sendSuccess.includes(e.teacher.id)).length})`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

