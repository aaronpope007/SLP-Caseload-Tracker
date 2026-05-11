import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { parseJsonField, stringifyJsonField } from '../utils/jsonHelpers';
import { createStudentSchema, updateStudentSchema } from '../schemas';
import { mapGoalsWithGemini } from '../utils/geminiMapGoals';
import { splitStudentName } from '../utils/studentName';

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
  gender: string | null;
  dob: string | null;
  maNumber: string | null;
  tsgoals: string | null;
  domain: string | null;
  icd10Codes: string | null;
  icd10Descriptions: string | null;
  cptCodeIndividual: string | null;
  cptCodeGroup: string | null;
  codesMappedAt: string | null;
  codesMappedByAI: number | null;
}

function parseTsGoals(row: StudentRow): unknown[] {
  const raw = row.tsgoals;
  if (!raw || raw === 'null') return [];
  const parsed = parseJsonField<unknown>(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

function tsgoalsJsonForDb(ts: unknown, existing: string | null): string {
  if (Array.isArray(ts)) return stringifyJsonField(ts) ?? '[]';
  if (typeof ts === 'string' && ts.trim()) return ts;
  if (existing && existing !== 'null') return existing;
  return '[]';
}

const mapGoalsBodySchema = z.object({
  apiKey: z.string().optional(),
});

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

/**
 * @openapi
 * /api/students:
 *   get:
 *     tags: [Students]
 *     summary: Get all students
 *     description: Retrieve all students, optionally filtered by school, teacher, or case manager
 *     parameters:
 *       - in: query
 *         name: school
 *         schema:
 *           type: string
 *         description: Filter by school ID
 *       - in: query
 *         name: teacherId
 *         schema:
 *           type: string
 *         description: Filter by teacher ID
 *       - in: query
 *         name: caseManagerId
 *         schema:
 *           type: string
 *         description: Filter by case manager ID
 *     responses:
 *       200:
 *         description: List of students
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Student'
 */
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
  const parsed = students.map((s) => {
    const {
      tsgoals: _ts,
      domain: _omitDomain,
      icd10Codes: _omitIcd,
      icd10Descriptions: _omitIcdDesc,
      cptCodeIndividual: _omitCptI,
      cptCodeGroup: _omitCptG,
      codesMappedAt: _omitMappedAt,
      codesMappedByAI: _omitMappedByAi,
      ...rest
    } = s;
    return {
      ...rest,
      concerns: parseJsonField<string[]>(s.concerns, []),
      exceptionality: parseJsonField<string[]>(s.exceptionality, undefined),
      archived: s.archived === 1,
      gender: s.gender || undefined,
      dob: s.dob || undefined,
      maNumber: s.maNumber || undefined,
      tsgoals: parseTsGoals(s),
      domain: s.domain || undefined,
      icd10Codes: parseJsonField<string[]>(s.icd10Codes, []),
      icd10Descriptions: parseJsonField<string[]>(s.icd10Descriptions, []),
      cptCodeIndividual: s.cptCodeIndividual ?? undefined,
      cptCodeGroup: s.cptCodeGroup ?? undefined,
      codesMappedAt: s.codesMappedAt || undefined,
      codesMappedByAI: s.codesMappedByAI === 1,
    };
  });
  
  res.json(parsed);
}));

studentsRouter.get('/goals-export', asyncHandler(async (req, res) => {
  const schoolParam = req.query.school;
  if (!schoolParam || typeof schoolParam !== 'string' || !schoolParam.trim()) {
    return res.status(400).json({ error: 'Missing required query parameter: school' });
  }
  const school = schoolParam.trim();

  const rows = db
    .prepare(
      `
    SELECT s.id, s.name, s.dob, s.maNumber, g.description as goalDescription, g.status as goalStatus, g.archived as goalArchived
    FROM students s
    LEFT JOIN goals g ON g.studentId = s.id
      AND g.status != 'achieved'
    WHERE s.status = 'active' AND (s.archived IS NULL OR s.archived = 0)
      AND s.school = ?
  `
    )
    .all(school) as Array<{
    id: string;
    name: string;
    dob: string | null;
    maNumber: string | null;
    goalDescription: string | null;
    goalStatus: string | null;
    goalArchived: number | null;
  }>;

  const byStudent = new Map<
    string,
    {
      firstName: string;
      lastName: string;
      dob?: string;
      maNumber?: string;
      goals: { goalText: string; archived?: boolean }[];
    }
  >();

  for (const row of rows) {
    const { firstName, lastName } = splitStudentName(row.name);
    if (!byStudent.has(row.id)) {
      byStudent.set(row.id, {
        firstName,
        lastName,
        dob: row.dob || undefined,
        maNumber: row.maNumber || undefined,
        goals: [],
      });
    }
    if (row.goalDescription && row.goalDescription.trim()) {
      const archived = row.goalArchived === 1;
      byStudent.get(row.id)!.goals.push({ goalText: row.goalDescription.trim(), archived });
    }
  }

  for (const entry of byStudent.values()) {
    entry.goals.sort((a, b) => {
      const ac = a.archived ? 1 : 0;
      const bc = b.archived ? 1 : 0;
      if (ac !== bc) return ac - bc;
      return a.goalText.localeCompare(b.goalText, undefined, { sensitivity: 'base' });
    });
  }

  const list = Array.from(byStudent.values()).sort((a, b) => {
    const ln = a.lastName.localeCompare(b.lastName, undefined, { sensitivity: 'base' });
    if (ln !== 0) return ln;
    return a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' });
  });

  res.json(list);
}));

studentsRouter.post('/:id/map-goals', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const parsed = mapGoalsBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const apiKey = parsed.data.apiKey || process.env.GEMINI_API_KEY;

    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id) as StudentRow | undefined;
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const goalRows = db
      .prepare(
        `SELECT id, description FROM goals WHERE studentId = ? AND (archived IS NULL OR archived = 0) AND status = 'in-progress'`
      )
      .all(id) as Array<{ id: string; description: string }>;

    if (goalRows.length === 0) {
      return res.status(400).json({ error: 'No in-progress goals to map for this student' });
    }

    const inputs = goalRows.map((g) => ({ goalId: g.id, goalText: g.description }));
    const mappings = await mapGoalsWithGemini(apiKey || '', inputs);
    res.json({ mappings });
}));

/**
 * @openapi
 * /api/students/{id}:
 *   get:
 *     tags: [Students]
 *     summary: Get student by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ID
 *     responses:
 *       200:
 *         description: Student details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Student'
 *       404:
 *         description: Student not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
studentsRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id) as StudentRow | undefined;
  
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }
  
  const {
    tsgoals: _ts,
    domain: _omitDomain,
    icd10Codes: _omitIcd,
    icd10Descriptions: _omitIcdDesc,
    cptCodeIndividual: _omitCptI,
    cptCodeGroup: _omitCptG,
    codesMappedAt: _omitMappedAt,
    codesMappedByAI: _omitMappedByAi,
    ...base
  } = student;
  res.json({
    ...base,
    concerns: parseJsonField<string[]>(student.concerns, []),
    exceptionality: parseJsonField<string[]>(student.exceptionality, undefined),
    archived: student.archived === 1,
    gender: student.gender || undefined,
    dob: student.dob || undefined,
    maNumber: student.maNumber || undefined,
    tsgoals: parseTsGoals(student),
    domain: student.domain || undefined,
    icd10Codes: parseJsonField<string[]>(student.icd10Codes, []),
    icd10Descriptions: parseJsonField<string[]>(student.icd10Descriptions, []),
    cptCodeIndividual: student.cptCodeIndividual ?? undefined,
    cptCodeGroup: student.cptCodeGroup ?? undefined,
    codesMappedAt: student.codesMappedAt || undefined,
    codesMappedByAI: student.codesMappedByAI === 1,
  });
}));

/**
 * @openapi
 * /api/students:
 *   post:
 *     tags: [Students]
 *     summary: Create a new student
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Student'
 *     responses:
 *       201:
 *         description: Student created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Student'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
studentsRouter.post('/', validateBody(createStudentSchema), asyncHandler(async (req, res) => {
  const student = req.body;
  
  // Ensure the school exists (create it if it doesn't)
  const schoolName = ensureSchoolExists(student.school);
  
  // Generate ID if not provided
  const studentId = student.id || `student-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const dateAdded = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO students (id, name, age, grade, concerns, exceptionality, status, dateAdded, archived, dateArchived, school, teacherId, caseManagerId, iepDate, annualReviewDate, progressReportFrequency, frequencyPerWeek, frequencyType, gender, dob, maNumber, tsgoals, domain, icd10Codes, icd10Descriptions, cptCodeIndividual, cptCodeGroup, codesMappedAt, codesMappedByAI)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    student.frequencyType || null,
    student.gender || null,
    student.dob || null,
    student.maNumber || null,
    tsgoalsJsonForDb(student.tsgoals, null),
    student.domain ?? null,
    stringifyJsonField(student.icd10Codes ?? []) ?? '[]',
    stringifyJsonField(student.icd10Descriptions ?? []) ?? '[]',
    student.cptCodeIndividual ?? '92507',
    student.cptCodeGroup ?? '92508',
    student.codesMappedAt ?? null,
    student.codesMappedByAI ? 1 : 0
  );
  
  res.status(201).json({ id: studentId, message: 'Student created' });
}));

/**
 * @openapi
 * /api/students/bulk:
 *   post:
 *     tags: [Students]
 *     summary: Create or update multiple students in a single transaction
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               students:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Student'
 *     responses:
 *       200:
 *         description: Bulk operation completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 created:
 *                   type: number
 *                 updated:
 *                   type: number
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 */
studentsRouter.post('/bulk', asyncHandler(async (req, res) => {
  const { students } = req.body;
  
  if (!Array.isArray(students)) {
    return res.status(400).json({ error: 'students must be an array' });
  }
  
  let created = 0;
  let updated = 0;
  const errors: Array<{ id?: string; error: string }> = [];
  
  // Use a transaction for atomicity
  const transaction = db.transaction(() => {
    for (const student of students) {
      try {
        const existing = db.prepare('SELECT id FROM students WHERE id = ?').get(student.id) as { id: string } | undefined;
        
        if (existing) {
          // Update existing student
          const schoolName = student.school ? ensureSchoolExists(student.school) : undefined;
          const existingFull = db.prepare('SELECT * FROM students WHERE id = ?').get(student.id) as StudentRow | undefined;
          
          if (!existingFull) {
            errors.push({ id: student.id, error: 'Student not found for update' });
            continue;
          }
          
          const merged = {
            ...existingFull,
            concerns: parseJsonField<string[]>(existingFull.concerns, []),
            exceptionality: parseJsonField<string[]>(existingFull.exceptionality, undefined),
            ...student,
          };
          
          const finalSchoolName = schoolName || existingFull.school;
          
          db.prepare(`
            UPDATE students 
            SET name = ?, age = ?, grade = ?, concerns = ?, exceptionality = ?, status = ?, 
                archived = ?, dateArchived = ?, school = ?, teacherId = ?, caseManagerId = ?, 
                iepDate = ?, annualReviewDate = ?, progressReportFrequency = ?, 
                frequencyPerWeek = ?, frequencyType = ?, gender = ?, dob = ?, maNumber = ?, tsgoals = ?,
                domain = ?, icd10Codes = ?, icd10Descriptions = ?, cptCodeIndividual = ?, cptCodeGroup = ?,
                codesMappedAt = ?, codesMappedByAI = ?
            WHERE id = ?
          `).run(
            merged.name,
            merged.age,
            merged.grade || '',
            stringifyJsonField(merged.concerns || []),
            stringifyJsonField(merged.exceptionality),
            merged.status,
            merged.archived ? 1 : 0,
            merged.dateArchived || null,
            finalSchoolName,
            merged.teacherId || null,
            merged.caseManagerId || null,
            merged.iepDate || null,
            merged.annualReviewDate || null,
            merged.progressReportFrequency || null,
            merged.frequencyPerWeek ?? null,
            merged.frequencyType || null,
            merged.gender || null,
            merged.dob ?? existingFull.dob,
            merged.maNumber ?? existingFull.maNumber,
            tsgoalsJsonForDb(merged.tsgoals, existingFull.tsgoals),
            merged.domain ?? existingFull.domain,
            stringifyJsonField(
              Array.isArray(merged.icd10Codes)
                ? merged.icd10Codes
                : typeof merged.icd10Codes === 'string'
                  ? parseJsonField<string[]>(merged.icd10Codes, [])
                  : parseJsonField<string[]>(existingFull.icd10Codes, [])
            ) ?? '[]',
            stringifyJsonField(
              Array.isArray(merged.icd10Descriptions)
                ? merged.icd10Descriptions
                : typeof merged.icd10Descriptions === 'string'
                  ? parseJsonField<string[]>(merged.icd10Descriptions, [])
                  : parseJsonField<string[]>(existingFull.icd10Descriptions, [])
            ) ?? '[]',
            merged.cptCodeIndividual ?? existingFull.cptCodeIndividual ?? '92507',
            merged.cptCodeGroup ?? existingFull.cptCodeGroup ?? '92508',
            merged.codesMappedAt ?? existingFull.codesMappedAt,
            merged.codesMappedByAI !== undefined && merged.codesMappedByAI !== null
              ? merged.codesMappedByAI
                ? 1
                : 0
              : (existingFull.codesMappedByAI ?? 0),
            student.id
          );
          updated++;
        } else {
          // Create new student
          const schoolName = ensureSchoolExists(student.school);
          const studentId = student.id || `student-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const dateAdded = new Date().toISOString();
          
          db.prepare(`
            INSERT INTO students (id, name, age, grade, concerns, exceptionality, status, dateAdded, archived, dateArchived, school, teacherId, caseManagerId, iepDate, annualReviewDate, progressReportFrequency, frequencyPerWeek, frequencyType, gender, dob, maNumber, tsgoals, domain, icd10Codes, icd10Descriptions, cptCodeIndividual, cptCodeGroup, codesMappedAt, codesMappedByAI)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            student.frequencyType || null,
            student.gender || null,
            student.dob || null,
            student.maNumber || null,
            tsgoalsJsonForDb(student.tsgoals, null),
            student.domain ?? null,
            stringifyJsonField(student.icd10Codes ?? []) ?? '[]',
            stringifyJsonField(student.icd10Descriptions ?? []) ?? '[]',
            student.cptCodeIndividual ?? '92507',
            student.cptCodeGroup ?? '92508',
            student.codesMappedAt ?? null,
            student.codesMappedByAI ? 1 : 0
          );
          created++;
        }
      } catch (error) {
        errors.push({ 
          id: student.id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  });
  
  transaction();
  
  res.json({ created, updated, errors });
}));

/**
 * @openapi
 * /api/students/{id}:
 *   put:
 *     tags: [Students]
 *     summary: Update a student
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Student'
 *     responses:
 *       200:
 *         description: Student updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Student'
 *       404:
 *         description: Student not found
 */
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
  
  const icd10CodesForDb = Array.isArray(student.icd10Codes)
    ? student.icd10Codes
    : typeof student.icd10Codes === 'string'
      ? parseJsonField<string[]>(student.icd10Codes, [])
      : parseJsonField<string[]>(existing.icd10Codes, []);
  const icd10DescForDb = Array.isArray(student.icd10Descriptions)
    ? student.icd10Descriptions
    : typeof student.icd10Descriptions === 'string'
      ? parseJsonField<string[]>(student.icd10Descriptions, [])
      : parseJsonField<string[]>(existing.icd10Descriptions, []);

  db.prepare(`
    UPDATE students 
    SET name = ?, age = ?, grade = ?, concerns = ?, exceptionality = ?, status = ?, 
        archived = ?, dateArchived = ?, school = ?, teacherId = ?, caseManagerId = ?, iepDate = ?, annualReviewDate = ?, progressReportFrequency = ?, frequencyPerWeek = ?, frequencyType = ?, gender = ?, dob = ?, maNumber = ?, tsgoals = ?,
        domain = ?, icd10Codes = ?, icd10Descriptions = ?, cptCodeIndividual = ?, cptCodeGroup = ?,
        codesMappedAt = ?, codesMappedByAI = ?
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
    student.gender || null,
    student.dob ?? existing.dob,
    student.maNumber ?? existing.maNumber,
    tsgoalsJsonForDb(student.tsgoals, existing.tsgoals),
    student.domain ?? existing.domain,
    stringifyJsonField(icd10CodesForDb) ?? '[]',
    stringifyJsonField(icd10DescForDb) ?? '[]',
    student.cptCodeIndividual ?? existing.cptCodeIndividual ?? '92507',
    student.cptCodeGroup ?? existing.cptCodeGroup ?? '92508',
    student.codesMappedAt ?? existing.codesMappedAt,
    student.codesMappedByAI !== undefined && student.codesMappedByAI !== null
      ? student.codesMappedByAI
        ? 1
        : 0
      : (existing.codesMappedByAI ?? 0),
    id
  );
  
  res.json({ message: 'Student updated' });
}));

/**
 * @openapi
 * /api/students/{id}:
 *   delete:
 *     tags: [Students]
 *     summary: Delete a student
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Student deleted
 *       404:
 *         description: Student not found
 */
studentsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM students WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Student not found' });
  }
  
  res.json({ message: 'Student deleted' });
}));
