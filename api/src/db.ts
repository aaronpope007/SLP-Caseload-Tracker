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
  
  // Add schoolHours and studentTimes columns if they don't exist (for existing databases)
  try {
    const schoolTableInfo = db.prepare('PRAGMA table_info(schools)').all() as Array<{ name: string }>;
    const schoolColumnNames = schoolTableInfo.map(col => col.name);
    
    if (!schoolColumnNames.includes('schoolHours')) {
      db.exec(`ALTER TABLE schools ADD COLUMN schoolHours TEXT`);
    }
    if (!schoolColumnNames.includes('studentTimes')) {
      db.exec(`ALTER TABLE schools ADD COLUMN studentTimes TEXT`);
    }
  } catch (e: any) {
    console.warn('Could not add schoolHours or studentTimes column to schools table:', e.message);
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
    if (!studentColumnNames.includes('gender')) {
      db.exec(`ALTER TABLE students ADD COLUMN gender TEXT CHECK(gender IN ('male', 'female', 'non-binary'))`);
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
    if (!teacherColumnNames.includes('gender')) {
      db.exec(`ALTER TABLE teachers ADD COLUMN gender TEXT CHECK(gender IN ('male', 'female', 'non-binary'))`);
    }
    
    // Migrate existing teachers: try to infer school from students that have this teacher assigned
    const teachersWithEmptySchool = db.prepare('SELECT id FROM teachers WHERE school = ? OR school IS NULL').all('') as Array<{ id: string }>;
    if (teachersWithEmptySchool.length > 0) {
      for (const teacher of teachersWithEmptySchool) {
        // Try to find a student with this teacher assigned
        const studentWithTeacher = db.prepare('SELECT school FROM students WHERE teacherId = ? AND school IS NOT NULL AND school != ? LIMIT 1').get(teacher.id, '') as { school: string } | undefined;
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
            const availableSchools = db.prepare('SELECT DISTINCT school FROM students WHERE school IS NOT NULL AND school != ? ORDER BY school LIMIT 1').get('') as { school: string } | undefined;
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
    if (!caseManagerColumnNames.includes('gender')) {
      db.exec(`ALTER TABLE case_managers ADD COLUMN gender TEXT CHECK(gender IN ('male', 'female', 'non-binary'))`);
    }
  } catch (e: any) {
    console.warn('Could not add school column to case_managers table:', e.message);
  }

  // Migrate existing case managers: try to infer school from students that have this case manager assigned
  // This runs every time to fix any case managers with empty schools
  try {
    const caseManagersWithEmptySchool = db.prepare('SELECT id FROM case_managers WHERE school = ? OR school IS NULL').all('') as Array<{ id: string }>;
    if (caseManagersWithEmptySchool.length > 0) {
      console.log(`Migrating ${caseManagersWithEmptySchool.length} case managers with empty school...`);
      for (const caseManager of caseManagersWithEmptySchool) {
        // Try to find a student with this case manager assigned
        const studentWithCaseManager = db.prepare('SELECT school FROM students WHERE caseManagerId = ? AND school IS NOT NULL AND school != ? LIMIT 1').get(caseManager.id, '') as { school: string } | undefined;
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
            const availableSchools = db.prepare('SELECT DISTINCT school FROM students WHERE school IS NOT NULL AND school != ? ORDER BY school LIMIT 1').get('') as { school: string } | undefined;
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

  // Add finalReportText column if it doesn't exist (for existing databases)
  try {
    const progressReportsTableInfo = db.prepare('PRAGMA table_info(progress_reports)').all() as Array<{ name: string }>;
    const progressReportsColumnNames = progressReportsTableInfo.map(col => col.name);
    
    if (!progressReportsColumnNames.includes('finalReportText')) {
      db.exec(`ALTER TABLE progress_reports ADD COLUMN finalReportText TEXT`);
    }
  } catch (e: any) {
    console.warn('Could not add finalReportText column to progress_reports table:', e.message);
  }

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

  // Articulation Screeners table
  db.exec(`
    CREATE TABLE IF NOT EXISTS articulation_screeners (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      date TEXT NOT NULL,
      disorderedPhonemes TEXT NOT NULL,
      report TEXT,
      evaluationId TEXT,
      dateCreated TEXT NOT NULL,
      dateUpdated TEXT NOT NULL,
      FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (evaluationId) REFERENCES evaluations(id) ON DELETE SET NULL
    )
  `);

  // Reassessment Plans table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reassessment_plans (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      evaluationId TEXT,
      title TEXT NOT NULL,
      description TEXT,
      dueDate TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'in-progress', 'completed')),
      templateId TEXT,
      dateCreated TEXT NOT NULL,
      dateUpdated TEXT NOT NULL,
      FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (evaluationId) REFERENCES evaluations(id) ON DELETE SET NULL
    )
  `);

  // Reassessment Plan Items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reassessment_plan_items (
      id TEXT PRIMARY KEY,
      planId TEXT NOT NULL,
      description TEXT NOT NULL,
      dueDate TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      completedDate TEXT,
      order_index INTEGER NOT NULL DEFAULT 0,
      dateCreated TEXT NOT NULL,
      dateUpdated TEXT NOT NULL,
      FOREIGN KEY (planId) REFERENCES reassessment_plans(id) ON DELETE CASCADE
    )
  `);

  // Reassessment Plan Templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reassessment_plan_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      items TEXT NOT NULL,
      dateCreated TEXT NOT NULL,
      dateUpdated TEXT NOT NULL
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

  // Timesheet Notes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS timesheet_notes (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      dateCreated TEXT NOT NULL,
      dateFor TEXT,
      school TEXT NOT NULL
    )
  `);

  // Scheduled Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_sessions (
      id TEXT PRIMARY KEY,
      studentIds TEXT NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT,
      duration INTEGER,
      dayOfWeek TEXT,
      specificDates TEXT,
      recurrencePattern TEXT NOT NULL CHECK(recurrencePattern IN ('weekly', 'daily', 'specific-dates', 'none')),
      startDate TEXT NOT NULL,
      endDate TEXT,
      goalsTargeted TEXT NOT NULL,
      notes TEXT,
      isDirectServices INTEGER DEFAULT 1,
      dateCreated TEXT NOT NULL,
      dateUpdated TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      cancelledDates TEXT
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
    CREATE INDEX IF NOT EXISTS idx_reassessment_plans_studentId ON reassessment_plans(studentId);
    CREATE INDEX IF NOT EXISTS idx_reassessment_plans_evaluationId ON reassessment_plans(evaluationId);
    CREATE INDEX IF NOT EXISTS idx_reassessment_plans_dueDate ON reassessment_plans(dueDate);
    CREATE INDEX IF NOT EXISTS idx_reassessment_plan_items_planId ON reassessment_plan_items(planId);
    CREATE INDEX IF NOT EXISTS idx_due_date_items_status ON due_date_items(status);
    CREATE INDEX IF NOT EXISTS idx_communications_studentId ON communications(studentId);
    CREATE INDEX IF NOT EXISTS idx_communications_contactType ON communications(contactType);
    CREATE INDEX IF NOT EXISTS idx_communications_date ON communications(date);
    CREATE INDEX IF NOT EXISTS idx_communications_sessionId ON communications(sessionId);
    CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_active ON scheduled_sessions(active);
    CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_startDate ON scheduled_sessions(startDate);
    CREATE INDEX IF NOT EXISTS idx_iep_notes_studentId ON iep_notes(studentId);
    CREATE INDEX IF NOT EXISTS idx_iep_notes_dateUpdated ON iep_notes(dateUpdated);
  `);

  // Dismissed Reminders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS dismissed_reminders (
      id TEXT PRIMARY KEY,
      reminderType TEXT NOT NULL,
      studentId TEXT NOT NULL,
      relatedId TEXT,
      dismissedAt TEXT NOT NULL,
      dismissedState TEXT,
      FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dismissed_reminders_studentId ON dismissed_reminders(studentId);
    CREATE INDEX IF NOT EXISTS idx_dismissed_reminders_type ON dismissed_reminders(reminderType);
  `);

  // Todos table
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      dateCreated TEXT NOT NULL,
      dateUpdated TEXT NOT NULL,
      completedDate TEXT
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
    CREATE INDEX IF NOT EXISTS idx_todos_dateCreated ON todos(dateCreated);
  `);

  // Meetings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      endTime TEXT,
      school TEXT NOT NULL,
      studentId TEXT,
      category TEXT,
      dateCreated TEXT NOT NULL,
      dateUpdated TEXT NOT NULL,
      FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE SET NULL
    )
  `);

  // Combined Progress Notes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS combined_progress_notes (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      content TEXT NOT NULL,
      selectedGoalIds TEXT,
      dateCreated TEXT NOT NULL,
      dateUpdated TEXT NOT NULL,
      FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE
    )
  `);

  // IEP Notes table (AI-generated IEP Communication section updates)
  db.exec(`
    CREATE TABLE IF NOT EXISTS iep_notes (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      previousNote TEXT NOT NULL,
      generatedNote TEXT NOT NULL,
      dateCreated TEXT NOT NULL,
      dateUpdated TEXT NOT NULL,
      FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_meetings_school ON meetings(school);
    CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date);
    CREATE INDEX IF NOT EXISTS idx_meetings_studentId ON meetings(studentId);
  `);

  // Add activitySubtype to meetings if missing (for IEP / Assessment: meeting vs updates)
  try {
    const meetingTableInfo = db.prepare('PRAGMA table_info(meetings)').all() as Array<{ name: string }>;
    const meetingColumnNames = meetingTableInfo.map(col => col.name);
    if (!meetingColumnNames.includes('activitySubtype')) {
      db.exec(`ALTER TABLE meetings ADD COLUMN activitySubtype TEXT`);
    }
  } catch (e: any) {
    console.warn('Could not add activitySubtype column to meetings:', e.message);
  }

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

  // Seed default reassessment plan templates
  seedDefaultReassessmentTemplates();

  console.log('Database initialized successfully');
}

function seedDefaultReassessmentTemplates() {
  const now = new Date().toISOString();
  
  // Check if templates already exist
  const existingTemplates = db.prepare('SELECT COUNT(*) as count FROM reassessment_plan_templates').get() as { count: number };
  if (existingTemplates.count > 0) {
    return; // Templates already exist, skip seeding
  }

  const templates = [
    {
      id: 'template-standard-3year',
      name: 'Standard 3-Year Reassessment',
      description: 'Comprehensive reassessment plan for 3-year evaluations',
      items: [
        {
          description: 'Review of Prior History and Current Performance: Analysis of the student\'s speech-language progress, tracking retention of skills and recent performance data.',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
          order: 0,
        },
        {
          description: 'Standardized Language Assessment: Use of assessment tools to measure expressive and receptive language skills, focusing on ability to produce complete sentences using correct grammar structures.',
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
          order: 1,
        },
        {
          description: 'Articulation and Intelligibility Evaluation: Assessment of specific phonemes and evaluation of speech clarity and accuracy.',
          dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(), // 21 days from now
          order: 2,
        },
        {
          description: 'Pragmatic (Social) Language Assessment: Evaluation of conversational skills, ability to ask follow-up questions, make comments, and respond to social scenarios.',
          dueDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(), // 28 days from now
          order: 3,
        },
        {
          description: 'Student Observation: Observation of communication during sessions and consultation with site-based staff to see how the student communicates in the school environment.',
          dueDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(), // 35 days from now
          order: 4,
        },
        {
          description: 'Teacher Interview: Meeting or questionnaire for the classroom teacher to discuss how speech clarity and expressive grammar affect academic participation and peer interactions.',
          dueDate: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000).toISOString(), // 42 days from now
          order: 5,
        },
        {
          description: 'Parent Interview: Teleconference with parents to discuss communication at home and determine if improved skills are generalizing outside of the therapy room.',
          dueDate: new Date(Date.now() + 49 * 24 * 60 * 60 * 1000).toISOString(), // 49 days from now
          order: 6,
        },
      ],
    },
    {
      id: 'template-initial-evaluation',
      name: 'Initial Evaluation Plan',
      description: 'Comprehensive plan for initial speech-language evaluations',
      items: [
        {
          description: 'Case History Review: Review of referral information, medical history, and previous assessments.',
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          order: 0,
        },
        {
          description: 'Standardized Language Assessment: Comprehensive evaluation of expressive and receptive language skills.',
          dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          order: 1,
        },
        {
          description: 'Articulation Assessment: Evaluation of speech sound production and intelligibility.',
          dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          order: 2,
        },
        {
          description: 'Language Sample Analysis: Collection and analysis of spontaneous language sample.',
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          order: 3,
        },
        {
          description: 'Pragmatic Language Assessment: Evaluation of social communication skills.',
          dueDate: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000).toISOString(),
          order: 4,
        },
        {
          description: 'Teacher Interview: Discussion with classroom teacher regarding academic and social communication needs.',
          dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
          order: 5,
        },
        {
          description: 'Parent Interview: Comprehensive interview with parents regarding communication at home and concerns.',
          dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
          order: 6,
        },
        {
          description: 'Classroom Observation: Observation of student in natural classroom environment.',
          dueDate: new Date(Date.now() + 24 * 24 * 60 * 60 * 1000).toISOString(),
          order: 7,
        },
      ],
    },
    {
      id: 'template-teletherapy-reassessment',
      name: 'Teletherapy Reassessment Plan',
      description: 'Reassessment plan adapted for virtual/teletherapy platforms',
      items: [
        {
          description: 'Review of Prior History and Current Performance: Analysis of speech-language progress across virtual platforms, tracking how service gaps impacted skill retention.',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          order: 0,
        },
        {
          description: 'Standardized Language Assessment (Virtual Administration): Use of digital assessment tools to measure expressive and receptive language skills via screen-sharing interface.',
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          order: 1,
        },
        {
          description: 'Articulation and Intelligibility Evaluation: Remote assessment of specific phonemes, measuring progress and evaluating how speech clarity translates over digital audio/video.',
          dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
          order: 2,
        },
        {
          description: 'Pragmatic (Social) Language Assessment: Evaluation of conversational skills during teletherapy sessions, assessing ability to ask follow-up questions and respond to hypothetical social scenarios presented on-screen.',
          dueDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
          order: 3,
        },
        {
          description: 'Student Observation: Observation of communication during teletherapy sessions and consultation with site-based staff regarding communication in the school environment.',
          dueDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
          order: 4,
        },
        {
          description: 'Teacher Interview: Virtual meeting or digital questionnaire for classroom teacher to discuss how speech clarity and expressive grammar affect academic participation and peer interactions.',
          dueDate: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000).toISOString(),
          order: 5,
        },
        {
          description: 'Parent Interview: Teleconference with parents to discuss communication at home and determine if improved skills are generalizing outside of the virtual therapy room.',
          dueDate: new Date(Date.now() + 49 * 24 * 60 * 60 * 1000).toISOString(),
          order: 6,
        },
      ],
    },
  ];

  const insertTemplate = db.prepare(`
    INSERT INTO reassessment_plan_templates (id, name, description, items, dateCreated, dateUpdated)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const template of templates) {
    insertTemplate.run(
      template.id,
      template.name,
      template.description,
      JSON.stringify(template.items),
      now,
      now
    );
  }

  console.log(`✅ Seeded ${templates.length} default reassessment plan templates`);
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

