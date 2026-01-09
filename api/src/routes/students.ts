import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { parseJsonField, stringifyJsonField } from '../utils/jsonHelpers';
import { createStudentSchema, updateStudentSchema } from '../schemas';

// Database row types
interface StudentRow {
  id: string;
  name: string;
  age: number;
  grade: string;
  concerns: string; // JSON string
  exceptionality: string | null; // JSON string
  status: string;
  dateAdded: string;
  archived: number;
  dateArchived: string | null;
  school: string;
  teacherId: string | null;
  caseManagerId: string | null;
  iepDate: string | null;
  annualReviewDate: string | null;
  progressReportFrequency: string | null;
  frequencyPerWeek: number | null;
  frequencyType: string | null;
}

interface SchoolRow {
  id: string;
  name: string;
  state: string;
  teletherapy: number;
  dateCreated: string;
}

export const studentsRouter = Router();

/**
 * Ensure a school exists, creating it if necessary
 * Returns the normalized school name from the database
 */
function ensureSchoolExists(schoolName: string): string {
  const trimmedName = schoolName.trim();
  if (!trimmedName) return '';

  // Check for exact match first
  let existingSchool = db.prepare('SELECT * FROM schools WHERE name = ?').get(trimmedName) as SchoolRow | undefined;
  
  // If no exact match, try case-insensitive
  if (!existingSchool) {
    const allSchools = db.prepare('SELECT * FROM schools').all() as SchoolRow[];
    existingSchool = allSchools.find(s => s.name.trim().toLowerCase() === trimmedName.toLowerCase());
  }
  
  if (!existingSchool) {
    // Create the school automatically
    const schoolId = `school-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    db.prepare(`
      INSERT INTO schools (id, name, state, teletherapy, dateCreated)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      schoolId,
      trimmedName,
      'NC', // Default state
      0, // Default teletherapy
      new Date().toISOString()
    );
    return trimmedName;
  }
  
  // Return the exact name from database (handles case sensitivity)
  return existingSchool.name;
}

// Get all students (optionally filtered by school, teacherId, or caseManagerId)
studentsRouter.get('/', asyncHandler(async (req, res) => {
  const { school, teacherId, caseManagerId } = req.query;
  
  let query = 'SELECT * FROM students';
  const params: string[] = [];
  const conditions: string[] = [];
  
  if (school && typeof school === 'string' && school.trim()) {
    conditions.push('school = ?');
    params.push(school.trim());
  }
  
  if (teacherId && typeof teacherId === 'string' && teacherId.trim()) {
    conditions.push('teacherId = ?');
    params.push(teacherId.trim());
  }
  
  if (caseManagerId && typeof caseManagerId === 'string' && caseManagerId.trim()) {
    conditions.push('caseManagerId = ?');
    params.push(caseManagerId.trim());
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  const students = db.prepare(query).all(...params) as StudentRow[];
  
  // Parse JSON fields
  const parsed = students.map((s) => ({
    ...s,
    concerns: parseJsonField<string[]>(s.concerns, []),
    exceptionality: parseJsonField<string[]>(s.exceptionality, undefined),
    archived: s.archived === 1,
  }));
  
  res.json(parsed);
}));

// Get student by ID
studentsRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id) as StudentRow | undefined;
  
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }
  
  res.json({
    ...student,
    concerns: parseJsonField<string[]>(student.concerns, []),
    exceptionality: parseJsonField<string[]>(student.exceptionality, undefined),
    archived: student.archived === 1,
  });
}));

// Create student - with validation
studentsRouter.post('/', validateBody(createStudentSchema), asyncHandler(async (req, res) => {
  const student = req.body;
  
  // Ensure the school exists (create it if it doesn't)
  const schoolName = ensureSchoolExists(student.school);
  
  // Generate ID if not provided
  const studentId = student.id || `student-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const dateAdded = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO students (id, name, age, grade, concerns, exceptionality, status, dateAdded, archived, dateArchived, school, teacherId, caseManagerId, iepDate, annualReviewDate, progressReportFrequency, frequencyPerWeek, frequencyType)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    studentId,
    student.name,
    student.age,
    student.grade || '',
    stringifyJsonField(student.concerns || []),
    stringifyJsonField(student.exceptionality),
    student.status || 'active',
    dateAdded,
    student.archived ? 1 : 0,
    student.dateArchived || null,
    schoolName,
    student.teacherId || null,
    student.caseManagerId || null,
    student.iepDate || null,
    student.annualReviewDate || null,
    student.progressReportFrequency || null,
    student.frequencyPerWeek ?? null,
    student.frequencyType || null
  );
  
  res.status(201).json({ id: studentId, message: 'Student created' });
}));

// Update student - with validation
studentsRouter.put('/:id', validateBody(updateStudentSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(id) as StudentRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Student not found' });
  }
  
  // Merge existing with updates
  const student = {
    ...existing,
    concerns: parseJsonField<string[]>(existing.concerns, []),
    exceptionality: parseJsonField<string[]>(existing.exceptionality, undefined),
    ...updates,
  };
  
  // Ensure the school exists (create it if it doesn't)
  const schoolName = student.school ? ensureSchoolExists(student.school) : existing.school;
  
  db.prepare(`
    UPDATE students 
    SET name = ?, age = ?, grade = ?, concerns = ?, exceptionality = ?, status = ?, 
        archived = ?, dateArchived = ?, school = ?, teacherId = ?, caseManagerId = ?, iepDate = ?, annualReviewDate = ?, progressReportFrequency = ?, frequencyPerWeek = ?, frequencyType = ?
    WHERE id = ?
  `).run(
    student.name,
    student.age,
    student.grade || '',
    stringifyJsonField(student.concerns || []),
    stringifyJsonField(student.exceptionality),
    student.status,
    student.archived ? 1 : 0,
    student.dateArchived || null,
    schoolName,
    student.teacherId || null,
    student.caseManagerId || null,
    student.iepDate || null,
    student.annualReviewDate || null,
    student.progressReportFrequency || null,
    student.frequencyPerWeek ?? null,
    student.frequencyType || null,
    id
  );
  
  res.json({ message: 'Student updated' });
}));

// Delete student
studentsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM students WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Student not found' });
  }
  
  res.json({ message: 'Student deleted' });
}));
