import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { createEvaluationSchema, updateEvaluationSchema } from '../schemas';

// Database row types
interface EvaluationRow {
  id: string;
  studentId: string;
  grade: string;
  evaluationType: string;
  areasOfConcern: string;
  teacher: string | null;
  resultsOfScreening: string | null;
  dueDate: string | null;
  assessments: string | null;
  qualify: string | null;
  reportCompleted: string | null;
  iepCompleted: string | null;
  meetingDate: string | null;
  dateCreated: string;
  dateUpdated: string;
}

export const evaluationsRouter = Router();

// Get all evaluations (optionally filtered by studentId or school)
evaluationsRouter.get('/', asyncHandler(async (req, res) => {
  const { studentId, school } = req.query;
  
  let query = 'SELECT * FROM evaluations';
  const params: string[] = [];
  
  if (studentId && typeof studentId === 'string') {
    query += ' WHERE studentId = ? ORDER BY dateCreated DESC';
    params.push(studentId);
  } else if (school && typeof school === 'string') {
    query = `
      SELECT e.* FROM evaluations e
      INNER JOIN students s ON e.studentId = s.id
      WHERE s.school = ?
      ORDER BY e.dateCreated DESC
    `;
    params.push(school);
  } else {
    query += ' ORDER BY dateCreated DESC';
  }
  
  const evaluations = db.prepare(query).all(...params) as EvaluationRow[];
  res.json(evaluations);
}));

// Get evaluation by ID
evaluationsRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid evaluation ID' });
  }
  
  const evaluation = db.prepare('SELECT * FROM evaluations WHERE id = ?').get(id) as EvaluationRow | undefined;
  
  if (!evaluation) {
    return res.status(404).json({ error: 'Evaluation not found' });
  }
  
  res.json(evaluation);
}));

// Create evaluation - with validation
evaluationsRouter.post('/', validateBody(createEvaluationSchema), asyncHandler(async (req, res) => {
  const evaluation = req.body;
  
  // Verify student exists
  const student = db.prepare('SELECT id FROM students WHERE id = ?').get(evaluation.studentId);
  if (!student) {
    return res.status(400).json({ error: 'Student not found', details: [{ field: 'studentId', message: 'Student does not exist' }] });
  }
  
  // Generate ID if not provided
  const evaluationId = evaluation.id || `eval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO evaluations (id, studentId, grade, evaluationType, areasOfConcern, teacher, 
                             resultsOfScreening, dueDate, assessments, qualify, reportCompleted, 
                             iepCompleted, meetingDate, dateCreated, dateUpdated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    evaluationId,
    evaluation.studentId,
    evaluation.grade || '',
    evaluation.evaluationType,
    evaluation.areasOfConcern || '',
    evaluation.teacher || null,
    evaluation.resultsOfScreening || null,
    evaluation.dueDate || null,
    evaluation.assessments || null,
    evaluation.qualify || null,
    evaluation.reportCompleted || null,
    evaluation.iepCompleted || null,
    evaluation.meetingDate || null,
    now,
    now
  );
  
  res.status(201).json({ id: evaluationId, message: 'Evaluation created' });
}));

// Update evaluation - with validation
evaluationsRouter.put('/:id', validateBody(updateEvaluationSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid evaluation ID' });
  }
  
  const existing = db.prepare('SELECT * FROM evaluations WHERE id = ?').get(id) as EvaluationRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Evaluation not found' });
  }
  
  // If studentId is being updated, verify the new student exists
  if (updates.studentId && updates.studentId !== existing.studentId) {
    const student = db.prepare('SELECT id FROM students WHERE id = ?').get(updates.studentId);
    if (!student) {
      return res.status(400).json({ error: 'Student not found', details: [{ field: 'studentId', message: 'Student does not exist' }] });
    }
  }
  
  const evaluation = { ...existing, ...updates, dateUpdated: new Date().toISOString() };
  
  db.prepare(`
    UPDATE evaluations 
    SET studentId = ?, grade = ?, evaluationType = ?, areasOfConcern = ?, teacher = ?, 
        resultsOfScreening = ?, dueDate = ?, assessments = ?, qualify = ?, reportCompleted = ?, 
        iepCompleted = ?, meetingDate = ?, dateUpdated = ?
    WHERE id = ?
  `).run(
    evaluation.studentId,
    evaluation.grade || '',
    evaluation.evaluationType,
    evaluation.areasOfConcern || '',
    evaluation.teacher || null,
    evaluation.resultsOfScreening || null,
    evaluation.dueDate || null,
    evaluation.assessments || null,
    evaluation.qualify || null,
    evaluation.reportCompleted || null,
    evaluation.iepCompleted || null,
    evaluation.meetingDate || null,
    evaluation.dateUpdated,
    id
  );
  
  res.json({ message: 'Evaluation updated' });
}));

// Delete evaluation
evaluationsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid evaluation ID' });
  }
  
  const result = db.prepare('DELETE FROM evaluations WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Evaluation not found' });
  }
  
  res.json({ message: 'Evaluation deleted' });
}));
