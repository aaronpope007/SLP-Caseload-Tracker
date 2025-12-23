import { Router } from 'express';
import { db } from '../db';

export const teachersRouter = Router();

// Get all teachers
teachersRouter.get('/', (req, res) => {
  try {
    const teachers = db.prepare('SELECT * FROM teachers ORDER BY name').all();
    res.json(teachers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get teacher by ID
teachersRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(id) as any;
    
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    res.json(teacher);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create teacher
teachersRouter.post('/', (req, res) => {
  try {
    const teacher = req.body;
    
    db.prepare(`
      INSERT INTO teachers (id, name, grade, phoneNumber, emailAddress, dateCreated)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      teacher.id,
      teacher.name,
      teacher.grade,
      teacher.phoneNumber || null,
      teacher.emailAddress || null,
      teacher.dateCreated
    );
    
    res.status(201).json({ id: teacher.id, message: 'Teacher created' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update teacher
teachersRouter.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = db.prepare('SELECT * FROM teachers WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    const teacher = { ...existing, ...updates };
    
    db.prepare(`
      UPDATE teachers 
      SET name = ?, grade = ?, phoneNumber = ?, emailAddress = ?
      WHERE id = ?
    `).run(
      teacher.name,
      teacher.grade,
      teacher.phoneNumber || null,
      teacher.emailAddress || null,
      id
    );
    
    res.json({ message: 'Teacher updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete teacher
teachersRouter.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM teachers WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    res.json({ message: 'Teacher deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

