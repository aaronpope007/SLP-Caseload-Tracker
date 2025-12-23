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
    
    // Parse boolean and add student count
    const parsed = (schools as any[]).map((s) => {
      const key = s.name.toLowerCase();
      const studentCount = countMap.get(key) || 0;
      return {
        ...s,
        teletherapy: s.teletherapy === 1,
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
    
    res.json({
      ...school,
      teletherapy: school.teletherapy === 1,
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
    
    res.json({
      ...school,
      teletherapy: school.teletherapy === 1,
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
      INSERT INTO schools (id, name, state, teletherapy, dateCreated)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      school.id,
      schoolName,
      school.state || '',
      school.teletherapy ? 1 : 0,
      school.dateCreated
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
    
    const existing = db.prepare('SELECT * FROM schools WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'School not found' });
    }
    
    const school = { ...existing, ...updates };
    
    db.prepare(`
      UPDATE schools 
      SET name = ?, state = ?, teletherapy = ?
      WHERE id = ?
    `).run(
      school.name,
      school.state,
      school.teletherapy ? 1 : 0,
      id
    );
    
    res.json({ message: 'School updated' });
  } catch (error: any) {
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
    
    const schoolName = existing.name;
    
    // Temporarily disable foreign keys for this operation
    db.pragma('foreign_keys = OFF');
    
    try {
      // Check if there are lunches referencing this school
      const lunches = db.prepare('SELECT * FROM lunches WHERE school = ?').all(schoolName) as any[];
      
      if (lunches.length > 0) {
        // Find another school with the same name (case-insensitive) to transfer lunches to
        // Prefer the one with teletherapy if there are duplicates
        const allSchools = db.prepare('SELECT * FROM schools').all() as any[];
        const sameNameSchools = allSchools.filter(
          s => s.id !== id && s.name.toLowerCase() === schoolName.toLowerCase()
        );
        
        if (sameNameSchools.length > 0) {
          // Prefer the one with teletherapy
          const targetSchool = sameNameSchools.find(s => s.teletherapy === 1) || sameNameSchools[0];
          
          // Update lunches to reference the target school
          db.prepare('UPDATE lunches SET school = ? WHERE school = ?').run(targetSchool.name, schoolName);
          console.log(`Transferred ${lunches.length} lunch(es) from "${schoolName}" to "${targetSchool.name}"`);
        } else {
          // No other school with same name exists, delete the lunches
          db.prepare('DELETE FROM lunches WHERE school = ?').run(schoolName);
          console.log(`Deleted ${lunches.length} orphaned lunch(es) for school "${schoolName}"`);
        }
      }
      
      // Now delete the school
      const result = db.prepare('DELETE FROM schools WHERE id = ?').run(id);
      
      if (result.changes === 0) {
        throw new Error('Failed to delete school');
      }
      
      res.json({ message: 'School deleted', deletedId: id });
    } finally {
      // Always re-enable foreign keys
      db.pragma('foreign_keys = ON');
    }
  } catch (error: any) {
    // Make sure foreign keys are re-enabled even on error
    db.pragma('foreign_keys = ON');
    console.error('Error deleting school:', error);
    res.status(500).json({ error: error.message });
  }
});

