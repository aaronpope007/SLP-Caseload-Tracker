import { useState, useEffect } from 'react';
import { logError, logWarn, logInfo } from '../utils/logger';
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
} from '@mui/material';
import {
  ContentCopy as ContentCopyIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import type { Student, Teacher, ScheduledSession, Session } from '../types';
import { getTeachers, getSessionsBySchool, getSchoolByName } from '../utils/storage-api';
import { getScheduledSessions } from '../utils/storage-api';
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
      // Reset states when dialog opens
      setEmailText('');
      setTeacher(null);
      setAvailableTimes([]);
      setSendError(null);
      setSendSuccess(false);
      
      loadTeacherAndGenerateEmail().catch((error) => {
        logError('Failed to load teacher and generate email', error);
        // Still generate email text even if loading fails
        if (student) {
          generateEmailText(null, []);
        }
      });
    } else if (!open) {
      // Reset email text when dialog closes
      setEmailText('');
      setTeacher(null);
      setAvailableTimes([]);
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

  const generateEmailText = (teacher: Teacher | null, times: string[]) => {
    if (!student) return;

    const teacherName = teacher?.name || 'Teacher';
    const studentName = student.name;
    const userName = localStorage.getItem('user_name') || 'Aaron Pope';
    const zoomLink = localStorage.getItem('zoom_link') || '';
    
    // Debug: Log zoom link to help diagnose issues
    if (!zoomLink) {
      logWarn('Zoom link not found in localStorage. Please configure it in Settings.');
    }

    let email = `Dear ${teacherName},\n\n`;
    email += `${studentName} is late for their scheduled speech therapy session. Will they be able to attend the session? The zoom link is below.\n\n`;
    
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

    email += `\n\nThank you,\nAaron Pope, MS, CCC-SLP\nc. (612) 310-9661`;

    setEmailText(email);
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
      const scheduledSessions = await getScheduledSessions(student.school);
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
    const allScheduledSessions = await getScheduledSessions(student.school);
    
    // Get ALL logged sessions for the school (actual completed sessions)
    const allLoggedSessions = await getSessionsBySchool(student.school);
    
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
      
      // Exclude the scheduled session that matches the missed session time and student
      // This prevents the missed session's scheduled slot from blocking reschedule times
      if (sessionStartTime && ss.studentIds.includes(student.id)) {
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
        if (timeDiff < 5 * 60 * 1000 && session.studentId === student.id && session.missedSession) {
          return false; // Exclude this missed session
        }
      }
      
      return true;
    });

    // Get school hours from school settings
    const school = await getSchoolByName(student.school);
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
    
    setAvailableTimes(verifiedOpenSlots);

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
      
      // Ensure zoom link and signature are always included
      const zoomLink = localStorage.getItem('zoom_link') || '';
      const signature = '\n\nThank you,\nAaron Pope, MS, CCC-SLP\nc. (612) 310-9661';
      
      let finalEmailBody = emailText.trim();
      
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
        to: teacher.emailAddress,
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

        // Ensure we have all required fields
        if (!student?.id) {
          logWarn('⚠️ No student ID available when logging communication');
        }
        if (!teacher?.id) {
          logWarn('⚠️ No teacher ID available when logging communication');
        }

        // Ensure we have a valid student ID
        if (!student?.id) {
          logError('❌ Cannot log communication: student is null or has no ID', new Error('Student ID missing'), {
            student,
            studentName: student?.name,
          });
        }

        // Use the final email body (with zoom link and signature) for logging
        const communicationData = {
          studentId: student?.id || undefined,
          contactType: 'teacher' as const,
          contactId: teacher.id,
          contactName: teacher.name,
          contactEmail: teacher.emailAddress,
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
      } catch (loggingError: unknown) {
        // Don't fail the email send if logging fails, but log the error
        logError('Failed to log communication', loggingError);
      }

      setSendSuccess(true);
      setTimeout(() => {
        setSendSuccess(false);
        onClose();
      }, 2000);
    } catch (error: unknown) {
      logError('Error sending email', error);
      setSendError(getErrorMessage(error) || 'Failed to send email. Please check your email settings and try again.');
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

