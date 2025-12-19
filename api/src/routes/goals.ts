import { Router } from 'express';
import { db } from '../db';

export const goalsRouter = Router();

// Get all goals (optionally filtered by studentId or school)
goalsRouter.get('/', (req, res) => {
  try {
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
    
    const goals = db.prepare(query).all(...params);
    
    // Parse JSON fields
    const parsed = goals.map((g: any) => ({
      ...g,
      subGoalIds: g.subGoalIds ? JSON.parse(g.subGoalIds) : undefined,
    }));
    
    res.json(parsed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get goal by ID
goalsRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as any;
    
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    res.json({
      ...goal,
      subGoalIds: goal.subGoalIds ? JSON.parse(goal.subGoalIds) : undefined,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create goal
goalsRouter.post('/', (req, res) => {
  try {
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
      goal.subGoalIds ? JSON.stringify(goal.subGoalIds) : null,
      goal.domain || null,
      goal.priority || null,
      goal.templateId || null
    );
    
    res.status(201).json({ id: goal.id, message: 'Goal created' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update goal
goalsRouter.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as any;
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
      goal.subGoalIds ? JSON.stringify(goal.subGoalIds) : null,
      goal.domain || null,
      goal.priority || null,
      goal.templateId || null,
      id
    );
    
    res.json({ message: 'Goal updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete goal
goalsRouter.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM goals WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    res.json({ message: 'Goal deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

