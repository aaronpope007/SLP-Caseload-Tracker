import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { parseJsonField, stringifyJsonField } from '../utils/jsonHelpers';
import { createSchoolSchema, updateSchoolSchema } from '../schemas';

// Database row types
interface SchoolRow {
  id: string;
  name: string;
  state: string;
  teletherapy: number;
  dateCreated: string;
  schoolHours: string | null; // JSON string
}

export const schoolsRouter = Router();

/**
 * @openapi
 * /api/schools:
 *   get:
 *     tags: [Schools]
 *     summary: Get all schools
 *     responses:
 *       200:
 *         description: List of schools
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/School'
 */
schoolsRouter.get('/', asyncHandler(async (req, res) => {
  const schools = db.prepare('SELECT * FROM schools ORDER BY name').all() as SchoolRow[];
  
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
  const parsed = schools.map((s) => {
    const key = s.name.toLowerCase();
    const studentCount = countMap.get(key) || 0;
    return {
      ...s,
      teletherapy: s.teletherapy === 1,
      schoolHours: parseJsonField<{ startHour: number; endHour: number }>(s.schoolHours, undefined),
      studentCount,
    };
  });
  
  res.json(parsed);
}));

// Get school by ID
schoolsRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid school ID' });
  }
  
  const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(id) as SchoolRow | undefined;
  
  if (!school) {
    return res.status(404).json({ error: 'School not found' });
  }
  
  res.json({
    ...school,
    teletherapy: school.teletherapy === 1,
    schoolHours: parseJsonField<{ startHour: number; endHour: number }>(school.schoolHours, undefined),
  });
}));

// Get school by name
schoolsRouter.get('/name/:name', asyncHandler(async (req, res) => {
  const { name } = req.params;
  
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'School name is required' });
  }
  
  const school = db.prepare('SELECT * FROM schools WHERE name = ?').get(name) as SchoolRow | undefined;
  
  if (!school) {
    return res.status(404).json({ error: 'School not found' });
  }
  
  res.json({
    ...school,
    teletherapy: school.teletherapy === 1,
    schoolHours: parseJsonField<{ startHour: number; endHour: number }>(school.schoolHours, undefined),
  });
}));

/**
 * @openapi
 * /api/schools:
 *   post:
 *     tags: [Schools]
 *     summary: Create a new school
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/School'
 *     responses:
 *       201:
 *         description: School created
 *       400:
 *         description: Validation error
 */
schoolsRouter.post('/', validateBody(createSchoolSchema), asyncHandler(async (req, res) => {
  const school = req.body;
  const schoolName = school.name.trim();
  
  // Check for duplicate schools (case-insensitive)
  const allSchools = db.prepare('SELECT * FROM schools').all() as SchoolRow[];
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
  
  // Generate ID if not provided
  const schoolId = school.id || `school-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const dateCreated = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO schools (id, name, state, teletherapy, dateCreated, schoolHours)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    schoolId,
    schoolName,
    school.state || '',
    school.teletherapy ? 1 : 0,
    dateCreated,
    stringifyJsonField(school.schoolHours)
  );
  
  res.status(201).json({ id: schoolId, message: 'School created' });
}));

// Update school - with validation
schoolsRouter.put('/:id', validateBody(updateSchoolSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid school ID' });
  }
  
  const existing = db.prepare('SELECT * FROM schools WHERE id = ?').get(id) as SchoolRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'School not found' });
  }
  
  // Use updates directly, not merged with existing (to properly handle schoolHours)
  const name = updates.name !== undefined ? updates.name.trim() : existing.name;
  const state = updates.state !== undefined ? updates.state : existing.state;
  const teletherapy = updates.teletherapy !== undefined ? (updates.teletherapy ? 1 : 0) : (existing.teletherapy === 1 ? 1 : 0);
  const schoolHours = updates.schoolHours !== undefined 
    ? stringifyJsonField(updates.schoolHours)
    : existing.schoolHours;
  
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
  
  res.json({ message: 'School updated' });
}));

// Delete school
schoolsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid school ID' });
  }
  
  // First check if school exists
  const existing = db.prepare('SELECT * FROM schools WHERE id = ?').get(id) as SchoolRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'School not found' });
  }
  
  // Delete the school
  const result = db.prepare('DELETE FROM schools WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'School not found' });
  }
  
  res.json({ message: 'School deleted', deletedId: id });
}));

// Debug endpoint to check database
schoolsRouter.get('/debug/count', asyncHandler(async (_req, res) => {
  const count = db.prepare('SELECT COUNT(*) as count FROM schools').get() as { count: number };
  const allSchools = db.prepare('SELECT id, name FROM schools').all() as Array<{ id: string; name: string }>;
  res.json({ 
    count: count.count, 
    schools: allSchools,
    databasePath: process.cwd() + '/data/slp-caseload.db'
  });
}));
