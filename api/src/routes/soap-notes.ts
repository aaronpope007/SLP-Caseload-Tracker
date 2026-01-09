import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { createSOAPNoteSchema, updateSOAPNoteSchema } from '../schemas';

// Database row types
interface SOAPNoteRow {
  id: string;
  sessionId: string;
  studentId: string;
  date: string;
  templateId: string | null;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  dateCreated: string;
  dateUpdated: string;
}

export const soapNotesRouter = Router();

// Get all SOAP notes (optionally filtered by studentId or sessionId)
soapNotesRouter.get('/', asyncHandler(async (req, res) => {
  const { studentId, sessionId } = req.query;
  
  let query = 'SELECT * FROM soap_notes';
  const params: string[] = [];
  
  if (sessionId && typeof sessionId === 'string') {
    query += ' WHERE sessionId = ? ORDER BY date DESC';
    params.push(sessionId);
  } else if (studentId && typeof studentId === 'string') {
    query += ' WHERE studentId = ? ORDER BY date DESC';
    params.push(studentId);
  } else {
    query += ' ORDER BY date DESC';
  }
  
  const soapNotes = db.prepare(query).all(...params) as SOAPNoteRow[];
  res.json(soapNotes);
}));

// Get SOAP note by ID
soapNotesRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid SOAP note ID' });
  }
  
  const soapNote = db.prepare('SELECT * FROM soap_notes WHERE id = ?').get(id) as SOAPNoteRow | undefined;
  
  if (!soapNote) {
    return res.status(404).json({ error: 'SOAP note not found' });
  }
  
  res.json(soapNote);
}));

// Create SOAP note - with validation
soapNotesRouter.post('/', validateBody(createSOAPNoteSchema), asyncHandler(async (req, res) => {
  const soapNote = req.body;
  
  // Verify session exists
  const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(soapNote.sessionId);
  if (!session) {
    return res.status(400).json({ error: 'Session not found', details: [{ field: 'sessionId', message: 'Session does not exist' }] });
  }
  
  // Verify student exists
  const student = db.prepare('SELECT id FROM students WHERE id = ?').get(soapNote.studentId);
  if (!student) {
    return res.status(400).json({ error: 'Student not found', details: [{ field: 'studentId', message: 'Student does not exist' }] });
  }
  
  // Generate ID if not provided
  const noteId = soapNote.id || `soap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO soap_notes (id, sessionId, studentId, date, templateId, subjective, 
                           objective, assessment, plan, dateCreated, dateUpdated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    noteId,
    soapNote.sessionId,
    soapNote.studentId,
    soapNote.date,
    soapNote.templateId || null,
    soapNote.subjective || '',
    soapNote.objective || '',
    soapNote.assessment || '',
    soapNote.plan || '',
    now,
    now
  );
  
  res.status(201).json({ id: noteId, message: 'SOAP note created' });
}));

// Update SOAP note - with validation
soapNotesRouter.put('/:id', validateBody(updateSOAPNoteSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid SOAP note ID' });
  }
  
  const existing = db.prepare('SELECT * FROM soap_notes WHERE id = ?').get(id) as SOAPNoteRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'SOAP note not found' });
  }
  
  // Merge updates with existing data, ensuring we preserve required fields
  const soapNote = {
    sessionId: updates.sessionId !== undefined ? updates.sessionId : existing.sessionId,
    studentId: updates.studentId !== undefined ? updates.studentId : existing.studentId,
    date: updates.date !== undefined ? updates.date : existing.date,
    templateId: updates.templateId !== undefined ? updates.templateId : existing.templateId,
    subjective: updates.subjective !== undefined ? updates.subjective : existing.subjective,
    objective: updates.objective !== undefined ? updates.objective : existing.objective,
    assessment: updates.assessment !== undefined ? updates.assessment : existing.assessment,
    plan: updates.plan !== undefined ? updates.plan : existing.plan,
    dateUpdated: new Date().toISOString(),
  };
  
  const result = db.prepare(`
    UPDATE soap_notes 
    SET sessionId = ?, studentId = ?, date = ?, templateId = ?, subjective = ?, 
        objective = ?, assessment = ?, plan = ?, dateUpdated = ?
    WHERE id = ?
  `).run(
    soapNote.sessionId,
    soapNote.studentId,
    soapNote.date,
    soapNote.templateId || null,
    soapNote.subjective || '',
    soapNote.objective || '',
    soapNote.assessment || '',
    soapNote.plan || '',
    soapNote.dateUpdated,
    id
  );
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'SOAP note not found or no changes made' });
  }
  
  res.json({ message: 'SOAP note updated' });
}));

// Delete SOAP note
soapNotesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid SOAP note ID' });
  }
  
  const result = db.prepare('DELETE FROM soap_notes WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'SOAP note not found' });
  }
  
  res.json({ message: 'SOAP note deleted' });
}));
