import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { createArticulationScreenerSchema, updateArticulationScreenerSchema } from '../schemas';

// Database row types
interface ArticulationScreenerRow {
  id: string;
  studentId: string;
  date: string;
  disorderedPhonemes: string; // JSON string
  report: string | null;
  evaluationId: string | null;
  dateCreated: string;
  dateUpdated: string;
}

export const articulationScreenersRouter = Router();

// Get all articulation screeners (optionally filtered by studentId or school)
articulationScreenersRouter.get('/', asyncHandler(async (req, res) => {
  const { studentId, school } = req.query;
  
  let query = 'SELECT * FROM articulation_screeners';
  const params: string[] = [];
  
  if (studentId && typeof studentId === 'string') {
    query += ' WHERE studentId = ? ORDER BY date DESC, dateCreated DESC';
    params.push(studentId);
  } else if (school && typeof school === 'string') {
    query = `
      SELECT a.* FROM articulation_screeners a
      INNER JOIN students s ON a.studentId = s.id
      WHERE s.school = ?
      ORDER BY a.date DESC, a.dateCreated DESC
    `;
    params.push(school);
  } else {
    query += ' ORDER BY date DESC, dateCreated DESC';
  }
  
  const screeners = db.prepare(query).all(...params) as ArticulationScreenerRow[];
  
  // Parse JSON strings to objects
  const parsedScreeners = screeners.map(screener => ({
    ...screener,
    disorderedPhonemes: JSON.parse(screener.disorderedPhonemes),
  }));
  
  res.json(parsedScreeners);
}));

// Get articulation screener by ID
articulationScreenersRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid screener ID' });
  }
  
  const screener = db.prepare('SELECT * FROM articulation_screeners WHERE id = ?').get(id) as ArticulationScreenerRow | undefined;
  
  if (!screener) {
    return res.status(404).json({ error: 'Articulation screener not found' });
  }
  
  // Parse JSON string to object
  const parsedScreener = {
    ...screener,
    disorderedPhonemes: JSON.parse(screener.disorderedPhonemes),
  };
  
  res.json(parsedScreener);
}));

// Create articulation screener - with validation
articulationScreenersRouter.post('/', validateBody(createArticulationScreenerSchema), asyncHandler(async (req, res) => {
  const screener = req.body;
  
  // Verify student exists
  const student = db.prepare('SELECT id FROM students WHERE id = ?').get(screener.studentId);
  if (!student) {
    return res.status(400).json({ error: 'Student not found', details: [{ field: 'studentId', message: 'Student does not exist' }] });
  }
  
  // Verify evaluation exists if provided
  if (screener.evaluationId) {
    const evaluation = db.prepare('SELECT id FROM evaluations WHERE id = ?').get(screener.evaluationId);
    if (!evaluation) {
      return res.status(400).json({ error: 'Evaluation not found', details: [{ field: 'evaluationId', message: 'Evaluation does not exist' }] });
    }
  }
  
  // Generate ID if not provided
  const screenerId = screener.id || `screener-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  // Convert disorderedPhonemes array to JSON string
  const disorderedPhonemesJson = JSON.stringify(screener.disorderedPhonemes || []);
  
  db.prepare(`
    INSERT INTO articulation_screeners (id, studentId, date, disorderedPhonemes, report, evaluationId, dateCreated, dateUpdated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    screenerId,
    screener.studentId,
    screener.date,
    disorderedPhonemesJson,
    screener.report || null,
    screener.evaluationId || null,
    now,
    now
  );
  
  res.status(201).json({ id: screenerId, message: 'Articulation screener created' });
}));

// Update articulation screener - with validation
articulationScreenersRouter.put('/:id', validateBody(updateArticulationScreenerSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid screener ID' });
  }
  
  const existing = db.prepare('SELECT * FROM articulation_screeners WHERE id = ?').get(id) as ArticulationScreenerRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Articulation screener not found' });
  }
  
  // If studentId is being updated, verify the new student exists
  if (updates.studentId && updates.studentId !== existing.studentId) {
    const student = db.prepare('SELECT id FROM students WHERE id = ?').get(updates.studentId);
    if (!student) {
      return res.status(400).json({ error: 'Student not found', details: [{ field: 'studentId', message: 'Student does not exist' }] });
    }
  }
  
  // If evaluationId is being updated, verify the new evaluation exists
  if (updates.evaluationId !== undefined && updates.evaluationId !== existing.evaluationId) {
    if (updates.evaluationId) {
      const evaluation = db.prepare('SELECT id FROM evaluations WHERE id = ?').get(updates.evaluationId);
      if (!evaluation) {
        return res.status(400).json({ error: 'Evaluation not found', details: [{ field: 'evaluationId', message: 'Evaluation does not exist' }] });
      }
    }
  }
  
  // Parse existing disorderedPhonemes
  const existingPhonemes = JSON.parse(existing.disorderedPhonemes);
  
  // Merge updates
  const updatedScreener = { ...existing, ...updates, dateUpdated: new Date().toISOString() };
  
  // Convert disorderedPhonemes array to JSON string if updated
  const disorderedPhonemesJson = updates.disorderedPhonemes 
    ? JSON.stringify(updates.disorderedPhonemes)
    : existing.disorderedPhonemes;
  
  db.prepare(`
    UPDATE articulation_screeners 
    SET studentId = ?, date = ?, disorderedPhonemes = ?, report = ?, evaluationId = ?, dateUpdated = ?
    WHERE id = ?
  `).run(
    updatedScreener.studentId,
    updatedScreener.date,
    disorderedPhonemesJson,
    updatedScreener.report || null,
    updatedScreener.evaluationId || null,
    updatedScreener.dateUpdated,
    id
  );
  
  res.json({ message: 'Articulation screener updated' });
}));

// Delete articulation screener
articulationScreenersRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid screener ID' });
  }
  
  const result = db.prepare('DELETE FROM articulation_screeners WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Articulation screener not found' });
  }
  
  res.json({ message: 'Articulation screener deleted' });
}));

