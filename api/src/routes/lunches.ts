import { Router } from 'express';
import { db } from '../db';

export const lunchesRouter = Router();

// Get all lunches (optionally filtered by school)
lunchesRouter.get('/', (req, res) => {
  try {
    const { school } = req.query;
    
    let query = 'SELECT * FROM lunches';
    const params: string[] = [];
    
    if (school && typeof school === 'string' && school.trim()) {
      query += ' WHERE school = ?';
      params.push(school.trim());
    }
    
    query += ' ORDER BY startTime DESC';
    
    const lunches = db.prepare(query).all(...params);
    res.json(lunches);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get lunch by ID
lunchesRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const lunch = db.prepare('SELECT * FROM lunches WHERE id = ?').get(id);
    
    if (!lunch) {
      return res.status(404).json({ error: 'Lunch not found' });
    }
    
    res.json(lunch);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create lunch
lunchesRouter.post('/', (req, res) => {
  try {
    const lunch = req.body;
    
    db.prepare(`
      INSERT INTO lunches (id, school, startTime, endTime, dateCreated)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      lunch.id,
      lunch.school,
      lunch.startTime,
      lunch.endTime,
      lunch.dateCreated
    );
    
    res.status(201).json({ id: lunch.id, message: 'Lunch created' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update lunch
lunchesRouter.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = db.prepare('SELECT * FROM lunches WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Lunch not found' });
    }
    
    const lunch = { ...existing, ...updates };
    
    db.prepare(`
      UPDATE lunches 
      SET school = ?, startTime = ?, endTime = ?
      WHERE id = ?
    `).run(
      lunch.school,
      lunch.startTime,
      lunch.endTime,
      id
    );
    
    res.json({ message: 'Lunch updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete lunch
lunchesRouter.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM lunches WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Lunch not found' });
    }
    
    res.json({ message: 'Lunch deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

