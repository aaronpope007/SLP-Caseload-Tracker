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

/**
 * @openapi
 * /api/goals:
 *   get:
 *     tags: [Goals]
 *     summary: Get all goals
 *     parameters:
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: string
 *         description: Filter by student ID
 *       - in: query
 *         name: school
 *         schema:
 *           type: string
 *         description: Filter by school name
 *     responses:
 *       200:
 *         description: List of goals
 */
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

/**
 * @openapi
 * /api/goals/{id}:
 *   get:
 *     tags: [Goals]
 *     summary: Get goal by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Goal details
 *       404:
 *         description: Goal not found
 */
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

/**
 * @openapi
 * /api/goals:
 *   post:
 *     tags: [Goals]
 *     summary: Create a new goal
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Goal'
 *     responses:
 *       201:
 *         description: Goal created
 *       400:
 *         description: Validation error
 */
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

/**
 * @openapi
 * /api/goals/bulk:
 *   post:
 *     tags: [Goals]
 *     summary: Create or update multiple goals in a single transaction
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               goals:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Goal'
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
goalsRouter.post('/bulk', asyncHandler(async (req, res) => {
  const { goals } = req.body;
  
  if (!Array.isArray(goals)) {
    return res.status(400).json({ error: 'goals must be an array' });
  }
  
  let created = 0;
  let updated = 0;
  const errors: Array<{ id?: string; error: string }> = [];
  
  // Use a transaction for atomicity
  const transaction = db.transaction(() => {
    for (const goal of goals) {
      try {
        // Verify student exists
        const student = db.prepare('SELECT id FROM students WHERE id = ?').get(goal.studentId);
        if (!student) {
          errors.push({ id: goal.id, error: `Student ${goal.studentId} not found` });
          continue;
        }
        
        const existing = db.prepare('SELECT id FROM goals WHERE id = ?').get(goal.id) as { id: string } | undefined;
        
        if (existing) {
          // Update existing goal
          const existingFull = db.prepare('SELECT * FROM goals WHERE id = ?').get(goal.id) as GoalRow | undefined;
          
          if (!existingFull) {
            errors.push({ id: goal.id, error: 'Goal not found for update' });
            continue;
          }
          
          const merged = { 
            ...existingFull, 
            subGoalIds: parseJsonField<string[]>(existingFull.subGoalIds, undefined),
            ...goal 
          };
          
          db.prepare(`
            UPDATE goals 
            SET studentId = ?, description = ?, baseline = ?, target = ?, status = ?, 
                dateAchieved = ?, parentGoalId = ?, subGoalIds = ?, domain = ?, priority = ?, templateId = ?
            WHERE id = ?
          `).run(
            merged.studentId,
            merged.description,
            merged.baseline || '',
            merged.target || '',
            merged.status,
            merged.dateAchieved || null,
            merged.parentGoalId || null,
            stringifyJsonField(merged.subGoalIds),
            merged.domain || null,
            merged.priority || null,
            merged.templateId || null,
            goal.id
          );
          updated++;
        } else {
          // Create new goal
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
          created++;
        }
      } catch (error) {
        errors.push({ 
          id: goal.id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  });
  
  transaction();
  
  res.json({ created, updated, errors });
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
