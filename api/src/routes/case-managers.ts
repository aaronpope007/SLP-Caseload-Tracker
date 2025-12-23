import { Router } from 'express';
import { db } from '../db';

export const caseManagersRouter = Router();

// Debug endpoint to check all case managers
caseManagersRouter.get('/debug/all', (req, res) => {
  try {
    const all = db.prepare('SELECT * FROM case_managers').all();
    res.json({ count: all.length, caseManagers: all });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all case managers (optionally filtered by school)
caseManagersRouter.get('/', (req, res) => {
  try {
    const { school } = req.query;
    
    // First, get ALL case managers for debugging
    const allCaseManagers = db.prepare('SELECT * FROM case_managers').all() as any[];
    console.log(`[Case Managers API] Total case managers in DB: ${allCaseManagers.length}`);
    if (allCaseManagers.length > 0) {
      console.log(`[Case Managers API] All schools in DB:`, allCaseManagers.map(cm => ({
        name: cm.name,
        school: cm.school,
        schoolLength: cm.school?.length,
        schoolCharCodes: cm.school?.split('').map((c: string) => c.charCodeAt(0))
      })));
    }
    
    // Get all case managers first, then filter in JavaScript
    // This is more reliable than SQL filtering with complex OR conditions
    let caseManagers = db.prepare('SELECT * FROM case_managers ORDER BY name').all() as any[];
    console.log(`[Case Managers API] Total case managers in DB: ${caseManagers.length}`);
    
    // Filter by school if provided
    if (school && typeof school === 'string' && school.trim()) {
      const schoolName = school.trim();
      const schoolNameLower = schoolName.toLowerCase();
      console.log(`[Case Managers API] Filtering by school: "${schoolName}"`);
      
      const beforeFilter = caseManagers.length;
      caseManagers = caseManagers.filter((cm) => {
        const cmSchool = (cm.school || '').trim();
        const cmSchoolLower = cmSchool.toLowerCase();
        // Match exact school or empty school (for migration period)
        const matches = cmSchoolLower === schoolNameLower || cmSchool === '';
        if (!matches && cm.school) {
          console.log(`[Case Managers API] Filtered out: "${cm.name}" with school "${cm.school}" vs "${schoolName}"`);
        }
        return matches;
      });
      console.log(`[Case Managers API] After filtering: ${caseManagers.length} (was ${beforeFilter})`);
    }
    
    if (caseManagers.length > 0) {
      console.log(`[Case Managers API] Returning ${caseManagers.length} case managers`);
    } else if (school) {
      console.log(`[Case Managers API] WARNING: No case managers found for school "${school}"`);
      console.log(`[Case Managers API] Available schools in DB:`, [...new Set(allCaseManagers.map((cm: any) => cm.school))]);
    }
    
    if (caseManagers.length > 0) {
      console.log(`[Case Managers API] Returning ${caseManagers.length} case managers`);
    } else {
      console.log(`[Case Managers API] WARNING: Returning 0 case managers but DB has ${allCaseManagers.length} total`);
    }
    
    res.json(caseManagers);
  } catch (error: any) {
    console.error('[Case Managers API] Error:', error);
    console.error('[Case Managers API] Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Get case manager by ID
caseManagersRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const caseManager = db.prepare('SELECT * FROM case_managers WHERE id = ?').get(id) as any;
    
    if (!caseManager) {
      return res.status(404).json({ error: 'Case manager not found' });
    }
    
    res.json(caseManager);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create case manager
caseManagersRouter.post('/', (req, res) => {
  try {
    const caseManager = req.body;
    console.log('[Case Managers API] Creating case manager:', { 
      id: caseManager.id, 
      name: caseManager.name, 
      role: caseManager.role, 
      school: caseManager.school,
      hasId: !!caseManager.id,
      hasDateCreated: !!caseManager.dateCreated
    });
    
    // Generate ID and dateCreated if not provided (for API compatibility)
    const caseManagerId = caseManager.id || `cm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const dateCreated = caseManager.dateCreated || new Date().toISOString();
    
    // Ensure the school exists (create it if it doesn't)
    let schoolName = caseManager.school?.trim();
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
    
    if (!schoolName || schoolName === '') {
      console.warn('[Case Managers API] Warning: No school provided, using empty string');
    }
    
    const result = db.prepare(`
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
    
    console.log('[Case Managers API] Case manager created successfully:', { 
      id: caseManagerId, 
      changes: result.changes,
      school: schoolName || ''
    });
    
    // Verify it was saved
    const verify = db.prepare('SELECT * FROM case_managers WHERE id = ?').get(caseManagerId);
    console.log('[Case Managers API] Verification query result:', verify);
    
    if (!verify) {
      console.error('[Case Managers API] ERROR: Case manager was not saved!');
    }
    
    res.status(201).json({ id: caseManagerId, message: 'Case manager created' });
  } catch (error: any) {
    console.error('[Case Managers API] Error creating case manager:', error);
    console.error('[Case Managers API] Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Update case manager
caseManagersRouter.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = db.prepare('SELECT * FROM case_managers WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Case manager not found' });
    }
    
    const caseManager = { ...existing, ...updates };
    
    // Ensure the school exists (create it if it doesn't)
    let schoolName = caseManager.school?.trim();
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete case manager
caseManagersRouter.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM case_managers WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Case manager not found' });
    }
    
    res.json({ message: 'Case manager deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

