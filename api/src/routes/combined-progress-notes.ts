import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';

// Database row types
interface CombinedProgressNoteRow {
  id: string;
  studentId: string;
  content: string;
  selectedGoalIds: string | null;
  dateCreated: string;
  dateUpdated: string;
}

export const combinedProgressNotesRouter = Router();

// Get all combined progress notes (filterable by studentId)
combinedProgressNotesRouter.get('/', asyncHandler(async (req, res) => {
  const { studentId } = req.query;
  
  let query = 'SELECT * FROM combined_progress_notes';
  const params: string[] = [];
  const conditions: string[] = [];

  if (studentId && typeof studentId === 'string') {
    conditions.push('studentId = ?');
    params.push(studentId);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY dateUpdated DESC';

  const notes = db.prepare(query).all(...params) as CombinedProgressNoteRow[];

  res.json(notes);
}));

// Get combined progress note by ID
combinedProgressNotesRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid note ID' });
  }
  
  const note = db.prepare('SELECT * FROM combined_progress_notes WHERE id = ?').get(id) as CombinedProgressNoteRow | undefined;
  
  if (!note) {
    return res.status(404).json({ error: 'Combined progress note not found' });
  }
  
  res.json(note);
}));

// Create combined progress note
combinedProgressNotesRouter.post('/', asyncHandler(async (req, res) => {
  const note = req.body;
  
  if (!note.studentId || !note.content) {
    return res.status(400).json({ error: 'studentId and content are required' });
  }

  // Verify student exists
  const student = db.prepare('SELECT id FROM students WHERE id = ?').get(note.studentId);
  if (!student) {
    return res.status(400).json({ error: 'Student not found' });
  }
  
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO combined_progress_notes (
      id, studentId, content, selectedGoalIds, dateCreated, dateUpdated
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    note.id,
    note.studentId,
    note.content,
    note.selectedGoalIds || null,
    now,
    now
  );
  
  res.status(201).json({ id: note.id, message: 'Combined progress note created' });
}));

// Update combined progress note
combinedProgressNotesRouter.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid note ID' });
  }
  
  const existing = db.prepare('SELECT * FROM combined_progress_notes WHERE id = ?').get(id) as CombinedProgressNoteRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Combined progress note not found' });
  }
  
  const note = { ...existing, ...updates, dateUpdated: new Date().toISOString() };
  
  db.prepare(`
    UPDATE combined_progress_notes 
    SET studentId = ?, content = ?, selectedGoalIds = ?, dateUpdated = ?
    WHERE id = ?
  `).run(
    note.studentId,
    note.content,
    note.selectedGoalIds || null,
    note.dateUpdated,
    id
  );
  
  res.json({ message: 'Combined progress note updated' });
}));

// Delete combined progress note
combinedProgressNotesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid note ID' });
  }
  
  const result = db.prepare('DELETE FROM combined_progress_notes WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Combined progress note not found' });
  }
  
  res.json({ message: 'Combined progress note deleted' });
}));
