import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { parseJsonField, stringifyJsonField } from '../utils/jsonHelpers';

// Database row types
interface ActivityRow {
  id: string;
  description: string;
  goalArea: string;
  ageRange: string;
  materials: string; // JSON string
  isFavorite: number;
  source: string;
  dateCreated: string;
}

export const activitiesRouter = Router();

// Get all activities
activitiesRouter.get('/', asyncHandler(async (req, res) => {
  const activities = db.prepare('SELECT * FROM activities ORDER BY dateCreated DESC').all() as ActivityRow[];
  
  // Parse JSON fields
  const parsed = activities.map((a) => ({
    ...a,
    materials: parseJsonField<string[]>(a.materials, []),
    isFavorite: a.isFavorite === 1,
  }));
  
  res.json(parsed);
}));

// Get activity by ID
activitiesRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(id) as ActivityRow | undefined;
  
  if (!activity) {
    return res.status(404).json({ error: 'Activity not found' });
  }
  
  res.json({
    ...activity,
    materials: parseJsonField<string[]>(activity.materials, []),
    isFavorite: activity.isFavorite === 1,
  });
}));

// Create activity
activitiesRouter.post('/', asyncHandler(async (req, res) => {
  const activity = req.body;
  
  db.prepare(`
    INSERT INTO activities (id, description, goalArea, ageRange, materials, isFavorite, source, dateCreated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    activity.id,
    activity.description,
    activity.goalArea,
    activity.ageRange,
    stringifyJsonField(activity.materials || []),
    activity.isFavorite ? 1 : 0,
    activity.source,
    activity.dateCreated
  );
  
  res.status(201).json({ id: activity.id, message: 'Activity created' });
}));

// Update activity
activitiesRouter.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const existing = db.prepare('SELECT * FROM activities WHERE id = ?').get(id) as ActivityRow | undefined;
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
    stringifyJsonField(activity.materials || []),
    activity.isFavorite ? 1 : 0,
    activity.source,
    id
  );
  
  res.json({ message: 'Activity updated' });
}));

// Delete activity
activitiesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM activities WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Activity not found' });
  }
  
  res.json({ message: 'Activity deleted' });
}));

