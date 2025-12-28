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
  
  let query = 'SELECT * FROM scheduled_sessions';
  const params: string[] = [];
  
  if (school && typeof school === 'string' && school.trim()) {
    // Get scheduled sessions for students in a specific school
    // Note: We need to parse JSON in application code since SQLite JSON support varies
    // For now, we'll filter all active sessions and filter by school in code
    query = 'SELECT * FROM scheduled_sessions WHERE active = 1';
  } else {
    query += ' WHERE active = 1';
  }
  
  const sessions = db.prepare(query).all(...params) as ScheduledSessionRow[];
  
  // Parse JSON fields and filter by school if needed
  let parsed = sessions.map((s) => {
    const studentIds = parseJsonField<string[]>(s.studentIds, []);
    return {
    id: s.id,
    studentIds: parseJsonField<string[]>(s.studentIds, []),
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
    _studentIds: studentIds, // Temporary for filtering
  };
  });
  
  // Filter by school if needed
  if (school && typeof school === 'string' && school.trim()) {
    const schoolName = school.trim();
    // Get all student IDs for this school
    const studentsInSchool = db.prepare('SELECT id FROM students WHERE school = ?').all(schoolName) as Array<{ id: string }>;
    const studentIdSet = new Set(studentsInSchool.map(s => s.id));
    
    // Filter sessions that have at least one student in the school
    parsed = parsed.filter(s => {
      const studentIds = s._studentIds as string[];
      return studentIds.some(id => studentIdSet.has(id));
    });
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
  
  const session = { ...existing, ...updates };
  
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

