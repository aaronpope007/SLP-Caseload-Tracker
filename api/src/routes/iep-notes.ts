import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { createIEPNoteSchema, updateIEPNoteSchema } from '../schemas';

interface IEPNoteRow {
  id: string;
  studentId: string;
  previousNote: string;
  generatedNote: string;
  dateCreated: string;
  dateUpdated: string;
}

export const iepNotesRouter = Router();

// Get all IEP notes (optionally filtered by studentId)
iepNotesRouter.get('/', asyncHandler(async (req, res) => {
  const { studentId } = req.query;

  let query = 'SELECT * FROM iep_notes';
  const params: string[] = [];

  if (studentId && typeof studentId === 'string') {
    query += ' WHERE studentId = ? ORDER BY dateUpdated DESC';
    params.push(studentId);
  } else {
    query += ' ORDER BY dateUpdated DESC';
  }

  const notes = db.prepare(query).all(...params) as IEPNoteRow[];
  res.json(notes);
}));

// Get IEP note by ID
iepNotesRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid IEP note ID' });
  }

  const note = db.prepare('SELECT * FROM iep_notes WHERE id = ?').get(id) as IEPNoteRow | undefined;

  if (!note) {
    return res.status(404).json({ error: 'IEP note not found' });
  }

  res.json(note);
}));

// Create IEP note
iepNotesRouter.post('/', validateBody(createIEPNoteSchema), asyncHandler(async (req, res) => {
  const body = req.body;

  const student = db.prepare('SELECT id FROM students WHERE id = ?').get(body.studentId);
  if (!student) {
    return res.status(400).json({ error: 'Student not found', details: [{ field: 'studentId', message: 'Student does not exist' }] });
  }

  const noteId = body.id || `iep-note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO iep_notes (id, studentId, previousNote, generatedNote, dateCreated, dateUpdated)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    noteId,
    body.studentId,
    body.previousNote ?? '',
    body.generatedNote ?? '',
    now,
    now
  );

  res.status(201).json({ id: noteId, message: 'IEP note created' });
}));

// Update IEP note
iepNotesRouter.put('/:id', validateBody(updateIEPNoteSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid IEP note ID' });
  }

  const existing = db.prepare('SELECT * FROM iep_notes WHERE id = ?').get(id) as IEPNoteRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'IEP note not found' });
  }

  const previousNote = updates.previousNote !== undefined ? updates.previousNote : existing.previousNote;
  const generatedNote = updates.generatedNote !== undefined ? updates.generatedNote : existing.generatedNote;
  const dateUpdated = new Date().toISOString();

  const result = db.prepare(`
    UPDATE iep_notes SET previousNote = ?, generatedNote = ?, dateUpdated = ? WHERE id = ?
  `).run(previousNote, generatedNote, dateUpdated, id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'IEP note not found or no changes made' });
  }

  res.json({ message: 'IEP note updated' });
}));

// Delete IEP note
iepNotesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid IEP note ID' });
  }

  const result = db.prepare('DELETE FROM iep_notes WHERE id = ?').run(id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'IEP note not found' });
  }

  res.json({ message: 'IEP note deleted' });
}));
