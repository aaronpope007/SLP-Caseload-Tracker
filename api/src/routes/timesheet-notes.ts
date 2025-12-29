import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';

// Database row types
interface TimesheetNoteRow {
  id: string;
  content: string;
  dateCreated: string;
  dateFor: string | null;
  school: string;
}

export const timesheetNotesRouter = Router();

// Get all timesheet notes (optionally filtered by school)
timesheetNotesRouter.get('/', asyncHandler(async (req, res) => {
  const { school } = req.query;
  
  let query = 'SELECT * FROM timesheet_notes';
  const params: string[] = [];
  
  if (school) {
    query += ' WHERE school = ? ORDER BY dateCreated DESC';
    params.push(school as string);
  } else {
    query += ' ORDER BY dateCreated DESC';
  }
  
  const notes = db.prepare(query).all(...params) as TimesheetNoteRow[];
  
  res.json(notes.map(row => ({
    id: row.id,
    content: row.content,
    dateCreated: row.dateCreated,
    dateFor: row.dateFor || undefined,
    school: row.school,
  })));
}));

// Get timesheet note by ID
timesheetNotesRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const note = db.prepare('SELECT * FROM timesheet_notes WHERE id = ?').get(id) as TimesheetNoteRow | undefined;
  
  if (!note) {
    return res.status(404).json({ error: 'Timesheet note not found' });
  }
  
  res.json({
    id: note.id,
    content: note.content,
    dateCreated: note.dateCreated,
    dateFor: note.dateFor || undefined,
    school: note.school,
  });
}));

// Create timesheet note
timesheetNotesRouter.post('/', asyncHandler(async (req, res) => {
  const note = req.body;
  
  db.prepare(`
    INSERT INTO timesheet_notes (id, content, dateCreated, dateFor, school)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    note.id,
    note.content,
    note.dateCreated,
    note.dateFor || null,
    note.school
  );
  
  res.status(201).json({ id: note.id, message: 'Timesheet note created' });
}));

// Update timesheet note
timesheetNotesRouter.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const existing = db.prepare('SELECT * FROM timesheet_notes WHERE id = ?').get(id) as TimesheetNoteRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Timesheet note not found' });
  }
  
  // Merge updates with existing data
  const note = {
    content: updates.content !== undefined ? updates.content : existing.content,
    dateFor: updates.dateFor !== undefined ? updates.dateFor : existing.dateFor,
    school: updates.school !== undefined ? updates.school : existing.school,
  };
  
  db.prepare(`
    UPDATE timesheet_notes 
    SET content = ?, dateFor = ?, school = ?
    WHERE id = ?
  `).run(
    note.content,
    note.dateFor || null,
    note.school,
    id
  );
  
  res.json({ message: 'Timesheet note updated' });
}));

// Delete timesheet note
timesheetNotesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = db.prepare('DELETE FROM timesheet_notes WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Timesheet note not found' });
  }
  
  res.json({ message: 'Timesheet note deleted' });
}));

