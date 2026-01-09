import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { parseJsonField, stringifyJsonField } from '../utils/jsonHelpers';
import { createGoalSchema, updateGoalSchema } from '../schemas';

// Database row types
interface GoalRow {
  id: string;
  studentId: string;
  description: string;
  baseline: string;
  target: string;
  status: string;
  dateCreated: string;
  dateAchieved: string | null;
  parentGoalId: string | null;
  subGoalIds: string | null; // JSON string
  domain: string | null;
  priority: string | null;
  templateId: string | null;
}

export const goalsRouter = Router();

// Get all goals (optionally filtered by studentId or school)
goalsRouter.get('/', asyncHandler(async (req, res) => {
  const { studentId, school } = req.query;
  
  let query = 'SELECT * FROM goals';
  const params: string[] = [];
  
  if (studentId && typeof studentId === 'string') {
    query += ' WHERE studentId = ?';
    params.push(studentId);
  } else if (school && typeof school === 'string') {
    // Get goals for students in a specific school
    query = `
      SELECT g.* FROM goals g
      INNER JOIN students s ON g.studentId = s.id
      WHERE s.school = ?
    `;
    params.push(school);
  }
  
  const goals = db.prepare(query).all(...params) as GoalRow[];
  
  // Parse JSON fields
  const parsed = goals.map((g) => ({
    ...g,
    subGoalIds: parseJsonField<string[]>(g.subGoalIds, undefined),
  }));
  
  res.json(parsed);
}));

// Get goal by ID
goalsRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid goal ID' });
  }
  
  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as GoalRow | undefined;
  
  if (!goal) {
    return res.status(404).json({ error: 'Goal not found' });
  }
  
  res.json({
    ...goal,
    subGoalIds: parseJsonField<string[]>(goal.subGoalIds, undefined),
  });
}));

// Create goal - with validation
goalsRouter.post('/', validateBody(createGoalSchema), asyncHandler(async (req, res) => {
  const goal = req.body;
  
  // Verify student exists
  const student = db.prepare('SELECT id FROM students WHERE id = ?').get(goal.studentId);
  if (!student) {
    return res.status(400).json({ error: 'Student not found', details: [{ field: 'studentId', message: 'Student does not exist' }] });
  }
  
  // Generate ID if not provided
  const goalId = goal.id || `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const dateCreated = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO goals (id, studentId, description, baseline, target, status, dateCreated, 
                       dateAchieved, parentGoalId, subGoalIds, domain, priority, templateId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    goalId,
    goal.studentId,
    goal.description,
    goal.baseline || '',
    goal.target || '',
    goal.status || 'in-progress',
    dateCreated,
    goal.dateAchieved || null,
    goal.parentGoalId || null,
    stringifyJsonField(goal.subGoalIds),
    goal.domain || null,
    goal.priority || null,
    goal.templateId || null
  );
  
  res.status(201).json({ id: goalId, message: 'Goal created' });
}));

// Update goal - with validation
goalsRouter.put('/:id', validateBody(updateGoalSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid goal ID' });
  }
  
  const existing = db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as GoalRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Goal not found' });
  }
  
  // If studentId is being updated, verify the new student exists
  if (updates.studentId && updates.studentId !== existing.studentId) {
    const student = db.prepare('SELECT id FROM students WHERE id = ?').get(updates.studentId);
    if (!student) {
      return res.status(400).json({ error: 'Student not found', details: [{ field: 'studentId', message: 'Student does not exist' }] });
    }
  }
  
  const goal = { 
    ...existing, 
    subGoalIds: parseJsonField<string[]>(existing.subGoalIds, undefined),
    ...updates 
  };
  
  db.prepare(`
    UPDATE goals 
    SET studentId = ?, description = ?, baseline = ?, target = ?, status = ?, 
        dateAchieved = ?, parentGoalId = ?, subGoalIds = ?, domain = ?, priority = ?, templateId = ?
    WHERE id = ?
  `).run(
    goal.studentId,
    goal.description,
    goal.baseline || '',
    goal.target || '',
    goal.status,
    goal.dateAchieved || null,
    goal.parentGoalId || null,
    stringifyJsonField(goal.subGoalIds),
    goal.domain || null,
    goal.priority || null,
    goal.templateId || null,
    id
  );
  
  res.json({ message: 'Goal updated' });
}));

// Delete goal
goalsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid goal ID' });
  }
  
  const result = db.prepare('DELETE FROM goals WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Goal not found' });
  }
  
  res.json({ message: 'Goal deleted' });
}));
