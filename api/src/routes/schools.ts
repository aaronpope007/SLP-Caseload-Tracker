import { Router } from 'express';
import { db } from '../db';

export const schoolsRouter = Router();

// Get all schools
schoolsRouter.get('/', (req, res) => {
  try {
    const schools = db.prepare('SELECT * FROM schools ORDER BY name').all();
    
    // Parse boolean
    const parsed = schools.map((s: any) => ({
      ...s,
      teletherapy: s.teletherapy === 1,
    }));
    
    res.json(parsed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get school by ID
schoolsRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(id) as any;
    
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }
    
    res.json({
      ...school,
      teletherapy: school.teletherapy === 1,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get school by name
schoolsRouter.get('/name/:name', (req, res) => {
  try {
    const { name } = req.params;
    const school = db.prepare('SELECT * FROM schools WHERE name = ?').get(name) as any;
    
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }
    
    res.json({
      ...school,
      teletherapy: school.teletherapy === 1,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create school
schoolsRouter.post('/', (req, res) => {
  try {
    const school = req.body;
    
    db.prepare(`
      INSERT INTO schools (id, name, state, teletherapy, dateCreated)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      school.id,
      school.name,
      school.state,
      school.teletherapy ? 1 : 0,
      school.dateCreated
    );
    
    res.status(201).json({ id: school.id, message: 'School created' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update school
schoolsRouter.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = db.prepare('SELECT * FROM schools WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'School not found' });
    }
    
    const school = { ...existing, ...updates };
    
    db.prepare(`
      UPDATE schools 
      SET name = ?, state = ?, teletherapy = ?
      WHERE id = ?
    `).run(
      school.name,
      school.state,
      school.teletherapy ? 1 : 0,
      id
    );
    
    res.json({ message: 'School updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete school
schoolsRouter.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM schools WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'School not found' });
    }
    
    res.json({ message: 'School deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

