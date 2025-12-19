import { Router } from 'express';
import { db } from '../db';

export const sessionsRouter = Router();

// Get all sessions (optionally filtered by studentId or school)
sessionsRouter.get('/', (req, res) => {
  try {
    const { studentId, school } = req.query;
    
    let query = 'SELECT * FROM sessions';
    const params: string[] = [];
    
    if (studentId) {
      query += ' WHERE studentId = ? ORDER BY date DESC';
      params.push(studentId as string);
    } else if (school) {
      query = `
        SELECT s.* FROM sessions s
        INNER JOIN students st ON s.studentId = st.id
        WHERE st.school = ?
        ORDER BY s.date DESC
      `;
      params.push(school as string);
    } else {
      query += ' ORDER BY date DESC';
    }
    
    const sessions = db.prepare(query).all(...params);
    
    // Parse JSON fields
    const parsed = sessions.map((s: any) => ({
      ...s,
      goalsTargeted: s.goalsTargeted ? JSON.parse(s.goalsTargeted) : [],
      activitiesUsed: s.activitiesUsed ? JSON.parse(s.activitiesUsed) : [],
      performanceData: s.performanceData ? JSON.parse(s.performanceData) : [],
      isDirectServices: s.isDirectServices === 1,
      missedSession: s.missedSession === 1,
    }));
    
    res.json(parsed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get session by ID
sessionsRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
      ...session,
      goalsTargeted: session.goalsTargeted ? JSON.parse(session.goalsTargeted) : [],
      activitiesUsed: session.activitiesUsed ? JSON.parse(session.activitiesUsed) : [],
      performanceData: session.performanceData ? JSON.parse(session.performanceData) : [],
      isDirectServices: session.isDirectServices === 1,
      missedSession: session.missedSession === 1,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create session
sessionsRouter.post('/', (req, res) => {
  try {
    const session = req.body;
    
    db.prepare(`
      INSERT INTO sessions (id, studentId, date, endTime, goalsTargeted, activitiesUsed, 
                           performanceData, notes, isDirectServices, indirectServicesNotes, 
                           groupSessionId, missedSession)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.id,
      session.studentId,
      session.date,
      session.endTime || null,
      JSON.stringify(session.goalsTargeted || []),
      JSON.stringify(session.activitiesUsed || []),
      JSON.stringify(session.performanceData || []),
      session.notes,
      session.isDirectServices !== false ? 1 : 0,
      session.indirectServicesNotes || null,
      session.groupSessionId || null,
      session.missedSession ? 1 : 0
    );
    
    res.status(201).json({ id: session.id, message: 'Session created' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update session
sessionsRouter.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const session = { ...existing, ...updates };
    
    db.prepare(`
      UPDATE sessions 
      SET studentId = ?, date = ?, endTime = ?, goalsTargeted = ?, activitiesUsed = ?, 
          performanceData = ?, notes = ?, isDirectServices = ?, indirectServicesNotes = ?, 
          groupSessionId = ?, missedSession = ?
      WHERE id = ?
    `).run(
      session.studentId,
      session.date,
      session.endTime || null,
      JSON.stringify(session.goalsTargeted || []),
      JSON.stringify(session.activitiesUsed || []),
      JSON.stringify(session.performanceData || []),
      session.notes,
      session.isDirectServices !== false ? 1 : 0,
      session.indirectServicesNotes || null,
      session.groupSessionId || null,
      session.missedSession ? 1 : 0,
      id
    );
    
    res.json({ message: 'Session updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete session
sessionsRouter.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({ message: 'Session deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

