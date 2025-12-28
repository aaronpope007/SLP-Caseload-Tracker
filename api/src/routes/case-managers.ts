import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';

// Database row types
interface CaseManagerRow {
  id: string;
  name: string;
  role: string;
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

export const caseManagersRouter = Router();

// Debug endpoint to check all case managers
caseManagersRouter.get('/debug/all', asyncHandler(async (req, res) => {
  const all = db.prepare('SELECT * FROM case_managers').all() as CaseManagerRow[];
  res.json({ count: all.length, caseManagers: all });
}));

// Get all case managers (optionally filtered by school)
caseManagersRouter.get('/', asyncHandler(async (req, res) => {
  const { school } = req.query;
  
  // Get all case managers first, then filter in JavaScript
  // This is more reliable than SQL filtering with complex OR conditions
  let caseManagers = db.prepare('SELECT * FROM case_managers ORDER BY name').all() as CaseManagerRow[];
  
  // Filter by school if provided
  if (school && typeof school === 'string' && school.trim()) {
    const schoolName = school.trim();
    const schoolNameLower = schoolName.toLowerCase();
    
    caseManagers = caseManagers.filter((cm) => {
      const cmSchool = (cm.school || '').trim();
      const cmSchoolLower = cmSchool.toLowerCase();
      // Match exact school or empty school (for migration period)
      return cmSchoolLower === schoolNameLower || cmSchool === '';
    });
  }
  
  res.json(caseManagers);
}));

// Get case manager by ID
caseManagersRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const caseManager = db.prepare('SELECT * FROM case_managers WHERE id = ?').get(id) as CaseManagerRow | undefined;
  
  if (!caseManager) {
    return res.status(404).json({ error: 'Case manager not found' });
  }
  
  res.json(caseManager);
}));

// Create case manager
caseManagersRouter.post('/', asyncHandler(async (req, res) => {
  const caseManager = req.body;
  
  // Generate ID and dateCreated if not provided (for API compatibility)
  const caseManagerId = caseManager.id || `cm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const dateCreated = caseManager.dateCreated || new Date().toISOString();
  
  // Ensure the school exists (create it if it doesn't)
  let schoolName = caseManager.school?.trim();
  if (schoolName) {
    // Check for exact match first
    let existingSchool = db.prepare('SELECT * FROM schools WHERE name = ?').get(schoolName) as SchoolRow | undefined;
    
    // If no exact match, try case-insensitive
    if (!existingSchool) {
      const allSchools = db.prepare('SELECT * FROM schools').all() as SchoolRow[];
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
    INSERT INTO case_managers (id, name, role, school, phoneNumber, emailAddress, dateCreated)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    caseManagerId,
    caseManager.name,
    caseManager.role,
    schoolName || '',
    caseManager.phoneNumber || null,
    caseManager.emailAddress || null,
    dateCreated
  );
  
  res.status(201).json({ id: caseManagerId, message: 'Case manager created' });
}));

// Update case manager
caseManagersRouter.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const existing = db.prepare('SELECT * FROM case_managers WHERE id = ?').get(id) as CaseManagerRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Case manager not found' });
  }
  
  const caseManager = { ...existing, ...updates };
  
  // Ensure the school exists (create it if it doesn't)
  let schoolName = caseManager.school?.trim();
  if (schoolName) {
    // Check for exact match first
    let existingSchool = db.prepare('SELECT * FROM schools WHERE name = ?').get(schoolName) as SchoolRow | undefined;
    
    // If no exact match, try case-insensitive
    if (!existingSchool) {
      const allSchools = db.prepare('SELECT * FROM schools').all() as SchoolRow[];
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
    UPDATE case_managers 
    SET name = ?, role = ?, school = ?, phoneNumber = ?, emailAddress = ?
    WHERE id = ?
  `).run(
    caseManager.name,
    caseManager.role,
    schoolName || '',
    caseManager.phoneNumber || null,
    caseManager.emailAddress || null,
    id
  );
  
  res.json({ message: 'Case manager updated' });
}));

// Delete case manager
caseManagersRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM case_managers WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Case manager not found' });
  }
  
  res.json({ message: 'Case manager deleted' });
}));

