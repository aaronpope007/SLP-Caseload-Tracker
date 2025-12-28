import express from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';

// Database row types
interface CommunicationRow {
  id: string;
  studentId: string | null;
  contactType: string;
  contactId: string | null;
  contactName: string;
  contactEmail: string | null;
  subject: string;
  body: string;
  method: string;
  date: string | null;
  sessionId: string | null;
  relatedTo: string | null;
  dateCreated: string;
}

const communicationsRouter = express.Router();

// Get all communications
communicationsRouter.get('/', asyncHandler(async (req, res) => {
  const { studentId, contactType, school } = req.query;
  
  let query = 'SELECT * FROM communications WHERE 1=1';
  const params: string[] = [];
  
  if (studentId) {
    query += ' AND studentId = ?';
    params.push(studentId as string);
  }
  
  if (contactType) {
    query += ' AND contactType = ?';
    params.push(contactType as string);
  }
  
  if (school) {
    // Join with students table to filter by school
    // Show communications where:
    // 1. The student's school matches, OR
    // 2. The communication has no studentId (general communications)
    query = `
      SELECT c.* FROM communications c
      LEFT JOIN students s ON c.studentId = s.id
      WHERE (s.school = ? OR c.studentId IS NULL)
    `;
    params.unshift(school as string);
    
    // Re-apply other filters
    if (studentId) {
      query += ' AND c.studentId = ?';
      params.push(studentId as string);
    }
    if (contactType) {
      query += ' AND c.contactType = ?';
      params.push(contactType as string);
    }
  } else {
    // If no school filter, show all communications
    // But still apply other filters
    if (studentId) {
      query += ' AND studentId = ?';
      params.push(studentId as string);
    }
    if (contactType) {
      query += ' AND contactType = ?';
      params.push(contactType as string);
    }
  }
  
  query += ' ORDER BY date DESC, dateCreated DESC';
  
  const communications = db.prepare(query).all(...params) as CommunicationRow[];
  
  const mapped = communications.map(comm => ({
    id: comm.id,
    studentId: comm.studentId || undefined,
    contactType: comm.contactType,
    contactId: comm.contactId || undefined,
    contactName: comm.contactName,
    contactEmail: comm.contactEmail || undefined,
    subject: comm.subject,
    body: comm.body,
    method: comm.method,
    date: comm.date || comm.dateCreated || undefined, // Fallback to dateCreated if date is null
    sessionId: comm.sessionId || undefined,
    relatedTo: comm.relatedTo || undefined,
    dateCreated: comm.dateCreated,
  }));
  
  res.json(mapped);
}));

// Get communication by ID
communicationsRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const communication = db.prepare('SELECT * FROM communications WHERE id = ?').get(id) as CommunicationRow | undefined;
  
  if (!communication) {
    return res.status(404).json({ error: 'Communication not found' });
  }
  
  res.json({
    id: communication.id,
    studentId: communication.studentId || undefined,
    contactType: communication.contactType,
    contactId: communication.contactId || undefined,
    contactName: communication.contactName,
    contactEmail: communication.contactEmail || undefined,
    subject: communication.subject,
    body: communication.body,
    method: communication.method,
    date: communication.date,
    sessionId: communication.sessionId || undefined,
    relatedTo: communication.relatedTo || undefined,
    dateCreated: communication.dateCreated,
  });
}));

// Create communication
communicationsRouter.post('/', asyncHandler(async (req, res) => {
  const communication = req.body;
  const id = communication.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const dateCreated = communication.dateCreated || new Date().toISOString();
  
  // Ensure date is always set - use current date if not provided
  const communicationDate = communication.date || new Date().toISOString();
  
  db.prepare(`
    INSERT INTO communications (id, studentId, contactType, contactId, contactName, contactEmail, 
                               subject, body, method, date, sessionId, relatedTo, dateCreated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    communication.studentId || null,
    communication.contactType,
    communication.contactId || null,
    communication.contactName,
    communication.contactEmail || null,
    communication.subject,
    communication.body,
    communication.method,
    communicationDate,
    communication.sessionId || null,
    communication.relatedTo || null,
    dateCreated
  );
  
  res.status(201).json({ id, message: 'Communication created' });
}));

// Update communication
communicationsRouter.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const existing = db.prepare('SELECT * FROM communications WHERE id = ?').get(id) as CommunicationRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Communication not found' });
  }
  
  const updated = { ...existing, ...updates };
  
  db.prepare(`
    UPDATE communications 
    SET studentId = ?, contactType = ?, contactId = ?, contactName = ?, contactEmail = ?,
        subject = ?, body = ?, method = ?, date = ?, sessionId = ?, relatedTo = ?
    WHERE id = ?
  `).run(
    updated.studentId || null,
    updated.contactType,
    updated.contactId || null,
    updated.contactName,
    updated.contactEmail || null,
    updated.subject,
    updated.body,
    updated.method,
    updated.date,
    updated.sessionId || null,
    updated.relatedTo || null,
    id
  );
  
  res.json({ message: 'Communication updated' });
}));

// Delete communication
communicationsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const existing = db.prepare('SELECT * FROM communications WHERE id = ?').get(id) as CommunicationRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Communication not found' });
  }
  
  db.prepare('DELETE FROM communications WHERE id = ?').run(id);
  
  res.json({ message: 'Communication deleted' });
}));

export { communicationsRouter };

