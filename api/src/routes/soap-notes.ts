import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';

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
  
  if (sessionId) {
    query += ' WHERE sessionId = ? ORDER BY date DESC';
    params.push(sessionId as string);
  } else if (studentId) {
    query += ' WHERE studentId = ? ORDER BY date DESC';
    params.push(studentId as string);
  } else {
    query += ' ORDER BY date DESC';
  }
  
  const soapNotes = db.prepare(query).all(...params) as SOAPNoteRow[];
  res.json(soapNotes);
}));

// Get SOAP note by ID
soapNotesRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const soapNote = db.prepare('SELECT * FROM soap_notes WHERE id = ?').get(id) as SOAPNoteRow | undefined;
  
  if (!soapNote) {
    return res.status(404).json({ error: 'SOAP note not found' });
  }
  
  res.json(soapNote);
}));

// Create SOAP note
soapNotesRouter.post('/', asyncHandler(async (req, res) => {
  const soapNote = req.body;
  
  db.prepare(`
    INSERT INTO soap_notes (id, sessionId, studentId, date, templateId, subjective, 
                           objective, assessment, plan, dateCreated, dateUpdated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    soapNote.id,
    soapNote.sessionId,
    soapNote.studentId,
    soapNote.date,
    soapNote.templateId || null,
    soapNote.subjective,
    soapNote.objective,
    soapNote.assessment,
    soapNote.plan,
    soapNote.dateCreated,
    soapNote.dateUpdated
  );
  
  res.status(201).json({ id: soapNote.id, message: 'SOAP note created' });
}));

// Update SOAP note
soapNotesRouter.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
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
    soapNote.subjective,
    soapNote.objective,
    soapNote.assessment,
    soapNote.plan,
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
  const result = db.prepare('DELETE FROM soap_notes WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'SOAP note not found' });
  }
  
  res.json({ message: 'SOAP note deleted' });
}));

