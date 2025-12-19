import { Router } from 'express';
import { db } from '../db';

export const activitiesRouter = Router();

// Get all activities
activitiesRouter.get('/', (req, res) => {
  try {
    const activities = db.prepare('SELECT * FROM activities ORDER BY dateCreated DESC').all();
    
    // Parse JSON fields
    const parsed = activities.map((a: any) => ({
      ...a,
      materials: a.materials ? JSON.parse(a.materials) : [],
      isFavorite: a.isFavorite === 1,
    }));
    
    res.json(parsed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get activity by ID
activitiesRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(id) as any;
    
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    res.json({
      ...activity,
      materials: activity.materials ? JSON.parse(activity.materials) : [],
      isFavorite: activity.isFavorite === 1,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create activity
activitiesRouter.post('/', (req, res) => {
  try {
    const activity = req.body;
    
    db.prepare(`
      INSERT INTO activities (id, description, goalArea, ageRange, materials, isFavorite, source, dateCreated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      activity.id,
      activity.description,
      activity.goalArea,
      activity.ageRange,
      JSON.stringify(activity.materials || []),
      activity.isFavorite ? 1 : 0,
      activity.source,
      activity.dateCreated
    );
    
    res.status(201).json({ id: activity.id, message: 'Activity created' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update activity
activitiesRouter.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = db.prepare('SELECT * FROM activities WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    const activity = { ...existing, ...updates };
    
    db.prepare(`
      UPDATE activities 
      SET description = ?, goalArea = ?, ageRange = ?, materials = ?, isFavorite = ?, source = ?
      WHERE id = ?
    `).run(
      activity.description,
      activity.goalArea,
      activity.ageRange,
      JSON.stringify(activity.materials || []),
      activity.isFavorite ? 1 : 0,
      activity.source,
      id
    );
    
    res.json({ message: 'Activity updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete activity
activitiesRouter.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM activities WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    res.json({ message: 'Activity deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

