import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Ensure data directory exists
const dataDir = join(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, 'slp-caseload.db');
export const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema
export function initDatabase() {
  // Schools table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      state TEXT NOT NULL,
      teletherapy INTEGER NOT NULL DEFAULT 0,
      dateCreated TEXT NOT NULL,
      schoolHours TEXT
    )
  `);
  
  // Add schoolHours column if it doesn't exist (for existing databases)
  try {
    const schoolTableInfo = db.prepare('PRAGMA table_info(schools)').all() as Array<{ name: string }>;
    const schoolColumnNames = schoolTableInfo.map(col => col.name);
    
    if (!schoolColumnNames.includes('schoolHours')) {
      db.exec(`ALTER TABLE schools ADD COLUMN schoolHours TEXT`);
    }
  } catch (e: any) {
    console.warn('Could not add schoolHours column to schools table:', e.message);
  }

  // Teachers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      grade TEXT NOT NULL,
      school TEXT NOT NULL,
      phoneNumber TEXT,
      emailAddress TEXT,
      dateCreated TEXT NOT NULL
    )
  `);

  // Case Managers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS case_managers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      school TEXT NOT NULL,
      phoneNumber TEXT,
      emailAddress TEXT,
      dateCreated TEXT NOT NULL
    )
  `);

  // Students table
  // Note: Foreign key constraint removed - we handle school validation in application code
  // This avoids case-sensitivity issues with SQLite foreign keys
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      grade TEXT NOT NULL,
      concerns TEXT NOT NULL,
      exceptionality TEXT,
      status TEXT NOT NULL CHECK(status IN ('active', 'discharged')),
      dateAdded TEXT NOT NULL,
      archived INTEGER DEFAULT 0,
      dateArchived TEXT,
      school TEXT NOT NULL,
      teacherId TEXT,
      caseManagerId TEXT
    )
  `);

  // Goals table
  db.exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      description TEXT NOT NULL,
      baseline TEXT NOT NULL,
      target TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('in-progress', 'achieved', 'modified')),
      dateCreated TEXT NOT NULL,
      dateAchieved TEXT,
      parentGoalId TEXT,
      subGoalIds TEXT,
      domain TEXT,
      priority TEXT CHECK(priority IN ('high', 'medium', 'low')),
      templateId TEXT,
      FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE
    )
  `);

  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      date TEXT NOT NULL,
      endTime TEXT,
      goalsTargeted TEXT NOT NULL,
      activitiesUsed TEXT NOT NULL,
      performanceData TEXT NOT NULL,
      notes TEXT NOT NULL,
      isDirectServices INTEGER DEFAULT 1,
      indirectServicesNotes TEXT,
      groupSessionId TEXT,
      missedSession INTEGER DEFAULT 0,
      selectedSubjectiveStatements TEXT,
      customSubjective TEXT,
      plan TEXT,
      FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE
    )
  `);

  // Add new columns if they don't exist (for existing databases)
  // SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we check pragma first
  try {
    const tableInfo = db.prepare('PRAGMA table_info(sessions)').all() as Array<{ name: string }>;
    const columnNames = tableInfo.map(col => col.name);
    
    if (!columnNames.includes('selectedSubjectiveStatements')) {
      db.exec(`ALTER TABLE sessions ADD COLUMN selectedSubjectiveStatements TEXT`);
    }
    
    if (!columnNames.includes('customSubjective')) {
      db.exec(`ALTER TABLE sessions ADD COLUMN customSubjective TEXT`);
    }
    
    if (!columnNames.includes('plan')) {
      db.exec(`ALTER TABLE sessions ADD COLUMN plan TEXT`);
    }
  } catch (e: any) {
    // If table doesn't exist yet, columns will be added via CREATE TABLE above
    console.warn('Could not add columns to sessions table:', e.message);
  }

  // Add new columns to students table if they don't exist
  try {
    const studentTableInfo = db.prepare('PRAGMA table_info(students)').all() as Array<{ name: string }>;
    const studentColumnNames = studentTableInfo.map(col => col.name);
    
    if (!studentColumnNames.includes('iepDate')) {
      db.exec(`ALTER TABLE students ADD COLUMN iepDate TEXT`);
    }
    if (!studentColumnNames.includes('annualReviewDate')) {
      db.exec(`ALTER TABLE students ADD COLUMN annualReviewDate TEXT`);
    }
    if (!studentColumnNames.includes('progressReportFrequency')) {
      db.exec(`ALTER TABLE students ADD COLUMN progressReportFrequency TEXT CHECK(progressReportFrequency IN ('quarterly', 'annual'))`);
    }
    if (!studentColumnNames.includes('teacherId')) {
      db.exec(`ALTER TABLE students ADD COLUMN teacherId TEXT`);
    }
    if (!studentColumnNames.includes('caseManagerId')) {
      db.exec(`ALTER TABLE students ADD COLUMN caseManagerId TEXT`);
    }
    if (!studentColumnNames.includes('frequencyPerWeek')) {
      db.exec(`ALTER TABLE students ADD COLUMN frequencyPerWeek INTEGER`);
    }
    if (!studentColumnNames.includes('frequencyType')) {
      db.exec(`ALTER TABLE students ADD COLUMN frequencyType TEXT CHECK(frequencyType IN ('per-week', 'per-month'))`);
    }
  } catch (e: any) {
    console.warn('Could not add columns to students table:', e.message);
  }

  // Add school column to teachers table if it doesn't exist
  try {
    const teacherTableInfo = db.prepare('PRAGMA table_info(teachers)').all() as Array<{ name: string }>;
    const teacherColumnNames = teacherTableInfo.map(col => col.name);
    
    if (!teacherColumnNames.includes('school')) {
      db.exec(`ALTER TABLE teachers ADD COLUMN school TEXT NOT NULL DEFAULT ''`);
    }
    
    // Migrate existing teachers: try to infer school from students that have this teacher assigned
    const teachersWithEmptySchool = db.prepare('SELECT id FROM teachers WHERE school = "" OR school IS NULL').all() as Array<{ id: string }>;
    if (teachersWithEmptySchool.length > 0) {
      for (const teacher of teachersWithEmptySchool) {
        // Try to find a student with this teacher assigned
        const studentWithTeacher = db.prepare('SELECT school FROM students WHERE teacherId = ? AND school IS NOT NULL AND school != "" LIMIT 1').get(teacher.id) as { school: string } | undefined;
        if (studentWithTeacher) {
          db.prepare('UPDATE teachers SET school = ? WHERE id = ?').run(studentWithTeacher.school, teacher.id);
        } else {
          // If no students have this teacher, try to get ALL schools and use the first one
          const allSchools = db.prepare('SELECT name FROM schools ORDER BY name').all() as Array<{ name: string }>;
          if (allSchools.length > 0) {
            const schoolName = allSchools[0].name;
            db.prepare('UPDATE teachers SET school = ? WHERE id = ?').run(schoolName, teacher.id);
            console.log(`  Set teacher ${teacher.id} school to ${schoolName} (from schools table, first of ${allSchools.length} schools)`);
          } else {
            // Try students table for any school
            const availableSchools = db.prepare('SELECT DISTINCT school FROM students WHERE school IS NOT NULL AND school != "" ORDER BY school LIMIT 1').get() as { school: string } | undefined;
            if (availableSchools) {
              db.prepare('UPDATE teachers SET school = ? WHERE id = ?').run(availableSchools.school, teacher.id);
            } else {
              // Last resort: use "Noble Academy" as default
              db.prepare('UPDATE teachers SET school = ? WHERE id = ?').run('Noble Academy', teacher.id);
            }
          }
        }
      }
    }
  } catch (e: any) {
    console.warn('Could not add school column to teachers table:', e.message);
  }

  // Add school column to case_managers table if it doesn't exist
  try {
    const caseManagerTableInfo = db.prepare('PRAGMA table_info(case_managers)').all() as Array<{ name: string }>;
    const caseManagerColumnNames = caseManagerTableInfo.map(col => col.name);
    
    if (!caseManagerColumnNames.includes('school')) {
      db.exec(`ALTER TABLE case_managers ADD COLUMN school TEXT NOT NULL DEFAULT ''`);
    }
  } catch (e: any) {
    console.warn('Could not add school column to case_managers table:', e.message);
  }

  // Migrate existing case managers: try to infer school from students that have this case manager assigned
  // This runs every time to fix any case managers with empty schools
  try {
    const caseManagersWithEmptySchool = db.prepare('SELECT id FROM case_managers WHERE school = "" OR school IS NULL').all() as Array<{ id: string }>;
    if (caseManagersWithEmptySchool.length > 0) {
      console.log(`Migrating ${caseManagersWithEmptySchool.length} case managers with empty school...`);
      for (const caseManager of caseManagersWithEmptySchool) {
        // Try to find a student with this case manager assigned
        const studentWithCaseManager = db.prepare('SELECT school FROM students WHERE caseManagerId = ? AND school IS NOT NULL AND school != "" LIMIT 1').get(caseManager.id) as { school: string } | undefined;
        if (studentWithCaseManager) {
          db.prepare('UPDATE case_managers SET school = ? WHERE id = ?').run(studentWithCaseManager.school, caseManager.id);
          console.log(`  Set case manager ${caseManager.id} school to ${studentWithCaseManager.school} (from student)`);
        } else {
          // If no students have this case manager, try to get ALL schools and use the first one
          // This ensures we get a valid school even if the first query returns nothing
          const allSchools = db.prepare('SELECT name FROM schools ORDER BY name').all() as Array<{ name: string }>;
          if (allSchools.length > 0) {
            const schoolName = allSchools[0].name;
            db.prepare('UPDATE case_managers SET school = ? WHERE id = ?').run(schoolName, caseManager.id);
            console.log(`  Set case manager ${caseManager.id} school to ${schoolName} (from schools table, first of ${allSchools.length} schools)`);
          } else {
            // Try students table for any school
            const availableSchools = db.prepare('SELECT DISTINCT school FROM students WHERE school IS NOT NULL AND school != "" ORDER BY school LIMIT 1').get() as { school: string } | undefined;
            if (availableSchools) {
              db.prepare('UPDATE case_managers SET school = ? WHERE id = ?').run(availableSchools.school, caseManager.id);
              console.log(`  Set case manager ${caseManager.id} school to ${availableSchools.school} (from students)`);
            } else {
              // Last resort: use "Noble Academy" as default
              db.prepare('UPDATE case_managers SET school = ? WHERE id = ?').run('Noble Academy', caseManager.id);
              console.log(`  Set case manager ${caseManager.id} school to Noble Academy (default)`);
            }
          }
        }
      }
    }
  } catch (e: any) {
    console.warn('Could not migrate case managers with empty school:', e.message);
  }

  // Progress Reports table
  db.exec(`
    CREATE TABLE IF NOT EXISTS progress_reports (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      reportType TEXT NOT NULL CHECK(reportType IN ('quarterly', 'annual')),
      dueDate TEXT NOT NULL,
      scheduledDate TEXT NOT NULL,
      periodStart TEXT NOT NULL,
      periodEnd TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('scheduled', 'in-progress', 'completed', 'overdue')),
      completedDate TEXT,
      templateId TEXT,
      content TEXT,
      dateCreated TEXT NOT NULL,
      dateUpdated TEXT NOT NULL,
      customDueDate TEXT,
      reminderSent INTEGER DEFAULT 0,
      reminderSentDate TEXT,
      FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE
    )
  `);

  // Progress Report Templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS progress_report_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      reportType TEXT NOT NULL CHECK(reportType IN ('quarterly', 'annual')),
      sections TEXT NOT NULL,
      isDefault INTEGER DEFAULT 0,
      dateCreated TEXT NOT NULL,
      dateUpdated TEXT NOT NULL
    )
  `);

  // Due Date Items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS due_date_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      dueDate TEXT NOT NULL,
      studentId TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'overdue')),
      completedDate TEXT,
      category TEXT,
      priority TEXT CHECK(priority IN ('high', 'medium', 'low')),
      dateCreated TEXT NOT NULL,
      dateUpdated TEXT NOT NULL,
      FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE SET NULL
    )
  `);

  // Activities table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      goalArea TEXT NOT NULL,
      ageRange TEXT NOT NULL,
      materials TEXT NOT NULL,
      isFavorite INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL CHECK(source IN ('AI', 'manual')),
      dateCreated TEXT NOT NULL
    )
  `);

  // Evaluations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      grade TEXT NOT NULL,
      evaluationType TEXT NOT NULL,
      areasOfConcern TEXT NOT NULL,
      teacher TEXT,
      resultsOfScreening TEXT,
      dueDate TEXT,
      assessments TEXT,
      qualify TEXT,
      reportCompleted TEXT,
      iepCompleted TEXT,
      meetingDate TEXT,
      dateCreated TEXT NOT NULL,
      dateUpdated TEXT NOT NULL,
      FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE
    )
  `);

  // SOAP Notes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS soap_notes (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      studentId TEXT NOT NULL,
      date TEXT NOT NULL,
      templateId TEXT,
      subjective TEXT NOT NULL,
      objective TEXT NOT NULL,
      assessment TEXT NOT NULL,
      plan TEXT NOT NULL,
      dateCreated TEXT NOT NULL,
      dateUpdated TEXT NOT NULL,
      FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE
    )
  `);

  // Communications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS communications (
      id TEXT PRIMARY KEY,
      studentId TEXT,
      contactType TEXT NOT NULL CHECK(contactType IN ('teacher', 'parent', 'case-manager')),
      contactId TEXT,
      contactName TEXT NOT NULL,
      contactEmail TEXT,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      method TEXT NOT NULL CHECK(method IN ('email', 'phone', 'in-person', 'other')),
      date TEXT NOT NULL,
      sessionId TEXT,
      relatedTo TEXT,
      dateCreated TEXT NOT NULL,
      FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE SET NULL,
      FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE SET NULL
    )
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_students_school ON students(school);
    CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
    CREATE INDEX IF NOT EXISTS idx_students_teacherId ON students(teacherId);
    CREATE INDEX IF NOT EXISTS idx_students_caseManagerId ON students(caseManagerId);
    CREATE INDEX IF NOT EXISTS idx_teachers_school ON teachers(school);
    CREATE INDEX IF NOT EXISTS idx_case_managers_school ON case_managers(school);
    CREATE INDEX IF NOT EXISTS idx_goals_studentId ON goals(studentId);
    CREATE INDEX IF NOT EXISTS idx_sessions_studentId ON sessions(studentId);
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
    CREATE INDEX IF NOT EXISTS idx_evaluations_studentId ON evaluations(studentId);
    CREATE INDEX IF NOT EXISTS idx_soap_notes_sessionId ON soap_notes(sessionId);
    CREATE INDEX IF NOT EXISTS idx_soap_notes_studentId ON soap_notes(studentId);
    CREATE INDEX IF NOT EXISTS idx_soap_notes_date ON soap_notes(date);
    CREATE INDEX IF NOT EXISTS idx_progress_reports_studentId ON progress_reports(studentId);
    CREATE INDEX IF NOT EXISTS idx_progress_reports_dueDate ON progress_reports(dueDate);
    CREATE INDEX IF NOT EXISTS idx_progress_reports_status ON progress_reports(status);
    CREATE INDEX IF NOT EXISTS idx_due_date_items_studentId ON due_date_items(studentId);
    CREATE INDEX IF NOT EXISTS idx_due_date_items_dueDate ON due_date_items(dueDate);
    CREATE INDEX IF NOT EXISTS idx_due_date_items_status ON due_date_items(status);
    CREATE INDEX IF NOT EXISTS idx_communications_studentId ON communications(studentId);
    CREATE INDEX IF NOT EXISTS idx_communications_contactType ON communications(contactType);
    CREATE INDEX IF NOT EXISTS idx_communications_date ON communications(date);
    CREATE INDEX IF NOT EXISTS idx_communications_sessionId ON communications(sessionId);
  `);

  // Drop lunches table if it exists (removed feature)
  try {
    // Check if lunches table exists
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='lunches'
    `).get() as { name: string } | undefined;
    
    if (tables) {
      console.log('Removing lunches table (feature removed)...');
      // Temporarily disable foreign keys to allow dropping the table
      db.pragma('foreign_keys = OFF');
      db.exec('DROP TABLE IF EXISTS lunches');
      db.pragma('foreign_keys = ON');
      console.log('✅ Removed lunches table');
    }
  } catch (e: any) {
    console.warn('Could not remove lunches table:', e.message);
    // Make sure foreign keys are re-enabled even if there's an error
    db.pragma('foreign_keys = ON');
  }

  console.log('Database initialized successfully');
}

// Close database connection gracefully
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  db.close();
  process.exit(0);
});

