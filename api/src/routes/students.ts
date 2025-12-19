import { Router } from 'express';
import { db } from '../db';

export const studentsRouter = Router();

// Get all students (optionally filtered by school)
studentsRouter.get('/', (req, res) => {
  try {
    const { school } = req.query;
    
    let query = 'SELECT * FROM students';
    const params: string[] = [];
    
    if (school && typeof school === 'string' && school.trim()) {
      query += ' WHERE school = ?';
      params.push(school.trim());
    }
    
    const students = db.prepare(query).all(...params);
    
    // Parse JSON fields
    const parsed = students.map((s: any) => ({
      ...s,
      concerns: s.concerns ? JSON.parse(s.concerns) : [],
      exceptionality: s.exceptionality ? JSON.parse(s.exceptionality) : undefined,
      archived: s.archived === 1,
    }));
    
    res.json(parsed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get student by ID
studentsRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id) as any;
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json({
      ...student,
      concerns: student.concerns ? JSON.parse(student.concerns) : [],
      exceptionality: student.exceptionality ? JSON.parse(student.exceptionality) : undefined,
      archived: student.archived === 1,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create student
studentsRouter.post('/', (req, res) => {
  try {
    const student = req.body;
    
    // Ensure the school exists (create it if it doesn't)
    let schoolName = student.school?.trim();
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
      INSERT INTO students (id, name, age, grade, concerns, exceptionality, status, dateAdded, archived, dateArchived, school)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      student.id,
      student.name,
      student.age,
      student.grade,
      JSON.stringify(student.concerns || []),
      student.exceptionality ? JSON.stringify(student.exceptionality) : null,
      student.status,
      student.dateAdded,
      student.archived ? 1 : 0,
      student.dateArchived || null,
      schoolName
    );
    
    res.status(201).json({ id: student.id, message: 'Student created' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update student
studentsRouter.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    const student = { ...existing, ...updates };
    
    // Ensure the school exists (create it if it doesn't)
    let schoolName = student.school?.trim();
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
      UPDATE students 
      SET name = ?, age = ?, grade = ?, concerns = ?, exceptionality = ?, status = ?, 
          archived = ?, dateArchived = ?, school = ?
      WHERE id = ?
    `).run(
      student.name,
      student.age,
      student.grade,
      JSON.stringify(student.concerns || []),
      student.exceptionality ? JSON.stringify(student.exceptionality) : null,
      student.status,
      student.archived ? 1 : 0,
      student.dateArchived || null,
      schoolName,
      id
    );
    
    res.json({ message: 'Student updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete student
studentsRouter.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM students WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json({ message: 'Student deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

