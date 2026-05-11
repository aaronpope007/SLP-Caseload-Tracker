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
  goalsAddressed: string | null;
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
  scheduledSessionId: string | null;
  tsisGroup: number | null;
  cptCode: string | null;
  icd10Codes: string | null;
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

function toSessionResponse(s: SessionRow) {
  return {
    id: s.id,
    studentId: s.studentId,
    date: s.date,
    endTime: s.endTime || undefined,
    goalsTargeted: parseJsonField<string[]>(s.goalsTargeted, []),
    goalsAddressed: parseJsonField<string[]>(s.goalsAddressed, []),
    activitiesUsed: parseJsonField<string[]>(s.activitiesUsed, []),
    performanceData: parseJsonField<PerformanceDataItem[]>(s.performanceData, []),
    notes: s.notes,
    isDirectServices: s.isDirectServices === 1,
    indirectServicesNotes: s.indirectServicesNotes || undefined,
    groupSessionId: s.groupSessionId || undefined,
    missedSession: s.missedSession === 1,
    selectedSubjectiveStatements: parseJsonField<string[]>(s.selectedSubjectiveStatements, undefined),
    customSubjective: s.customSubjective || undefined,
    plan: s.plan || undefined,
    scheduledSessionId: s.scheduledSessionId || undefined,
    tsisGroup: s.tsisGroup === 1,
    cptCode: s.cptCode || undefined,
    icd10Codes: parseJsonField<string[]>(s.icd10Codes, []),
  };
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
  const { studentId, school, limit } = req.query;

  let query = 'SELECT * FROM sessions';
  const params: (string | number)[] = [];

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

  if (limit !== undefined) {
    const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : NaN;
    if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
      const clamped = Math.min(parsedLimit, 1000);
      query += ' LIMIT ?';
      params.push(clamped);
    }
  }

  const sessions = db.prepare(query).all(...params) as SessionRow[];
  res.json(sessions.map(toSessionResponse));
}));

sessionsRouter.get('/log', asyncHandler(async (req, res) => {
  const { startDate, endDate, studentIds } = req.query;
  if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
    return res.status(400).json({ error: 'startDate and endDate are required (YYYY-MM-DD)' });
  }
  if (!studentIds || typeof studentIds !== 'string' || !studentIds.trim()) {
    return res.status(400).json({ error: 'studentIds is required (comma-separated)' });
  }
  const ids = studentIds.split(',').map((x) => x.trim()).filter(Boolean);
  if (ids.length === 0) {
    return res.status(400).json({ error: 'At least one student id is required' });
  }

  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(
      `
    SELECT s.*, st.name as studentName
    FROM sessions s
    INNER JOIN students st ON st.id = s.studentId
    WHERE s.studentId IN (${placeholders})
      AND date(s.date) >= date(?)
      AND date(s.date) <= date(?)
      AND s.missedSession = 0
      AND s.isDirectServices = 1
    ORDER BY s.date ASC, st.name ASC
  `
    )
    .all(...ids, startDate, endDate) as Array<SessionRow & { studentName: string }>;

  const groupCounts = new Map<string, number>();
  for (const row of rows) {
    const gid = row.groupSessionId;
    if (gid) groupCounts.set(gid, (groupCounts.get(gid) || 0) + 1);
  }

  const goalIds = new Set<string>();
  for (const row of rows) {
    const ga = parseJsonField<string[]>(row.goalsAddressed, []);
    const gt = parseJsonField<string[]>(row.goalsTargeted, []);
    const use = ga.length > 0 ? ga : gt;
    use.forEach((gid) => goalIds.add(gid));
  }

  const goalsMap = new Map<string, string>();
  if (goalIds.size > 0) {
    const gPlaceholders = [...goalIds].map(() => '?').join(',');
    const goals = db
      .prepare(`SELECT id, description FROM goals WHERE id IN (${gPlaceholders})`)
      .all(...goalIds) as Array<{ id: string; description: string }>;
    for (const g of goals) goalsMap.set(g.id, g.description);
  }

  const out = rows.map((row) => {
    const goalsAddressedIds = parseJsonField<string[]>(row.goalsAddressed, []);
    const goalsTargetedIds = parseJsonField<string[]>(row.goalsTargeted, []);
    const resolvedGoalIds = goalsAddressedIds.length > 0 ? goalsAddressedIds : goalsTargetedIds;
    const goalsAddressedTexts = resolvedGoalIds.map((gid) => goalsMap.get(gid) || `Goal ${gid}`);

    const inferredGroup =
      row.groupSessionId != null &&
      row.groupSessionId !== '' &&
      (groupCounts.get(row.groupSessionId) || 0) > 1;
    const isGroup = row.tsisGroup === 1 || inferredGroup;
    const cptResolved = isGroup ? '92508' : '92507';

    let durationMinutes: number | null = null;
    if (row.endTime) {
      const a = Date.parse(row.date);
      const b = Date.parse(row.endTime);
      if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
        durationMinutes = Math.round((b - a) / 60000);
      }
    }

    return {
      id: row.id,
      studentId: row.studentId,
      studentName: row.studentName,
      date: row.date,
      endTime: row.endTime || undefined,
      durationMinutes,
      goalsAddressedTexts,
      isGroup,
      cptCode: cptResolved,
      icd10Codes: parseJsonField<string[]>(row.icd10Codes, []),
    };
  });

  res.json(out);
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
  
  res.json(toSessionResponse(session));
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
    INSERT INTO sessions (id, studentId, date, endTime, goalsTargeted, goalsAddressed, activitiesUsed, 
                         performanceData, notes, isDirectServices, indirectServicesNotes, 
                         groupSessionId, missedSession, selectedSubjectiveStatements, customSubjective, plan,
                         scheduledSessionId, tsisGroup, cptCode, icd10Codes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sessionId,
    session.studentId,
    session.date,
    session.endTime || null,
    stringifyJsonField(session.goalsTargeted || []),
    stringifyJsonField(session.goalsAddressed ?? []),
    stringifyJsonField(session.activitiesUsed || []),
    stringifyJsonField(session.performanceData || []),
    session.notes || '',
    session.isDirectServices !== false ? 1 : 0,
    session.indirectServicesNotes || null,
    session.groupSessionId || null,
    session.missedSession ? 1 : 0,
    stringifyJsonField(session.selectedSubjectiveStatements),
    session.customSubjective || null,
    session.plan || null,
    session.scheduledSessionId || null,
    session.tsisGroup ? 1 : 0,
    session.cptCode || null,
    stringifyJsonField(session.icd10Codes || [])
  );
  
  res.status(201).json({ id: sessionId, message: 'Session created' });
}));

/**
 * @openapi
 * /api/sessions/bulk:
 *   post:
 *     tags: [Sessions]
 *     summary: Create or update multiple sessions in a single transaction
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessions:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Session'
 *     responses:
 *       200:
 *         description: Bulk operation completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 created:
 *                   type: number
 *                 updated:
 *                   type: number
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 */
sessionsRouter.post('/bulk', asyncHandler(async (req, res) => {
  const { sessions } = req.body;
  
  if (!Array.isArray(sessions)) {
    return res.status(400).json({ error: 'sessions must be an array' });
  }
  
  let created = 0;
  let updated = 0;
  const errors: Array<{ id?: string; error: string }> = [];
  
  // Use a transaction for atomicity
  const transaction = db.transaction(() => {
    for (const session of sessions) {
      try {
        // Verify student exists
        const student = db.prepare('SELECT id FROM students WHERE id = ?').get(session.studentId);
        if (!student) {
          errors.push({ id: session.id, error: `Student ${session.studentId} not found` });
          continue;
        }
        
        const existing = db.prepare('SELECT id FROM sessions WHERE id = ?').get(session.id) as { id: string } | undefined;
        
        if (existing) {
          // Update existing session
          db.prepare(`
            UPDATE sessions 
            SET studentId = ?, date = ?, endTime = ?, goalsTargeted = ?, goalsAddressed = ?, activitiesUsed = ?, 
                performanceData = ?, notes = ?, isDirectServices = ?, indirectServicesNotes = ?, 
                groupSessionId = ?, missedSession = ?, selectedSubjectiveStatements = ?, 
                customSubjective = ?, plan = ?, scheduledSessionId = ?, tsisGroup = ?, cptCode = ?, icd10Codes = ?
            WHERE id = ?
          `).run(
            session.studentId,
            session.date,
            session.endTime || null,
            stringifyJsonField(session.goalsTargeted || []),
            stringifyJsonField(session.goalsAddressed ?? []),
            stringifyJsonField(session.activitiesUsed || []),
            stringifyJsonField(session.performanceData || []),
            session.notes || '',
            session.isDirectServices !== false ? 1 : 0,
            session.indirectServicesNotes || null,
            session.groupSessionId || null,
            session.missedSession ? 1 : 0,
            stringifyJsonField(session.selectedSubjectiveStatements),
            session.customSubjective || null,
            session.plan || null,
            session.scheduledSessionId || null,
            session.tsisGroup ? 1 : 0,
            session.cptCode || null,
            stringifyJsonField(session.icd10Codes || []),
            session.id
          );
          updated++;
        } else {
          // Create new session
          const sessionId = session.id || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          db.prepare(`
            INSERT INTO sessions (id, studentId, date, endTime, goalsTargeted, goalsAddressed, activitiesUsed, 
                                 performanceData, notes, isDirectServices, indirectServicesNotes, 
                                 groupSessionId, missedSession, selectedSubjectiveStatements, customSubjective, plan,
                                 scheduledSessionId, tsisGroup, cptCode, icd10Codes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            sessionId,
            session.studentId,
            session.date,
            session.endTime || null,
            stringifyJsonField(session.goalsTargeted || []),
            stringifyJsonField(session.goalsAddressed ?? []),
            stringifyJsonField(session.activitiesUsed || []),
            stringifyJsonField(session.performanceData || []),
            session.notes || '',
            session.isDirectServices !== false ? 1 : 0,
            session.indirectServicesNotes || null,
            session.groupSessionId || null,
            session.missedSession ? 1 : 0,
            stringifyJsonField(session.selectedSubjectiveStatements),
            session.customSubjective || null,
            session.plan || null,
            session.scheduledSessionId || null,
            session.tsisGroup ? 1 : 0,
            session.cptCode || null,
            stringifyJsonField(session.icd10Codes || [])
          );
          created++;
        }
      } catch (error) {
        errors.push({ 
          id: session.id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  });
  
  transaction();
  
  res.json({ created, updated, errors });
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

  const goalsTargetedArr = Array.isArray(session.goalsTargeted)
    ? session.goalsTargeted
    : parseJsonField<string[]>(session.goalsTargeted as unknown as string, []);
  const goalsAddressedArr = Array.isArray(session.goalsAddressed)
    ? session.goalsAddressed
    : parseJsonField<string[]>(session.goalsAddressed as unknown as string, []);
  const activitiesUsedArr = Array.isArray(session.activitiesUsed)
    ? session.activitiesUsed
    : parseJsonField<string[]>(session.activitiesUsed as unknown as string, []);
  const performanceDataArr = Array.isArray(session.performanceData)
    ? session.performanceData
    : parseJsonField<PerformanceDataItem[]>(session.performanceData as unknown as string, []);
  const icd10Arr = Array.isArray(session.icd10Codes)
    ? session.icd10Codes
    : parseJsonField<string[]>(session.icd10Codes as unknown as string, []);
  const tsisGroup =
    typeof session.tsisGroup === 'boolean' ? session.tsisGroup : session.tsisGroup === 1;

  db.prepare(`
    UPDATE sessions 
    SET studentId = ?, date = ?, endTime = ?, goalsTargeted = ?, goalsAddressed = ?, activitiesUsed = ?, 
        performanceData = ?, notes = ?, isDirectServices = ?, indirectServicesNotes = ?, 
        groupSessionId = ?, missedSession = ?, selectedSubjectiveStatements = ?, customSubjective = ?, plan = ?,
        scheduledSessionId = ?, tsisGroup = ?, cptCode = ?, icd10Codes = ?
    WHERE id = ?
  `).run(
    session.studentId,
    session.date,
    session.endTime || null,
    stringifyJsonField(goalsTargetedArr),
    stringifyJsonField(goalsAddressedArr),
    stringifyJsonField(activitiesUsedArr),
    stringifyJsonField(performanceDataArr),
    session.notes || '',
    isDirectServices ? 1 : 0,
    session.indirectServicesNotes || null,
    session.groupSessionId || null,
    missedSession ? 1 : 0,
    stringifyJsonField(session.selectedSubjectiveStatements),
    session.customSubjective || null,
    session.plan || null,
    session.scheduledSessionId || null,
    tsisGroup ? 1 : 0,
    session.cptCode || null,
    stringifyJsonField(icd10Arr),
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
