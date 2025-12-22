import { Router } from 'express';
import { db } from '../db';

export const soapNotesRouter = Router();

// Get all SOAP notes (optionally filtered by studentId or sessionId)
soapNotesRouter.get('/', (req, res) => {
  try {
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
    
    const soapNotes = db.prepare(query).all(...params);
    res.json(soapNotes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get SOAP note by ID
soapNotesRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const soapNote = db.prepare('SELECT * FROM soap_notes WHERE id = ?').get(id) as any;
    
    if (!soapNote) {
      return res.status(404).json({ error: 'SOAP note not found' });
    }
    
    res.json(soapNote);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create SOAP note
soapNotesRouter.post('/', (req, res) => {
  try {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update SOAP note
soapNotesRouter.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = db.prepare('SELECT * FROM soap_notes WHERE id = ?').get(id) as any;
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
  } catch (error: any) {
    console.error('Error updating SOAP note:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete SOAP note
soapNotesRouter.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM soap_notes WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'SOAP note not found' });
    }
    
    res.json({ message: 'SOAP note deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

