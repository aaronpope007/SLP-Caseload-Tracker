import { Router } from 'express';
import { db } from '../db';

export const schoolsRouter = Router();

// Get all schools
schoolsRouter.get('/', (req, res) => {
  try {
    const schools = db.prepare('SELECT * FROM schools ORDER BY name').all();
    
    // Get student counts for each school
    const studentCounts = db.prepare(`
      SELECT school, COUNT(*) as count 
      FROM students 
      GROUP BY school
    `).all() as Array<{ school: string; count: number }>;
    
    const countMap = new Map<string, number>();
    for (const row of studentCounts) {
      // Count case-insensitively
      const key = row.school.toLowerCase();
      const existing = countMap.get(key) || 0;
      countMap.set(key, existing + row.count);
    }
    
    // Parse boolean, schoolHours JSON, and add student count
    const parsed = (schools as any[]).map((s) => {
      const key = s.name.toLowerCase();
      const studentCount = countMap.get(key) || 0;
      let schoolHours = undefined;
      if (s.schoolHours) {
        try {
          schoolHours = JSON.parse(s.schoolHours);
        } catch {
          // If parsing fails, leave as undefined
        }
      }
      return {
        ...s,
        teletherapy: s.teletherapy === 1,
        schoolHours,
        studentCount,
      };
    });
    
    res.json(parsed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get school by ID
schoolsRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(id) as any;
    
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }
    
    let schoolHours = undefined;
    if (school.schoolHours) {
      try {
        schoolHours = typeof school.schoolHours === 'string' ? JSON.parse(school.schoolHours) : school.schoolHours;
      } catch {
        // If parsing fails, leave as undefined
      }
    }
    res.json({
      ...school,
      teletherapy: school.teletherapy === 1,
      schoolHours,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get school by name
schoolsRouter.get('/name/:name', (req, res) => {
  try {
    const { name } = req.params;
    const school = db.prepare('SELECT * FROM schools WHERE name = ?').get(name) as any;
    
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }
    
    let schoolHours = undefined;
    if (school.schoolHours) {
      try {
        schoolHours = typeof school.schoolHours === 'string' ? JSON.parse(school.schoolHours) : school.schoolHours;
      } catch {
        // If parsing fails, leave as undefined
      }
    }
    res.json({
      ...school,
      teletherapy: school.teletherapy === 1,
      schoolHours,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create school
schoolsRouter.post('/', (req, res) => {
  try {
    const school = req.body;
    const schoolName = school.name?.trim();
    
    if (!schoolName) {
      return res.status(400).json({ error: 'School name is required' });
    }
    
    // Check for duplicate schools (case-insensitive)
    const allSchools = db.prepare('SELECT * FROM schools').all() as any[];
    const duplicate = allSchools.find(
      s => s.name.trim().toLowerCase() === schoolName.toLowerCase()
    );
    
    if (duplicate) {
      // Return the existing school instead of creating a duplicate
      return res.status(200).json({ 
        id: duplicate.id, 
        message: 'School already exists',
        existing: true
      });
    }
    
    db.prepare(`
      INSERT INTO schools (id, name, state, teletherapy, dateCreated, schoolHours)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      school.id,
      schoolName,
      school.state || '',
      school.teletherapy ? 1 : 0,
      school.dateCreated,
      school.schoolHours ? JSON.stringify(school.schoolHours) : null
    );
    
    res.status(201).json({ id: school.id, message: 'School created' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update school
schoolsRouter.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    console.log('Updating school:', id, 'with updates:', updates);
    
    const existing = db.prepare('SELECT * FROM schools WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'School not found' });
    }
    
    // Use updates directly, not merged with existing (to properly handle schoolHours)
    const name = updates.name !== undefined ? updates.name : existing.name;
    const state = updates.state !== undefined ? updates.state : existing.state;
    const teletherapy = updates.teletherapy !== undefined ? (updates.teletherapy ? 1 : 0) : (existing.teletherapy === 1 ? 1 : 0);
    const schoolHours = updates.schoolHours !== undefined 
      ? (updates.schoolHours ? JSON.stringify(updates.schoolHours) : null)
      : existing.schoolHours;
    
    console.log('School update values:', { name, state, teletherapy, schoolHours });
    
    db.prepare(`
      UPDATE schools 
      SET name = ?, state = ?, teletherapy = ?, schoolHours = ?
      WHERE id = ?
    `).run(
      name,
      state,
      teletherapy,
      schoolHours,
      id
    );
    
    console.log('School updated successfully');
    res.json({ message: 'School updated' });
  } catch (error: any) {
    console.error('Error updating school:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete school
schoolsRouter.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if school exists
    const existing = db.prepare('SELECT * FROM schools WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'School not found' });
    }
    
    // Delete the school
    const result = db.prepare('DELETE FROM schools WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'School not found' });
    }
    
    res.json({ message: 'School deleted', deletedId: id });
  } catch (error: any) {
    // Make sure foreign keys are re-enabled even on error
    db.pragma('foreign_keys = ON');
    console.error('Error deleting school:', error);
    res.status(500).json({ error: error.message });
  }
});

