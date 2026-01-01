import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { parseJsonField, stringifyJsonField } from '../utils/jsonHelpers';
import type { ScheduledSession } from '../../../src/types';

// Database row types
interface ScheduledSessionRow {
  id: string;
  studentIds: string; // JSON string
  startTime: string;
  endTime: string | null;
  duration: number | null;
  dayOfWeek: string | null; // JSON string
  specificDates: string | null; // JSON string
  recurrencePattern: string;
  startDate: string;
  endDate: string | null;
  goalsTargeted: string; // JSON string
  notes: string | null;
  isDirectServices: number;
  dateCreated: string;
  dateUpdated: string;
  active: number;
  cancelledDates: string | null; // JSON string
}

export const scheduledSessionsRouter = Router();

// Get all scheduled sessions (optionally filtered by school)
scheduledSessionsRouter.get('/', asyncHandler(async (req, res) => {
  const { school } = req.query;
  
  // Always get all active sessions first, then filter by school in code if needed
  const query = 'SELECT * FROM scheduled_sessions WHERE active = 1';
  const sessions = db.prepare(query).all() as ScheduledSessionRow[];
  
  console.log(`[API] Loaded ${sessions.length} active scheduled sessions from database`);
  
  // Parse JSON fields and filter by school if needed
  let parsed = sessions.map((s) => {
    const studentIds = parseJsonField<string[]>(s.studentIds, []);
    // Ensure studentIds is always an array
    const safeStudentIds = Array.isArray(studentIds) ? studentIds : [];
    if (!Array.isArray(studentIds)) {
      console.warn(`[API] Session ${s.id} has invalid studentIds format:`, s.studentIds, 'parsed as:', studentIds);
    }
    return {
    id: s.id,
    studentIds: safeStudentIds,
    startTime: s.startTime,
    endTime: s.endTime || undefined,
    duration: s.duration || undefined,
    dayOfWeek: parseJsonField<number[]>(s.dayOfWeek, undefined),
    specificDates: parseJsonField<string[]>(s.specificDates, undefined),
    recurrencePattern: s.recurrencePattern as ScheduledSession['recurrencePattern'],
    startDate: s.startDate,
    endDate: s.endDate || undefined,
    goalsTargeted: parseJsonField<string[]>(s.goalsTargeted, []),
    notes: s.notes || undefined,
    isDirectServices: s.isDirectServices === 1,
    dateCreated: s.dateCreated,
    dateUpdated: s.dateUpdated,
    active: s.active === 1,
    cancelledDates: parseJsonField<string[]>(s.cancelledDates, undefined),
    _studentIds: safeStudentIds, // Temporary for filtering
  };
  });
  
  // Filter by school if needed
  if (school && typeof school === 'string' && school.trim()) {
    const schoolName = school.trim();
    console.log(`[API] Filtering scheduled sessions by school: ${schoolName}`);
    // Get all student IDs for this school
    const studentsInSchool = db.prepare('SELECT id FROM students WHERE school = ?').all(schoolName) as Array<{ id: string }>;
    const studentIdSet = new Set(studentsInSchool.map(s => s.id));
    console.log(`[API] Found ${studentsInSchool.length} students in school ${schoolName}`);
    
    // Filter sessions that have at least one student in the school
    const beforeFilter = parsed.length;
    parsed = parsed.filter(s => {
      // Ensure studentIds is an array
      const studentIds = Array.isArray(s._studentIds) ? s._studentIds : [];
      if (!Array.isArray(studentIds)) {
        console.warn(`[API] Session ${s.id} has invalid studentIds (not an array):`, s._studentIds, typeof s._studentIds);
        return false;
      }
      const hasStudentInSchool = studentIds.length > 0 && studentIds.some(id => studentIdSet.has(id));
      if (!hasStudentInSchool && studentIds.length > 0) {
        // Get the actual schools for these students to provide better debugging info
        const studentSchools = db.prepare('SELECT id, school FROM students WHERE id IN (' + studentIds.map(() => '?').join(',') + ')').all(...studentIds) as Array<{ id: string; school: string }>;
        const schoolMap = new Map(studentSchools.map(s => [s.id, s.school]));
        const studentSchoolInfo = studentIds.map(id => {
          const school = schoolMap.get(id) || 'UNKNOWN';
          return `${id} (${school})`;
        });
        console.log(`[API] Filtering out session ${s.id} - students in this session belong to different schools than "${schoolName}". Students:`, studentSchoolInfo);
      }
      return hasStudentInSchool;
    });
    console.log(`[API] Filtered from ${beforeFilter} to ${parsed.length} sessions for school ${schoolName}`);
  }
  
  // Remove temporary field
  const result = parsed.map(({ _studentIds, ...rest }) => ({
    ...rest,
    studentIds: _studentIds as string[],
  }));
  
  res.json(result);
}));

// Get scheduled session by ID
scheduledSessionsRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = db.prepare('SELECT * FROM scheduled_sessions WHERE id = ?').get(id) as ScheduledSessionRow | undefined;
  
  if (!session) {
    return res.status(404).json({ error: 'Scheduled session not found' });
  }
  
  res.json({
    id: session.id,
    studentIds: parseJsonField<string[]>(session.studentIds, []),
    startTime: session.startTime,
    endTime: session.endTime || undefined,
    duration: session.duration || undefined,
    dayOfWeek: parseJsonField<number[]>(session.dayOfWeek, undefined),
    specificDates: parseJsonField<string[]>(session.specificDates, undefined),
    recurrencePattern: session.recurrencePattern as ScheduledSession['recurrencePattern'],
    startDate: session.startDate,
    endDate: session.endDate || undefined,
    goalsTargeted: parseJsonField<string[]>(session.goalsTargeted, []),
    notes: session.notes || undefined,
    isDirectServices: session.isDirectServices === 1,
    dateCreated: session.dateCreated,
    dateUpdated: session.dateUpdated,
    active: session.active === 1,
    cancelledDates: parseJsonField<string[]>(session.cancelledDates, undefined),
  });
}));

// Create scheduled session
scheduledSessionsRouter.post('/', asyncHandler(async (req, res) => {
  const session: ScheduledSession = req.body;
  
  console.log('[API] Creating scheduled session:', {
    id: session.id,
    studentIds: session.studentIds,
    startDate: session.startDate,
    endDate: session.endDate,
    active: session.active,
  });
  
  db.prepare(`
    INSERT INTO scheduled_sessions (
      id, studentIds, startTime, endTime, duration, dayOfWeek, specificDates,
      recurrencePattern, startDate, endDate, goalsTargeted, notes,
      isDirectServices, dateCreated, dateUpdated, active, cancelledDates
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    session.id,
    stringifyJsonField(session.studentIds),
    session.startTime,
    session.endTime || null,
    session.duration || null,
    stringifyJsonField(session.dayOfWeek),
    stringifyJsonField(session.specificDates),
    session.recurrencePattern,
    session.startDate,
    session.endDate || null,
    stringifyJsonField(session.goalsTargeted),
    session.notes || null,
    session.isDirectServices ? 1 : 0,
    session.dateCreated,
    session.dateUpdated,
    session.active !== false ? 1 : 0,
    stringifyJsonField(session.cancelledDates)
  );
  
  console.log('[API] Scheduled session created successfully:', session.id);
  res.status(201).json({ id: session.id, message: 'Scheduled session created' });
}));

// Update scheduled session
scheduledSessionsRouter.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates: Partial<ScheduledSession> = req.body;
  
  const existing = db.prepare('SELECT * FROM scheduled_sessions WHERE id = ?').get(id) as ScheduledSessionRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Scheduled session not found' });
  }
  
  // Parse existing data from database
  const existingParsed = {
    id: existing.id,
    studentIds: parseJsonField<string[]>(existing.studentIds, []),
    startTime: existing.startTime,
    endTime: existing.endTime || undefined,
    duration: existing.duration || undefined,
    dayOfWeek: parseJsonField<number[]>(existing.dayOfWeek, undefined),
    specificDates: parseJsonField<string[]>(existing.specificDates, undefined),
    recurrencePattern: existing.recurrencePattern as ScheduledSession['recurrencePattern'],
    startDate: existing.startDate,
    endDate: existing.endDate || undefined,
    goalsTargeted: parseJsonField<string[]>(existing.goalsTargeted, []),
    notes: existing.notes || undefined,
    isDirectServices: existing.isDirectServices === 1,
    dateCreated: existing.dateCreated,
    dateUpdated: existing.dateUpdated,
    active: existing.active === 1,
    cancelledDates: parseJsonField<string[]>(existing.cancelledDates, undefined) || [],
  };
  
  // CRITICAL: Build the final session object by only updating fields that are explicitly provided
  // Start with existing values and only override with provided updates
  const session: ScheduledSession = {
    id: existingParsed.id,
    studentIds: 'studentIds' in updates ? (updates.studentIds || existingParsed.studentIds) : existingParsed.studentIds,
    startTime: 'startTime' in updates ? (updates.startTime || existingParsed.startTime) : existingParsed.startTime,
    endTime: 'endTime' in updates ? updates.endTime : existingParsed.endTime,
    duration: 'duration' in updates ? updates.duration : existingParsed.duration,
    dayOfWeek: 'dayOfWeek' in updates ? updates.dayOfWeek : existingParsed.dayOfWeek,
    specificDates: 'specificDates' in updates ? updates.specificDates : existingParsed.specificDates,
    recurrencePattern: 'recurrencePattern' in updates ? (updates.recurrencePattern || existingParsed.recurrencePattern) : existingParsed.recurrencePattern,
    startDate: 'startDate' in updates ? (updates.startDate || existingParsed.startDate) : existingParsed.startDate,
    endDate: 'endDate' in updates ? updates.endDate : existingParsed.endDate,
    goalsTargeted: 'goalsTargeted' in updates ? (updates.goalsTargeted || existingParsed.goalsTargeted) : existingParsed.goalsTargeted,
    notes: 'notes' in updates ? updates.notes : existingParsed.notes,
    isDirectServices: 'isDirectServices' in updates ? (updates.isDirectServices !== undefined ? updates.isDirectServices : existingParsed.isDirectServices) : existingParsed.isDirectServices,
    dateCreated: existingParsed.dateCreated, // Never update
    dateUpdated: new Date().toISOString(), // Always update
    active: 'active' in updates ? (updates.active !== undefined ? updates.active : existingParsed.active) : existingParsed.active,
    cancelledDates: 'cancelledDates' in updates ? (Array.isArray(updates.cancelledDates) ? updates.cancelledDates : existingParsed.cancelledDates) : existingParsed.cancelledDates,
  };
  
  // Ensure cancelledDates is always an array
  if (!Array.isArray(session.cancelledDates)) {
    session.cancelledDates = [];
  }
  
  db.prepare(`
    UPDATE scheduled_sessions 
    SET studentIds = ?, startTime = ?, endTime = ?, duration = ?, dayOfWeek = ?,
        specificDates = ?, recurrencePattern = ?, startDate = ?, endDate = ?,
        goalsTargeted = ?, notes = ?, isDirectServices = ?, dateUpdated = ?,
        active = ?, cancelledDates = ?
    WHERE id = ?
  `).run(
    stringifyJsonField(session.studentIds),
    session.startTime,
    session.endTime || null,
    session.duration || null,
    stringifyJsonField(session.dayOfWeek),
    stringifyJsonField(session.specificDates),
    session.recurrencePattern,
    session.startDate,
    session.endDate || null,
    stringifyJsonField(session.goalsTargeted),
    session.notes || null,
    session.isDirectServices ? 1 : 0,
    new Date().toISOString(),
    session.active !== false ? 1 : 0,
    stringifyJsonField(session.cancelledDates),
    id
  );
  
  res.json({ message: 'Scheduled session updated' });
}));

// Delete scheduled session
scheduledSessionsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM scheduled_sessions WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Scheduled session not found' });
  }
  
  res.json({ message: 'Scheduled session deleted' });
}));

