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
import type { Student, Teacher, CaseManager, ScheduledSession, Session } from '../types';
import { getTeachers, getCaseManagers, getSessionsBySchool, getSchoolByName } from '../utils/storage-api';
import { getScheduledSessions } from '../utils/storage-api';
import { format, isBefore, isAfter, addMinutes, parse, isSameDay, startOfDay } from 'date-fns';
import { api } from '../utils/api';

interface EmailTeacherDialogProps {
  open: boolean;
  onClose: () => void;
  student: Student | null; // For backward compatibility - if provided, use this
  students?: Student[]; // For multiple students support
  studentIds?: string[]; // Alternative: provide student IDs
  sessionDate?: string; // ISO date string of the session
  sessionStartTime?: string; // ISO date string of session start
  sessionEndTime?: string; // ISO date string of session end
}

export const EmailTeacherDialog = ({
  open,
  onClose,
  student,
  students: studentsProp,
  studentIds,
  sessionDate,
  sessionStartTime,
  sessionEndTime,
}: EmailTeacherDialogProps) => {
  // Determine which students to use
  const studentsToUse = studentsProp || (student ? [student] : []);

  interface TeacherEmailData {
    teacher: Teacher | CaseManager; // Can be either teacher or case manager
    studentIds: string[]; // Students associated with this teacher/case manager
    emailText: string;
  }

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [caseManagers, setCaseManagers] = useState<CaseManager[]>([]);
  const [teacherEmails, setTeacherEmails] = useState<TeacherEmailData[]>([]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string[]>([]); // Track which teachers received emails
  const [selectedTeacherIndex, setSelectedTeacherIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open && studentsToUse.length > 0) {
      // Reset states when dialog opens
      setTeacherEmails([]);
      setAvailableTimes([]);
      setSendError(null);
      setSendSuccess([]);
      setSelectedTeacherIndex(null);
      
      loadTeachersAndGenerateEmails().catch((error) => {
        logError('Failed to load teachers and generate emails', error);
      });
    } else if (!open) {
      // Reset states when dialog closes
      setTeacherEmails([]);
      setAvailableTimes([]);
      setSelectedTeacherIndex(null);
    }
  }, [open, student, studentsProp, studentIds, sessionDate, sessionStartTime, sessionEndTime]);

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

  const generateEmailText = (teacher: Teacher | CaseManager | null, associatedStudents: Student[], times: string[] = []): string => {
    if (associatedStudents.length === 0) return '';

    const teacherName = teacher?.name || 'Teacher';
    const userName = localStorage.getItem('user_name') || 'Aaron Pope';
    const zoomLink = localStorage.getItem('zoom_link') || '';
    
    // Debug: Log zoom link to help diagnose issues
    if (!zoomLink) {
      logWarn('Zoom link not found in localStorage. Please configure it in Settings.');
    }

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

    let email = `Dear ${teacherName},\n\n`;
    if (associatedStudents.length === 1) {
      email += `${studentNamesText} is late for their scheduled speech therapy session. Will they be able to attend the session? The zoom link is below.\n\n`;
    } else {
      email += `${studentNamesText} are late for their scheduled speech therapy session. Will they be able to attend the session? The zoom link is below.\n\n`;
    }
    
    if (times.length > 0) {
      email += `If not, I have additional openings at these times:\n`;
      times.forEach(time => {
        email += `• ${time}\n`;
      });
      email += `\n`;
    }

    email += `Zoom link:\n`;
    // Preserve the zoom link formatting - ensure newlines are preserved
    // The zoom link from localStorage should already have newlines as \n characters
    if (zoomLink) {
      email += zoomLink;
    } else {
      email += '[Zoom link not configured. Please add it in Settings.]';
    }

    email += `\n\nThank you,\n${userName}, MS, CCC-SLP\nc. (612) 310-9661`;

    return email;
  };

  const loadTeachersAndGenerateEmails = async () => {
    if (studentsToUse.length === 0) return;

    // Find available times first (using first student's school)
    const primaryStudent = studentsToUse[0];
    const availableTimesList = await findAvailableTimes(primaryStudent);
    setAvailableTimes(availableTimesList);

    // Get all teachers and case managers
    const allTeachers = await getTeachers();
    setTeachers(allTeachers);
    
    // Get case managers for the school (use first student's school)
    const schoolCaseManagers = await getCaseManagers(primaryStudent.school);
    setCaseManagers(schoolCaseManagers);

    // Group students by teacher or case manager
    const teacherMap = new Map<string, { teacher: Teacher | CaseManager; studentIds: string[] }>();
    const studentsWithoutContact: string[] = [];

    for (const student of studentsToUse) {
      let contact: Teacher | CaseManager | null = null;
      
      // First, check for teacher
      if (student.teacherId) {
        contact = allTeachers.find(t => t.id === student.teacherId) || null;
      }
      
      // If no teacher, check for case manager
      if (!contact && student.caseManagerId) {
        contact = schoolCaseManagers.find(cm => cm.id === student.caseManagerId) || null;
      }
      
      if (contact) {
        const existing = teacherMap.get(contact.id);
        if (existing) {
          existing.studentIds.push(student.id);
        } else {
          teacherMap.set(contact.id, { teacher: contact, studentIds: [student.id] });
        }
      } else {
        studentsWithoutContact.push(student.id);
      }
    }

    // Create a "No Teacher" entry for students without teachers or case managers
    if (studentsWithoutContact.length > 0) {
      const noTeacher: Teacher = {
        id: 'no-teacher',
        name: 'Teacher',
        grade: '',
        school: studentsToUse[0]?.school || '',
        dateCreated: new Date().toISOString(),
      };
      teacherMap.set('no-teacher', { teacher: noTeacher, studentIds: studentsWithoutContact });
    }

    // Generate email for each teacher
    const emails: TeacherEmailData[] = [];
    for (const [_, { teacher, studentIds: associatedStudentIds }] of teacherMap) {
      const associatedStudents = associatedStudentIds
        .map(id => studentsToUse.find(s => s.id === id))
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

  const findAvailableTimes = async (primaryStudent: Student): Promise<string[]> => {
    if (studentsToUse.length === 0) return [];

    // Calculate missed session duration in minutes
    let missedSessionDurationMinutes = 30; // Default 30 minutes
    if (sessionStartTime && sessionEndTime) {
      const start = new Date(sessionStartTime);
      const end = new Date(sessionEndTime);
      missedSessionDurationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
    } else if (sessionStartTime) {
      // If only start time, try to get duration from scheduled session
      const scheduledSessions = await getScheduledSessions(primaryStudent.school);
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
    // Important: Parse dates in local time to avoid timezone issues
    let todayRaw: Date;
    if (sessionDate) {
      // Parse as local date (yyyy-MM-dd format)
      todayRaw = parseDateString(sessionDate);
    } else if (sessionStartTime) {
      // Parse the start time and extract just the date part
      const dateStr = sessionStartTime.includes('T') ? sessionStartTime.split('T')[0] : sessionStartTime;
      todayRaw = parseDateString(dateStr);
    } else {
      todayRaw = new Date(); // Use current date
    }
    const todayStart = startOfDay(todayRaw); // Normalize to start of day in local time
    const today = todayStart; // Use normalized date for all comparisons
    const todayStr = format(today, 'yyyy-MM-dd');
    
    // Get the missed session start time in minutes
    let missedSessionStartMinutes = 0;
    if (sessionStartTime) {
      const missedSessionDate = new Date(sessionStartTime);
      const missedHour = missedSessionDate.getHours();
      const missedMinute = missedSessionDate.getMinutes();
      missedSessionStartMinutes = missedHour * 60 + missedMinute;
    }
    
    // Get ALL scheduled sessions for the school
    const allScheduledSessions = await getScheduledSessions(primaryStudent.school);
    
    // Get ALL logged sessions for the school (actual completed sessions)
    const allLoggedSessions = await getSessionsBySchool(primaryStudent.school);
    
    // Filter scheduled sessions for today (ALL students, not just this one)
    const todayScheduledSessions = allScheduledSessions.filter(ss => {
      if (ss.active === false) {
        return false;
      }
      
      // Check if this date is cancelled for this scheduled session
      if (ss.cancelledDates && ss.cancelledDates.includes(todayStr)) {
        return false;
      }
      
      // First check if today matches the recurrence pattern
      let matchesPattern = false;
      
      if (ss.recurrencePattern === 'weekly' && ss.dayOfWeek) {
        const dayOfWeek = todayStart.getDay(); // 0 = Sunday, 6 = Saturday (use startOfDay for correct local day)
        matchesPattern = ss.dayOfWeek.includes(dayOfWeek);
      } else if (ss.recurrencePattern === 'specific-dates' && ss.specificDates) {
        matchesPattern = ss.specificDates.some(date => {
          const datePart = date.includes('T') ? date.split('T')[0] : date;
          return datePart === todayStr;
        });
      } else if (ss.recurrencePattern === 'daily') {
        matchesPattern = true;
      } else if (ss.recurrencePattern === 'none') {
        // One-time sessions - check if date matches
        matchesPattern = isSameDay(parseDateString(ss.startDate), today);
      }
      
      if (!matchesPattern) {
        return false;
      }
      
      // Now check if the scheduled session date range includes today
      // This check happens AFTER pattern matching to ensure recurring sessions work correctly
      const startDate = parseDateString(ss.startDate);
      const endDate = ss.endDate ? parseDateString(ss.endDate) : null;
      
      // Check if today is before the start date (excluding same day)
      if (isBefore(today, startDate) && !isSameDay(today, startDate)) {
        return false;
      }
      
      // Check if today is after the end date (excluding same day)
      if (endDate && isAfter(today, endDate) && !isSameDay(today, endDate)) {
        return false;
      }
      
      return true;
    });

    // Check if scheduled session dates are within start/end range
    // Also exclude the scheduled session that matches this missed session (if we have sessionStartTime)
    const validScheduledSessions = todayScheduledSessions.filter(ss => {
      const startDate = parseDateString(ss.startDate);
      const endDate = ss.endDate ? parseDateString(ss.endDate) : null;
      
      // Check if today is before the start date (but allow same day)
      if (isBefore(today, startDate) && !isSameDay(today, startDate)) {
        return false;
      }
      
      // Check if today is after the end date (but allow same day if end date exists)
      if (endDate && isAfter(today, endDate) && !isSameDay(today, endDate)) {
        return false;
      }
      
      // Exclude the scheduled session that matches the missed session time and students
      // This prevents the missed session's scheduled slot from blocking reschedule times
      if (sessionStartTime && studentsToUse.some(s => ss.studentIds.includes(s.id))) {
        const [ssStartH, ssStartM] = ss.startTime.split(':').map(Number);
        const missedDate = new Date(sessionStartTime);
        const missedH = missedDate.getHours();
        const missedM = missedDate.getMinutes();
        
        // If the scheduled session time matches the missed session time (within a few minutes), exclude it
        if (ssStartH === missedH && Math.abs(ssStartM - missedM) < 5) {
          return false;
        }
      }
      
      return true;
    });

    // Filter logged sessions for today (ALL students, not just this one)
    // Exclude the missed session itself (if it's already logged)
    const todayLoggedSessions = allLoggedSessions.filter(session => {
      const sessionDate = startOfDay(new Date(session.date));
      const isToday = isSameDay(sessionDate, todayStart);
      
      if (!isToday) return false;
      
      // Exclude the missed session itself if we have sessionStartTime
      // Also exclude missed sessions that match the missed session time (to avoid blocking reschedule times)
      if (sessionStartTime) {
        const sessionTime = new Date(session.date);
        const missedTime = new Date(sessionStartTime);
        // If times match (within 5 minutes), it's likely the same session
        const timeDiff = Math.abs(sessionTime.getTime() - missedTime.getTime());
        if (timeDiff < 5 * 60 * 1000 && studentsToUse.some(s => session.studentId === s.id) && session.missedSession) {
          return false; // Exclude this missed session
        }
      }
      
      return true;
    });

    // Get school hours from school settings
    const school = await getSchoolByName(primaryStudent.school);
    const schoolHours = {
      start: school?.schoolHours?.startHour ?? 8,
      end: school?.schoolHours?.endHour ?? 17,
    };

    // Build occupied time slots from scheduled sessions (for ALL students, not just this one)
    const occupiedSlotsFromScheduled: Array<{ start: number; end: number; studentIds: string[] }> = validScheduledSessions.map(ss => {
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
      
      return { start: startMinutes, end: endMinutes, studentIds: ss.studentIds };
    });

    // Build occupied time slots from logged sessions (for ALL students, not just this one)
    const occupiedSlotsFromLogged: Array<{ start: number; end: number }> = todayLoggedSessions.map(session => {
      const sessionDate = new Date(session.date);
      // Use local hours/minutes to avoid timezone issues
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
    // Note: Convert scheduled slots to match logged slots format (without studentIds)
    const scheduledSlotsForMerge = occupiedSlotsFromScheduled.map(slot => ({
      start: slot.start,
      end: slot.end,
    }));
    const allOccupiedSlots = [...scheduledSlotsForMerge, ...occupiedSlotsFromLogged];
    
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

    // Get current time in minutes (only consider future times, not past times)
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    // Check if we're on the same day as the missed session
    const isToday = isSameDay(today, startOfDay(now));
    // Also check if the missed session date is today (in case sessionDate/sessionStartTime date format differs)
    const missedSessionIsToday = sessionDate ? isSameDay(parseDateString(sessionDate), startOfDay(now)) : 
                                   (sessionStartTime ? isSameDay(new Date(sessionStartTime), startOfDay(now)) : false);
    const reallyIsToday = isToday || missedSessionIsToday;
    
    const missedSessionEndMinutes = missedSessionStartMinutes + missedSessionDurationMinutes;
    // Always use current time if the missed session is from today, regardless of date format issues
    const earliestStartMinutes = reallyIsToday ? Math.max(missedSessionEndMinutes, currentMinutes) : missedSessionEndMinutes;
    
    // This will be set before addSlotsForGap is called
    let effectiveEarliestStart = earliestStartMinutes;
    
    // Helper function to add multiple slots for a gap
    const addSlotsForGap = (gapStart: number, gapEnd: number) => {
      // Cap gapEnd at work end time to ensure we don't offer times past school hours
      const cappedGapEnd = Math.min(gapEnd, workEndMinutes);
      
      // Only consider slots that start AFTER the effective earliest start time
      const actualGapStart = Math.max(gapStart, effectiveEarliestStart);
      
      if (actualGapStart >= cappedGapEnd) {
        return; // No valid slots after missed session
      }
      
      const gapDuration = cappedGapEnd - actualGapStart;
      if (gapDuration < missedSessionDurationMinutes) {
        return;
      }
      
      // Add a single continuous time block for the entire gap
      // (e.g., "2:40 PM - 3:00 PM" instead of multiple 30-minute increments)
      const startTime = formatTimeFromMinutes(actualGapStart);
      const endTime = formatTimeFromMinutes(cappedGapEnd);
      openSlots.push(`${startTime} - ${endTime}`);
    };

    // Determine the actual earliest time we can offer slots
    // ALWAYS use current time if it's today and later than the missed session end
    let actualEarliestStart = earliestStartMinutes;
    
    // ALWAYS check current time if the missed session date matches today's date (flexible comparison)
    const nowDateStr = format(startOfDay(now), 'yyyy-MM-dd');
    const missedSessionDateStr = sessionDate || (sessionStartTime ? format(startOfDay(new Date(sessionStartTime)), 'yyyy-MM-dd') : null);
    const datesMatch = missedSessionDateStr === nowDateStr;
    
    // Use current time if dates match OR if reallyIsToday is true
    const shouldUseCurrentTime = reallyIsToday || datesMatch;
    
    if (shouldUseCurrentTime) {
      // ALWAYS ensure we don't offer times before current time
      actualEarliestStart = Math.max(actualEarliestStart, currentMinutes);
      
      // Find any occupied slot that's currently happening (start <= current time < end)
      const currentOccupiedSlot = occupiedSlots.find(slot => 
        slot.start <= currentMinutes && slot.end > currentMinutes
      );
      
      if (currentOccupiedSlot) {
        // There's an appointment happening right now - we must start after it ends
        actualEarliestStart = Math.max(currentOccupiedSlot.end, actualEarliestStart);
      }
    }
    
    // Update the effective earliest start for addSlotsForGap to use
    effectiveEarliestStart = actualEarliestStart;
    
    // Filter to include occupied slots that are relevant for gap calculation
    // We need to include:
    // 1. Slots that end after our earliest start (future slots)
    // 2. Slots that are currently happening (start <= current time < end)
    // 3. Slots that start before current time but end after it (we need to wait for them to end)
    const relevantOccupiedSlots = occupiedSlots.filter(slot => {
      if (shouldUseCurrentTime) {
        // Include slots that:
        // - End after earliest start (future slots)
        // - Are currently happening (start <= current time < end)
        // - Start before current time but end after it (need to wait for them)
        return slot.end > actualEarliestStart || 
               (slot.start <= currentMinutes && slot.end > currentMinutes) ||
               (slot.start < currentMinutes && slot.end > currentMinutes);
      }
      return slot.end > actualEarliestStart;
    });
    
    // Also update actualEarliestStart if there's a slot that starts before current time but ends after it
    // We need to wait for that slot to end before offering new times
    if (shouldUseCurrentTime) {
      const futureEndingSlot = occupiedSlots.find(slot => 
        slot.start < currentMinutes && slot.end > currentMinutes
      );
      if (futureEndingSlot) {
        actualEarliestStart = Math.max(actualEarliestStart, futureEndingSlot.end);
      }
    }
    
    if (relevantOccupiedSlots.length === 0) {
      // No occupied slots after actual earliest start - show all available slots until end of day
      // But ensure we start from actualEarliestStart (which accounts for current time)
      const gapStart = Math.max(actualEarliestStart, workStartMinutes);
      if (gapStart < workEndMinutes) {
        addSlotsForGap(gapStart, workEndMinutes);
      }
    } else {
      // Sort by start time to ensure proper order
      relevantOccupiedSlots.sort((a, b) => a.start - b.start);
      
      // Check gap between actual earliest start and first occupied slot
      const firstOccupiedSlot = relevantOccupiedSlots[0];
      
      // Only add gap if it starts after actualEarliestStart (which includes current time check)
      if (firstOccupiedSlot.start > actualEarliestStart) {
        const gapStart = Math.max(actualEarliestStart, workStartMinutes);
        addSlotsForGap(gapStart, firstOccupiedSlot.start);
      }

      // Check gaps between occupied sessions
      for (let i = 0; i < relevantOccupiedSlots.length - 1; i++) {
        const gapStart = relevantOccupiedSlots[i].end;
        const gapEnd = Math.min(relevantOccupiedSlots[i + 1].start, workEndMinutes);
        // Only add slots if gap starts after actual earliest start and there's actually a gap
        if (gapStart >= actualEarliestStart && gapStart < gapEnd) {
          addSlotsForGap(gapStart, gapEnd);
        }
      }

      // Check gap after last occupied session - show all slots until end of day
      const lastSlot = relevantOccupiedSlots[relevantOccupiedSlots.length - 1];
      if (lastSlot.end >= actualEarliestStart && lastSlot.end < workEndMinutes) {
        addSlotsForGap(lastSlot.end, workEndMinutes);
      }
    }

    // Final safety check: verify that none of the suggested slots overlap with occupied slots
    // AND that they're not in the past (if it's today)
    const verifiedOpenSlots = openSlots.filter(slotStr => {
      // Parse the slot time from string like "10:00 AM - 10:30 AM"
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
      
      // Check if slot is in the past (if it's today)
      // OR if slot starts before actualEarliestStart (which accounts for current time)
      // Use datesMatch check as fallback if reallyIsToday failed due to date format issues
      const shouldFilterPast = reallyIsToday || datesMatch;
      const earliestAllowedStart = shouldFilterPast ? Math.max(actualEarliestStart, currentMinutes) : actualEarliestStart;
      if (slotStart < earliestAllowedStart) {
        return false;
      }
      
      // Check if this slot overlaps with ANY occupied slot (including those before actualEarliestStart)
      // Overlap occurs when: slotStart < occupied.end AND slotEnd > occupied.start
      const overlaps = occupiedSlots.some(occupied => {
        return slotStart < occupied.end && slotEnd > occupied.start;
      });
      
      if (overlaps) {
        return false;
      }
      
      return true;
    });
    
    return verifiedOpenSlots;
  };

  const formatTime = (timeStr: string): string => {
    // Convert HH:mm to 12-hour format
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
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
      const associatedStudents = emailData.studentIds
        .map(id => studentsToUse.find(s => s.id === id))
        .filter((s): s is Student => s !== undefined);
      
      // Build subject line, but truncate if too long to avoid SMTP "command line too long" error
      // Gmail SMTP has limits on header line length (typically 998 chars, but stricter in practice)
      let emailSubject: string;
      if (associatedStudents.length === 1) {
        emailSubject = `Speech Therapy Session - ${associatedStudents[0].name}`;
      } else if (associatedStudents.length <= 3) {
        const studentNames = associatedStudents.map(s => s.name).join(', ');
        emailSubject = `Speech Therapy Session - ${studentNames}`;
      } else {
        // For 4+ students, use a shorter format to avoid exceeding SMTP limits
        emailSubject = `Speech Therapy Session - ${associatedStudents.length} students`;
      }
      
      // Enforce maximum subject length (200 chars to be safe with Gmail SMTP)
      const MAX_SUBJECT_LENGTH = 200;
      if (emailSubject.length > MAX_SUBJECT_LENGTH) {
        emailSubject = emailSubject.substring(0, MAX_SUBJECT_LENGTH - 3) + '...';
      }
      
      // Ensure zoom link and signature are always included
      const zoomLink = localStorage.getItem('zoom_link') || '';
      const signature = '\n\nThank you,\nAaron Pope, MS, CCC-SLP\nc. (612) 310-9661';
      
      let finalEmailBody = emailData.emailText.trim();
      
      // Check if zoom link is already in the email
      const hasZoomLink = zoomLink && (
        finalEmailBody.includes('Zoom link:') || 
        finalEmailBody.includes(zoomLink) ||
        finalEmailBody.toLowerCase().includes('zoom')
      );
      
      // Check if signature is already in the email
      const hasSignature = finalEmailBody.includes('Aaron Pope, MS, CCC-SLP');
      
      // Add zoom link if not present
      if (!hasZoomLink && zoomLink) {
        finalEmailBody += '\n\nZoom link:\n' + zoomLink;
      } else if (!hasZoomLink && !zoomLink) {
        finalEmailBody += '\n\nZoom link:\n[Zoom link not configured. Please add it in Settings.]';
      }
      
      // Add signature if not present
      if (!hasSignature) {
        finalEmailBody += signature;
      }
      
      await api.email.send({
        to: emailData.teacher.emailAddress,
        subject: emailSubject,
        body: finalEmailBody,
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

        // Log communication for each student associated with this teacher
        for (const studentId of emailData.studentIds) {
          const studentToLog = studentsToUse.find(s => s.id === studentId);
          if (!studentToLog?.id) {
            logWarn('⚠️ No student ID available when logging communication');
            continue;
          }
          if (!emailData.teacher?.id) {
            logWarn('⚠️ No teacher ID available when logging communication');
          }

          // Determine if this is a case manager or teacher
          const isCaseManager = 'role' in emailData.teacher; // CaseManager has 'role' property, Teacher doesn't
          
          // Use the final email body (with zoom link and signature) for logging
          const communicationData = {
            studentId: studentToLog.id,
            contactType: (isCaseManager ? 'case-manager' : 'teacher') as 'teacher' | 'case-manager',
            contactId: emailData.teacher.id !== 'no-teacher' ? emailData.teacher.id : undefined,
            contactName: emailData.teacher.name,
            contactEmail: emailData.teacher.emailAddress || undefined,
            subject: emailSubject,
            body: finalEmailBody,
            method: 'email' as const,
            date: communicationDate,
            relatedTo: relatedTo || undefined,
          };

          // Validate data before sending
          if (!communicationDate) {
            logError('❌ Communication date is missing!', new Error('Communication date missing'));
          }
          if (!communicationData.contactName) {
            logError('❌ Contact name is missing!', new Error('Contact name missing'));
          }
          if (!communicationData.subject) {
            logError('❌ Subject is missing!', new Error('Subject missing'));
          }

          await api.communications.create(communicationData);
        }
      } catch (loggingError: unknown) {
        // Don't fail the email send if logging fails, but log the error
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
        await handleEmail(index);
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
    ? currentEmail.studentIds.map(id => studentsToUse.find(s => s.id === id)).filter((s): s is Student => s !== undefined)
    : [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Email Teacher or Case Manager</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
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
                Teachers / Case Managers ({teacherEmails.length})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {teacherEmails.map((emailData, index) => {
                  const isSelected = selectedTeacherIndex === index;
                  const isSent = sendSuccess.includes(emailData.teacher.id);
                  // Use index as key to ensure uniqueness, since we're already tracking by index
                  const isCaseManager = 'role' in emailData.teacher;
                  const uniqueKey = `${isCaseManager ? 'cm' : 't'}-${emailData.teacher.id}-${index}`;
                  
                  return (
                    <Chip
                      key={uniqueKey}
                      label={`${emailData.teacher.name}${emailData.teacher.id === 'no-teacher' ? ' (No teacher/case manager assigned)' : ''}${isSent ? ' ✓' : ''}`}
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
                  rows={20}
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

