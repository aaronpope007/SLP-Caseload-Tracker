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
      FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE
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

  // Lunches table
  db.exec(`
    CREATE TABLE IF NOT EXISTS lunches (
      id TEXT PRIMARY KEY,
      school TEXT NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      dateCreated TEXT NOT NULL,
      FOREIGN KEY (school) REFERENCES schools(name)
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
    CREATE INDEX IF NOT EXISTS idx_lunches_school ON lunches(school);
  `);

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

