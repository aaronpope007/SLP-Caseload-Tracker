import express from 'express';
import { db } from '../db';

const communicationsRouter = express.Router();

// Get all communications
communicationsRouter.get('/', (req, res) => {
  try {
    const { studentId, contactType, school } = req.query;
    
    let query = 'SELECT * FROM communications WHERE 1=1';
    const params: any[] = [];
    
    if (studentId) {
      query += ' AND studentId = ?';
      params.push(studentId);
    }
    
    if (contactType) {
      query += ' AND contactType = ?';
      params.push(contactType);
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
      params.unshift(school);
      
      // Re-apply other filters
      if (studentId) {
        query += ' AND c.studentId = ?';
        params.push(studentId);
      }
      if (contactType) {
        query += ' AND c.contactType = ?';
        params.push(contactType);
      }
    } else {
      // If no school filter, show all communications
      // But still apply other filters
      if (studentId) {
        query += ' AND studentId = ?';
        params.push(studentId);
      }
      if (contactType) {
        query += ' AND contactType = ?';
        params.push(contactType);
      }
    }
    
    query += ' ORDER BY date DESC, dateCreated DESC';
    
    const communications = db.prepare(query).all(...params) as any[];
    
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
    
    // Log any communications with missing critical data
    const missingData = mapped.filter(c => !c.date || (!c.studentId && c.contactType === 'teacher'));
    if (missingData.length > 0) {
      console.warn('⚠️ API: Communications with missing data:', missingData.map(c => ({
        id: c.id,
        hasDate: !!c.date,
        date: c.date,
        hasStudentId: !!c.studentId,
        studentId: c.studentId,
        subject: c.subject,
      })));
    }
    
    res.json(mapped);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get communication by ID
communicationsRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const communication = db.prepare('SELECT * FROM communications WHERE id = ?').get(id) as any;
    
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create communication
communicationsRouter.post('/', (req, res) => {
  try {
    const communication = req.body;
    const id = communication.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const dateCreated = communication.dateCreated || new Date().toISOString();
    
    // Ensure date is always set - use current date if not provided
    const communicationDate = communication.date || new Date().toISOString();
    
    console.log('📝 Creating communication:', {
      id,
      studentId: communication.studentId || 'null',
      date: communicationDate,
      relatedTo: communication.relatedTo || 'null',
      subject: communication.subject,
    });
    
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
    
    // Verify the data was saved correctly
    const saved = db.prepare('SELECT * FROM communications WHERE id = ?').get(id) as any;
    console.log('✅ Communication saved:', {
      id: saved.id,
      studentId: saved.studentId || 'null',
      date: saved.date || 'null',
      relatedTo: saved.relatedTo || 'null',
    });
    
    res.status(201).json({ id, message: 'Communication created' });
  } catch (error: any) {
    console.error('❌ Error creating communication:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update communication
communicationsRouter.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = db.prepare('SELECT * FROM communications WHERE id = ?').get(id) as any;
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete communication
communicationsRouter.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM communications WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Communication not found' });
    }
    
    db.prepare('DELETE FROM communications WHERE id = ?').run(id);
    
    res.json({ message: 'Communication deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { communicationsRouter };

