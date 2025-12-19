import { Router } from 'express';
import { db } from '../db';

export const evaluationsRouter = Router();

// Get all evaluations (optionally filtered by studentId or school)
evaluationsRouter.get('/', (req, res) => {
  try {
    const { studentId, school } = req.query;
    
    let query = 'SELECT * FROM evaluations';
    const params: string[] = [];
    
    if (studentId) {
      query += ' WHERE studentId = ? ORDER BY dateCreated DESC';
      params.push(studentId as string);
    } else if (school) {
      query = `
        SELECT e.* FROM evaluations e
        INNER JOIN students s ON e.studentId = s.id
        WHERE s.school = ?
        ORDER BY e.dateCreated DESC
      `;
      params.push(school as string);
    } else {
      query += ' ORDER BY dateCreated DESC';
    }
    
    const evaluations = db.prepare(query).all(...params);
    res.json(evaluations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get evaluation by ID
evaluationsRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const evaluation = db.prepare('SELECT * FROM evaluations WHERE id = ?').get(id);
    
    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }
    
    res.json(evaluation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create evaluation
evaluationsRouter.post('/', (req, res) => {
  try {
    const evaluation = req.body;
    
    db.prepare(`
      INSERT INTO evaluations (id, studentId, grade, evaluationType, areasOfConcern, teacher, 
                               resultsOfScreening, dueDate, assessments, qualify, reportCompleted, 
                               iepCompleted, meetingDate, dateCreated, dateUpdated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      evaluation.id,
      evaluation.studentId,
      evaluation.grade,
      evaluation.evaluationType,
      evaluation.areasOfConcern,
      evaluation.teacher || null,
      evaluation.resultsOfScreening || null,
      evaluation.dueDate || null,
      evaluation.assessments || null,
      evaluation.qualify || null,
      evaluation.reportCompleted || null,
      evaluation.iepCompleted || null,
      evaluation.meetingDate || null,
      evaluation.dateCreated,
      evaluation.dateUpdated
    );
    
    res.status(201).json({ id: evaluation.id, message: 'Evaluation created' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update evaluation
evaluationsRouter.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = db.prepare('SELECT * FROM evaluations WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Evaluation not found' });
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
      evaluation.grade,
      evaluation.evaluationType,
      evaluation.areasOfConcern,
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete evaluation
evaluationsRouter.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM evaluations WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }
    
    res.json({ message: 'Evaluation deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

