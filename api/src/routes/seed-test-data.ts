import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { stringifyJsonField } from '../utils/jsonHelpers';

export const seedTestDataRouter = Router();

// Seed test data endpoint
seedTestDataRouter.post('/', asyncHandler(async (req, res) => {
  const now = new Date().toISOString();
  
  // Check if test data already exists
  const existingTestSchool = db.prepare('SELECT * FROM schools WHERE name = ?').get('Test Elementary School') as { id: string } | undefined;
  if (existingTestSchool) {
    return res.status(400).json({ 
      error: 'Test data already exists. Please delete existing test data first.',
      existing: true
    });
  }

  // Start transaction
  const transaction = db.transaction(() => {
    // Create test school
    const schoolId = `school-test-${Date.now()}`;
    db.prepare(`
      INSERT INTO schools (id, name, state, teletherapy, dateCreated)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      schoolId,
      'Test Elementary School',
      'NC',
      0,
      now
    );

    const schoolName = 'Test Elementary School';
    const teacherIds: { [grade: string]: string } = {};
    const studentIds: string[] = [];

    // Create teachers for grades K-5
    const grades = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade'];
    
    for (const grade of grades) {
      const teacherId = `teacher-test-${grade.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      teacherIds[grade] = teacherId;
      
      db.prepare(`
        INSERT INTO teachers (id, name, grade, school, phoneNumber, emailAddress, dateCreated)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        teacherId,
        `${grade} Teacher`,
        grade,
        schoolName,
        null,
        null,
        now
      );
    }

    // Create students for each grade (3 students per grade)
    const studentLetters = ['A', 'B', 'C'];
    const gradeAges: { [grade: string]: number } = {
      'Kindergarten': 5,
      '1st Grade': 6,
      '2nd Grade': 7,
      '3rd Grade': 8,
      '4th Grade': 9,
      '5th Grade': 10,
    };

    for (const grade of grades) {
      const teacherId = teacherIds[grade];
      const age = gradeAges[grade];
      
      for (const letter of studentLetters) {
        const studentId = `student-test-${grade.toLowerCase().replace(/\s+/g, '-')}-${letter.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        studentIds.push(studentId);
        
        db.prepare(`
          INSERT INTO students (
            id, name, age, grade, concerns, exceptionality, status, dateAdded, 
            archived, dateArchived, school, teacherId, caseManagerId, 
            iepDate, annualReviewDate, progressReportFrequency, frequencyPerWeek, frequencyType
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          studentId,
          `${grade} Student ${letter}`,
          age,
          grade,
          stringifyJsonField(['Articulation', 'Language']),
          null,
          'active',
          now,
          0,
          null,
          schoolName,
          teacherId,
          null,
          null,
          null,
          null,
          null,
          null
        );
      }
    }

    return {
      schoolId,
      teacherCount: grades.length,
      studentCount: studentIds.length,
      teacherIds,
      studentIds,
    };
  });

  const result = transaction();

  res.status(201).json({
    message: 'Test data seeded successfully',
    ...result,
  });
}));

// Delete test data endpoint
seedTestDataRouter.delete('/', asyncHandler(async (req, res) => {
  const testSchoolName = 'Test Elementary School';
  
  // Find the test school
  const testSchool = db.prepare('SELECT * FROM schools WHERE name = ?').get(testSchoolName) as { id: string } | undefined;
  
  if (!testSchool) {
    return res.status(404).json({ error: 'Test data not found' });
  }

  // Start transaction
  const transaction = db.transaction(() => {
    // Delete students from test school
    const deletedStudents = db.prepare('DELETE FROM students WHERE school = ?').run(testSchoolName).changes;
    
    // Delete teachers from test school
    const deletedTeachers = db.prepare('DELETE FROM teachers WHERE school = ?').run(testSchoolName).changes;
    
    // Delete the test school
    db.prepare('DELETE FROM schools WHERE id = ?').run(testSchool.id);
    
    return {
      deletedStudents,
      deletedTeachers,
      deletedSchool: 1,
    };
  });

  const result = transaction();

  res.json({
    message: 'Test data deleted successfully',
    ...result,
  });
}));

// Check if test data exists
seedTestDataRouter.get('/exists', asyncHandler(async (req, res) => {
  const testSchool = db.prepare('SELECT * FROM schools WHERE name = ?').get('Test Elementary School') as { id: string } | undefined;
  
  if (!testSchool) {
    return res.json({ exists: false });
  }

  const studentCount = db.prepare('SELECT COUNT(*) as count FROM students WHERE school = ?').get('Test Elementary School') as { count: number };
  const teacherCount = db.prepare('SELECT COUNT(*) as count FROM teachers WHERE school = ?').get('Test Elementary School') as { count: number };

  res.json({
    exists: true,
    studentCount: studentCount.count,
    teacherCount: teacherCount.count,
  });
}));

