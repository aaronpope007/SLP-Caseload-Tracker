import { Router } from 'express';
import { db } from '../db';

export const teachersRouter = Router();

// Get all teachers (optionally filtered by school)
teachersRouter.get('/', (req, res) => {
  try {
    const { school } = req.query;
    
    // Get all teachers first, then filter in JavaScript
    // This is more reliable than SQL filtering with complex OR conditions
    let teachers = db.prepare('SELECT * FROM teachers ORDER BY name').all() as any[];
    
    // Filter by school if provided
    if (school && typeof school === 'string' && school.trim()) {
      const schoolName = school.trim();
      const schoolNameLower = schoolName.toLowerCase();
      
      const beforeFilter = teachers.length;
      teachers = teachers.filter((teacher) => {
        const teacherSchool = (teacher.school || '').trim();
        const teacherSchoolLower = teacherSchool.toLowerCase();
        // Match exact school or empty school (for migration period)
        return teacherSchoolLower === schoolNameLower || teacherSchool === '';
      });
      
      if (teachers.length === 0 && beforeFilter > 0) {
        console.log(`[Teachers API] No teachers found for school "${schoolName}"`);
        console.log(`[Teachers API] Available schools in DB:`, [...new Set(db.prepare('SELECT school FROM teachers').all().map((t: any) => t.school))]);
      }
    }
    
    res.json(teachers);
  } catch (error: any) {
    console.error('[Teachers API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get teacher by ID
teachersRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(id) as any;
    
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    res.json(teacher);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create teacher
teachersRouter.post('/', (req, res) => {
  try {
    const teacher = req.body;
    
    // Ensure the school exists (create it if it doesn't)
    let schoolName = teacher.school?.trim();
    if (schoolName) {
      // Check for exact match first
      let existingSchool = db.prepare('SELECT * FROM schools WHERE name = ?').get(schoolName) as any;
      
      // If no exact match, try case-insensitive
      if (!existingSchool) {
        const allSchools = db.prepare('SELECT * FROM schools').all() as any[];
        existingSchool = allSchools.find(s => s.name.trim().toLowerCase() === schoolName.toLowerCase());
      }
      
      if (!existingSchool) {
        // Create the school automatically
        const schoolId = `school-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        db.prepare(`
          INSERT INTO schools (id, name, state, teletherapy, dateCreated)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          schoolId,
          schoolName,
          'NC', // Default state
          0, // Default teletherapy
          new Date().toISOString()
        );
      } else {
        // Use the exact name from database (handles case sensitivity)
        schoolName = existingSchool.name;
      }
    }

    db.prepare(`
      INSERT INTO teachers (id, name, grade, school, phoneNumber, emailAddress, dateCreated)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      teacher.id,
      teacher.name,
      teacher.grade,
      schoolName || '',
      teacher.phoneNumber || null,
      teacher.emailAddress || null,
      teacher.dateCreated
    );
    
    res.status(201).json({ id: teacher.id, message: 'Teacher created' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update teacher
teachersRouter.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = db.prepare('SELECT * FROM teachers WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    const teacher = { ...existing, ...updates };
    
    // Ensure the school exists (create it if it doesn't)
    let schoolName = teacher.school?.trim();
    if (schoolName) {
      // Check for exact match first
      let existingSchool = db.prepare('SELECT * FROM schools WHERE name = ?').get(schoolName) as any;
      
      // If no exact match, try case-insensitive
      if (!existingSchool) {
        const allSchools = db.prepare('SELECT * FROM schools').all() as any[];
        existingSchool = allSchools.find(s => s.name.trim().toLowerCase() === schoolName.toLowerCase());
      }
      
      if (!existingSchool) {
        // Create the school automatically
        const schoolId = `school-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        db.prepare(`
          INSERT INTO schools (id, name, state, teletherapy, dateCreated)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          schoolId,
          schoolName,
          'NC', // Default state
          0, // Default teletherapy
          new Date().toISOString()
        );
      } else {
        // Use the exact name from database (handles case sensitivity)
        schoolName = existingSchool.name;
      }
    }

    db.prepare(`
      UPDATE teachers 
      SET name = ?, grade = ?, school = ?, phoneNumber = ?, emailAddress = ?
      WHERE id = ?
    `).run(
      teacher.name,
      teacher.grade,
      schoolName || '',
      teacher.phoneNumber || null,
      teacher.emailAddress || null,
      id
    );
    
    res.json({ message: 'Teacher updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete teacher
teachersRouter.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM teachers WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    res.json({ message: 'Teacher deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

