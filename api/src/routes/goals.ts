import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { parseJsonField, stringifyJsonField } from '../utils/jsonHelpers';

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
  
  if (studentId) {
    query += ' WHERE studentId = ?';
    params.push(studentId as string);
  } else if (school) {
    // Get goals for students in a specific school
    query = `
      SELECT g.* FROM goals g
      INNER JOIN students s ON g.studentId = s.id
      WHERE s.school = ?
    `;
    params.push(school as string);
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
  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as GoalRow | undefined;
  
  if (!goal) {
    return res.status(404).json({ error: 'Goal not found' });
  }
  
  res.json({
    ...goal,
    subGoalIds: parseJsonField<string[]>(goal.subGoalIds, undefined),
  });
}));

// Create goal
goalsRouter.post('/', asyncHandler(async (req, res) => {
  const goal = req.body;
  
  db.prepare(`
    INSERT INTO goals (id, studentId, description, baseline, target, status, dateCreated, 
                       dateAchieved, parentGoalId, subGoalIds, domain, priority, templateId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    goal.id,
    goal.studentId,
    goal.description,
    goal.baseline,
    goal.target,
    goal.status,
    goal.dateCreated,
    goal.dateAchieved || null,
    goal.parentGoalId || null,
    stringifyJsonField(goal.subGoalIds),
    goal.domain || null,
    goal.priority || null,
    goal.templateId || null
  );
  
  res.status(201).json({ id: goal.id, message: 'Goal created' });
}));

// Update goal
goalsRouter.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const existing = db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as GoalRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Goal not found' });
  }
  
  const goal = { ...existing, ...updates };
  
  db.prepare(`
    UPDATE goals 
    SET studentId = ?, description = ?, baseline = ?, target = ?, status = ?, 
        dateAchieved = ?, parentGoalId = ?, subGoalIds = ?, domain = ?, priority = ?, templateId = ?
    WHERE id = ?
  `).run(
    goal.studentId,
    goal.description,
    goal.baseline,
    goal.target,
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
  const result = db.prepare('DELETE FROM goals WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Goal not found' });
  }
  
  res.json({ message: 'Goal deleted' });
}));

