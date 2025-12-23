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
      school TEXT NOT NULL
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
  } catch (e: any) {
    console.warn('Could not add columns to students table:', e.message);
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

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_students_school ON students(school);
    CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
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

