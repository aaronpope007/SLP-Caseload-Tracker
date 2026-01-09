import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { parseJsonField, stringifyJsonField } from '../utils/jsonHelpers';
import { createSessionSchema, updateSessionSchema } from '../schemas';

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

// Performance data type for proper parsing
interface PerformanceDataItem {
  goalId: string;
  accuracy?: number;
  correctTrials?: number;
  incorrectTrials?: number;
  notes?: string;
  cuingLevels?: string[];
}

export const sessionsRouter = Router();

/**
 * @openapi
 * /api/sessions:
 *   get:
 *     tags: [Sessions]
 *     summary: Get all sessions
 *     parameters:
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: school
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of sessions
 */
sessionsRouter.get('/', asyncHandler(async (req, res) => {
  const { studentId, school } = req.query;
  
  let query = 'SELECT * FROM sessions';
  const params: string[] = [];
  
  if (studentId && typeof studentId === 'string') {
    query += ' WHERE studentId = ? ORDER BY date DESC';
    params.push(studentId);
  } else if (school && typeof school === 'string') {
    query = `
      SELECT s.* FROM sessions s
      INNER JOIN students st ON s.studentId = st.id
      WHERE st.school = ?
      ORDER BY s.date DESC
    `;
    params.push(school);
  } else {
    query += ' ORDER BY date DESC';
  }
  
  const sessions = db.prepare(query).all(...params) as SessionRow[];
  
  // Parse JSON fields
  const parsed = sessions.map((s) => ({
    ...s,
    goalsTargeted: parseJsonField<string[]>(s.goalsTargeted, []),
    activitiesUsed: parseJsonField<string[]>(s.activitiesUsed, []),
    performanceData: parseJsonField<PerformanceDataItem[]>(s.performanceData, []),
    isDirectServices: s.isDirectServices === 1,
    missedSession: s.missedSession === 1,
    selectedSubjectiveStatements: parseJsonField<string[]>(s.selectedSubjectiveStatements, undefined),
    customSubjective: s.customSubjective || undefined,
    plan: s.plan || undefined,
  }));
  
  res.json(parsed);
}));

/**
 * @openapi
 * /api/sessions/{id}:
 *   get:
 *     tags: [Sessions]
 *     summary: Get session by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session details
 *       404:
 *         description: Session not found
 */
sessionsRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    ...session,
    goalsTargeted: parseJsonField<string[]>(session.goalsTargeted, []),
    activitiesUsed: parseJsonField<string[]>(session.activitiesUsed, []),
    performanceData: parseJsonField<PerformanceDataItem[]>(session.performanceData, []),
    isDirectServices: session.isDirectServices === 1,
    missedSession: session.missedSession === 1,
    selectedSubjectiveStatements: parseJsonField<string[]>(session.selectedSubjectiveStatements, undefined),
    customSubjective: session.customSubjective || undefined,
    plan: session.plan || undefined,
  });
}));

/**
 * @openapi
 * /api/sessions:
 *   post:
 *     tags: [Sessions]
 *     summary: Create a new session
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Session'
 *     responses:
 *       201:
 *         description: Session created
 *       400:
 *         description: Validation error
 */
sessionsRouter.post('/', validateBody(createSessionSchema), asyncHandler(async (req, res) => {
  const session = req.body;
  
  // Verify student exists
  const student = db.prepare('SELECT id FROM students WHERE id = ?').get(session.studentId);
  if (!student) {
    return res.status(400).json({ error: 'Student not found', details: [{ field: 'studentId', message: 'Student does not exist' }] });
  }
  
  // Generate ID if not provided
  const sessionId = session.id || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  db.prepare(`
    INSERT INTO sessions (id, studentId, date, endTime, goalsTargeted, activitiesUsed, 
                         performanceData, notes, isDirectServices, indirectServicesNotes, 
                         groupSessionId, missedSession, selectedSubjectiveStatements, customSubjective, plan)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sessionId,
    session.studentId,
    session.date,
    session.endTime || null,
    stringifyJsonField(session.goalsTargeted || []),
    stringifyJsonField(session.activitiesUsed || []),
    stringifyJsonField(session.performanceData || []),
    session.notes || '',
    session.isDirectServices !== false ? 1 : 0,
    session.indirectServicesNotes || null,
    session.groupSessionId || null,
    session.missedSession ? 1 : 0,
    stringifyJsonField(session.selectedSubjectiveStatements),
    session.customSubjective || null,
    session.plan || null
  );
  
  res.status(201).json({ id: sessionId, message: 'Session created' });
}));

/**
 * @openapi
 * /api/sessions/{id}:
 *   put:
 *     tags: [Sessions]
 *     summary: Update a session
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Session'
 *     responses:
 *       200:
 *         description: Session updated
 *       404:
 *         description: Session not found
 */
sessionsRouter.put('/:id', validateBody(updateSessionSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  const existing = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  // If studentId is being updated, verify the new student exists
  if (updates.studentId && updates.studentId !== existing.studentId) {
    const student = db.prepare('SELECT id FROM students WHERE id = ?').get(updates.studentId);
    if (!student) {
      return res.status(400).json({ error: 'Student not found', details: [{ field: 'studentId', message: 'Student does not exist' }] });
    }
  }
  
  // Filter out undefined values from updates to prevent overwriting existing values with undefined
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([_, value]) => value !== undefined)
  );
  
  const session = { ...existing, ...cleanUpdates };
  
  // Handle boolean/number coercion for isDirectServices and missedSession
  const isDirectServices = typeof session.isDirectServices === 'boolean' 
    ? session.isDirectServices 
    : session.isDirectServices === 1;
  const missedSession = typeof session.missedSession === 'boolean'
    ? session.missedSession
    : session.missedSession === 1;
  
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
    session.notes || '',
    isDirectServices ? 1 : 0,
    session.indirectServicesNotes || null,
    session.groupSessionId || null,
    missedSession ? 1 : 0,
    stringifyJsonField(session.selectedSubjectiveStatements),
    session.customSubjective || null,
    session.plan || null,
    id
  );
  
  res.json({ message: 'Session updated' });
}));

/**
 * @openapi
 * /api/sessions/{id}:
 *   delete:
 *     tags: [Sessions]
 *     summary: Delete a session
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session deleted
 *       404:
 *         description: Session not found
 */
sessionsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({ message: 'Session deleted' });
}));
