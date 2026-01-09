import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { createTeacherSchema, updateTeacherSchema } from '../schemas';

// Database row types
interface TeacherRow {
  id: string;
  name: string;
  grade: string;
  school: string;
  phoneNumber: string | null;
  emailAddress: string | null;
  dateCreated: string;
}

interface SchoolRow {
  id: string;
  name: string;
  state: string;
  teletherapy: number;
  dateCreated: string;
}

export const teachersRouter = Router();

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

/**
 * @openapi
 * /api/teachers:
 *   get:
 *     tags: [Teachers]
 *     summary: Get all teachers
 *     parameters:
 *       - in: query
 *         name: schoolId
 *         schema:
 *           type: string
 *         description: Filter by school ID
 *     responses:
 *       200:
 *         description: List of teachers
 */
teachersRouter.get('/', asyncHandler(async (req, res) => {
  const { school } = req.query;
  
  // Get all teachers first, then filter in JavaScript
  // This is more reliable than SQL filtering with complex OR conditions
  let teachers = db.prepare('SELECT * FROM teachers ORDER BY name').all() as TeacherRow[];
  
  // Filter by school if provided
  if (school && typeof school === 'string' && school.trim()) {
    const schoolName = school.trim();
    const schoolNameLower = schoolName.toLowerCase();
    
    teachers = teachers.filter((teacher) => {
      const teacherSchool = (teacher.school || '').trim();
      const teacherSchoolLower = teacherSchool.toLowerCase();
      // Match exact school or empty school (for migration period)
      return teacherSchoolLower === schoolNameLower || teacherSchool === '';
    });
  }
  
  res.json(teachers);
}));

// Get teacher by ID
teachersRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid teacher ID' });
  }
  
  const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(id) as TeacherRow | undefined;
  
  if (!teacher) {
    return res.status(404).json({ error: 'Teacher not found' });
  }
  
  res.json(teacher);
}));

/**
 * @openapi
 * /api/teachers:
 *   post:
 *     tags: [Teachers]
 *     summary: Create a new teacher
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Teacher'
 *     responses:
 *       201:
 *         description: Teacher created
 *       400:
 *         description: Validation error
 */
teachersRouter.post('/', validateBody(createTeacherSchema), asyncHandler(async (req, res) => {
  const teacher = req.body;
  
  // Ensure the school exists (create it if it doesn't)
  const schoolName = ensureSchoolExists(teacher.school);
  
  // Generate ID if not provided
  const teacherId = teacher.id || `teacher-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const dateCreated = new Date().toISOString();

  db.prepare(`
    INSERT INTO teachers (id, name, grade, school, phoneNumber, emailAddress, dateCreated)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    teacherId,
    teacher.name,
    teacher.grade || '',
    schoolName,
    teacher.phoneNumber || null,
    teacher.emailAddress || null,
    dateCreated
  );
  
  res.status(201).json({ id: teacherId, message: 'Teacher created' });
}));

// Update teacher - with validation
teachersRouter.put('/:id', validateBody(updateTeacherSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid teacher ID' });
  }
  
  const existing = db.prepare('SELECT * FROM teachers WHERE id = ?').get(id) as TeacherRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Teacher not found' });
  }
  
  const teacher = { ...existing, ...updates };
  
  // Ensure the school exists (create it if it doesn't)
  const schoolName = teacher.school ? ensureSchoolExists(teacher.school) : existing.school;

  db.prepare(`
    UPDATE teachers 
    SET name = ?, grade = ?, school = ?, phoneNumber = ?, emailAddress = ?
    WHERE id = ?
  `).run(
    teacher.name,
    teacher.grade || '',
    schoolName,
    teacher.phoneNumber || null,
    teacher.emailAddress || null,
    id
  );
  
  res.json({ message: 'Teacher updated' });
}));

// Delete teacher
teachersRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid teacher ID' });
  }
  
  const result = db.prepare('DELETE FROM teachers WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Teacher not found' });
  }
  
  res.json({ message: 'Teacher deleted' });
}));
