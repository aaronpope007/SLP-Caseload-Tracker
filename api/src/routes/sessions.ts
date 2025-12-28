import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { parseJsonField, stringifyJsonField } from '../utils/jsonHelpers';

// Database row types
interface SessionRow {
  id: string;
  studentId: string;
  date: string;
  endTime: string | null;
  goalsTargeted: string; // JSON string
  activitiesUsed: string; // JSON string
  performanceData: string; // JSON string
  notes: string;
  isDirectServices: number;
  indirectServicesNotes: string | null;
  groupSessionId: string | null;
  missedSession: number;
  selectedSubjectiveStatements: string | null; // JSON string
  customSubjective: string | null;
  plan: string | null;
}

export const sessionsRouter = Router();

// Get all sessions (optionally filtered by studentId or school)
sessionsRouter.get('/', asyncHandler(async (req, res) => {
  const { studentId, school } = req.query;
  
  let query = 'SELECT * FROM sessions';
  const params: string[] = [];
  
  if (studentId) {
    query += ' WHERE studentId = ? ORDER BY date DESC';
    params.push(studentId as string);
  } else if (school) {
    query = `
      SELECT s.* FROM sessions s
      INNER JOIN students st ON s.studentId = st.id
      WHERE st.school = ?
      ORDER BY s.date DESC
    `;
    params.push(school as string);
  } else {
    query += ' ORDER BY date DESC';
  }
  
  const sessions = db.prepare(query).all(...params) as SessionRow[];
  
  // Parse JSON fields
  const parsed = sessions.map((s) => ({
    ...s,
    goalsTargeted: parseJsonField<string[]>(s.goalsTargeted, []),
    activitiesUsed: parseJsonField<string[]>(s.activitiesUsed, []),
    performanceData: parseJsonField<any[]>(s.performanceData, []),
    isDirectServices: s.isDirectServices === 1,
    missedSession: s.missedSession === 1,
    selectedSubjectiveStatements: parseJsonField<string[]>(s.selectedSubjectiveStatements, undefined),
    customSubjective: s.customSubjective || undefined,
    plan: s.plan || undefined,
  }));
  
  res.json(parsed);
}));

// Get session by ID
sessionsRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    ...session,
    goalsTargeted: parseJsonField<string[]>(session.goalsTargeted, []),
    activitiesUsed: parseJsonField<string[]>(session.activitiesUsed, []),
    performanceData: parseJsonField<any[]>(session.performanceData, []),
    isDirectServices: session.isDirectServices === 1,
    missedSession: session.missedSession === 1,
    selectedSubjectiveStatements: parseJsonField<string[]>(session.selectedSubjectiveStatements, undefined),
    customSubjective: session.customSubjective || undefined,
    plan: session.plan || undefined,
  });
}));

// Create session
sessionsRouter.post('/', asyncHandler(async (req, res) => {
  const session = req.body;
  
  db.prepare(`
    INSERT INTO sessions (id, studentId, date, endTime, goalsTargeted, activitiesUsed, 
                         performanceData, notes, isDirectServices, indirectServicesNotes, 
                         groupSessionId, missedSession, selectedSubjectiveStatements, customSubjective, plan)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    session.id,
    session.studentId,
    session.date,
    session.endTime || null,
    stringifyJsonField(session.goalsTargeted || []),
    stringifyJsonField(session.activitiesUsed || []),
    stringifyJsonField(session.performanceData || []),
    session.notes,
    session.isDirectServices !== false ? 1 : 0,
    session.indirectServicesNotes || null,
    session.groupSessionId || null,
    session.missedSession ? 1 : 0,
    stringifyJsonField(session.selectedSubjectiveStatements),
    session.customSubjective || null,
    session.plan || null
  );
  
  res.status(201).json({ id: session.id, message: 'Session created' });
}));

// Update session
sessionsRouter.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const existing = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const session = { ...existing, ...updates };
  
  db.prepare(`
    UPDATE sessions 
    SET studentId = ?, date = ?, endTime = ?, goalsTargeted = ?, activitiesUsed = ?, 
        performanceData = ?, notes = ?, isDirectServices = ?, indirectServicesNotes = ?, 
        groupSessionId = ?, missedSession = ?, selectedSubjectiveStatements = ?, customSubjective = ?, plan = ?
    WHERE id = ?
  `).run(
    session.studentId,
    session.date,
    session.endTime || null,
    stringifyJsonField(session.goalsTargeted || []),
    stringifyJsonField(session.activitiesUsed || []),
    stringifyJsonField(session.performanceData || []),
    session.notes,
    session.isDirectServices !== false ? 1 : 0,
    session.indirectServicesNotes || null,
    session.groupSessionId || null,
    session.missedSession ? 1 : 0,
    stringifyJsonField(session.selectedSubjectiveStatements),
    session.customSubjective || null,
    session.plan || null,
    id
  );
  
  res.json({ message: 'Session updated' });
}));

// Delete session
sessionsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({ message: 'Session deleted' });
}));

