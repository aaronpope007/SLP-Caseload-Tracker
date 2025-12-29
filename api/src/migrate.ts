/**
 * Migration script to import data from localStorage export JSON into SQLite database
 * 
 * Usage:
 * 1. Export your localStorage data from the browser console:
 *    localStorage.getItem('slp_students')
 *    localStorage.getItem('slp_goals')
 *    etc.
 * 
 * 2. Or use the exportData() function from storage.ts to get all data as JSON
 * 
 * 3. Save the JSON to a file (e.g., backup.json)
 * 
 * 4. Run: npm run migrate -- backup.json
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { initDatabase, db } from './db';

interface ImportData {
  students?: any[];
  goals?: any[];
  sessions?: any[];
  activities?: any[];
  evaluations?: any[];
  schools?: any[];
  scheduledSessions?: any[];
}

function migrateData(data: ImportData) {
  console.log('🔄 Starting migration...\n');
  
  // Temporarily disable foreign keys for migration
  db.pragma('foreign_keys = OFF');
  
  // Start transaction for atomicity
  const transaction = db.transaction(() => {
    // Clear existing data (optional - comment out if you want to append)
    console.log('⚠️  Clearing existing data...');
    db.prepare('DELETE FROM evaluations').run();
    db.prepare('DELETE FROM sessions').run();
    db.prepare('DELETE FROM activities').run();
    db.prepare('DELETE FROM goals').run();
    db.prepare('DELETE FROM students').run();
    db.prepare('DELETE FROM schools').run();
    db.prepare('DELETE FROM scheduled_sessions').run();
    
    // Import Schools
    if (data.schools && data.schools.length > 0) {
      console.log(`📚 Importing ${data.schools.length} schools...`);
      const insertSchool = db.prepare(`
        INSERT INTO schools (id, name, state, teletherapy, dateCreated)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      for (const school of data.schools) {
        insertSchool.run(
          school.id,
          school.name,
          school.state,
          school.teletherapy ? 1 : 0,
          school.dateCreated
        );
      }
      console.log(`✅ Imported ${data.schools.length} schools`);
    }
    
    // Import Students
    if (data.students && data.students.length > 0) {
      console.log(`👥 Importing ${data.students.length} students...`);
      const insertStudent = db.prepare(`
        INSERT INTO students (id, name, age, grade, concerns, exceptionality, status, dateAdded, archived, dateArchived, school)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const student of data.students) {
        insertStudent.run(
          student.id,
          student.name,
          student.age,
          student.grade,
          JSON.stringify(student.concerns || []),
          student.exceptionality ? JSON.stringify(student.exceptionality) : null,
          student.status,
          student.dateAdded,
          student.archived ? 1 : 0,
          student.dateArchived || null,
          student.school
        );
      }
      console.log(`✅ Imported ${data.students.length} students`);
    }
    
    // Import Goals
    if (data.goals && data.goals.length > 0) {
      console.log(`🎯 Importing ${data.goals.length} goals...`);
      const insertGoal = db.prepare(`
        INSERT INTO goals (id, studentId, description, baseline, target, status, dateCreated, 
                           dateAchieved, parentGoalId, subGoalIds, domain, priority, templateId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const goal of data.goals) {
        insertGoal.run(
          goal.id,
          goal.studentId,
          goal.description,
          goal.baseline,
          goal.target,
          goal.status,
          goal.dateCreated,
          goal.dateAchieved || null,
          goal.parentGoalId || null,
          goal.subGoalIds ? JSON.stringify(goal.subGoalIds) : null,
          goal.domain || null,
          goal.priority || null,
          goal.templateId || null
        );
      }
      console.log(`✅ Imported ${data.goals.length} goals`);
    }
    
    // Import Sessions
    if (data.sessions && data.sessions.length > 0) {
      console.log(`📝 Importing ${data.sessions.length} sessions...`);
      const insertSession = db.prepare(`
        INSERT INTO sessions (id, studentId, date, endTime, goalsTargeted, activitiesUsed, 
                             performanceData, notes, isDirectServices, indirectServicesNotes, 
                             groupSessionId, missedSession)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const session of data.sessions) {
        insertSession.run(
          session.id,
          session.studentId,
          session.date,
          session.endTime || null,
          JSON.stringify(session.goalsTargeted || []),
          JSON.stringify(session.activitiesUsed || []),
          JSON.stringify(session.performanceData || []),
          session.notes,
          session.isDirectServices !== false ? 1 : 0,
          session.indirectServicesNotes || null,
          session.groupSessionId || null,
          session.missedSession ? 1 : 0
        );
      }
      console.log(`✅ Imported ${data.sessions.length} sessions`);
    }
    
    // Import Activities
    if (data.activities && data.activities.length > 0) {
      console.log(`🎨 Importing ${data.activities.length} activities...`);
      const insertActivity = db.prepare(`
        INSERT INTO activities (id, description, goalArea, ageRange, materials, isFavorite, source, dateCreated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const activity of data.activities) {
        insertActivity.run(
          activity.id,
          activity.description,
          activity.goalArea,
          activity.ageRange,
          JSON.stringify(activity.materials || []),
          activity.isFavorite ? 1 : 0,
          activity.source,
          activity.dateCreated
        );
      }
      console.log(`✅ Imported ${data.activities.length} activities`);
    }
    
    // Import Evaluations
    if (data.evaluations && data.evaluations.length > 0) {
      console.log(`📋 Importing ${data.evaluations.length} evaluations...`);
      const insertEvaluation = db.prepare(`
        INSERT INTO evaluations (id, studentId, grade, evaluationType, areasOfConcern, teacher, 
                                resultsOfScreening, dueDate, assessments, qualify, reportCompleted, 
                                iepCompleted, meetingDate, dateCreated, dateUpdated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const evaluation of data.evaluations) {
        insertEvaluation.run(
          evaluation.id,
          evaluation.studentId,
          evaluation.grade,
          evaluation.evaluationType,
          evaluation.areasOfConcern,
          evaluation.teacher || null,
          evaluation.resultsOfScreening || null,
          evaluation.dueDate || null,
          evaluation.assessments || null,
          evaluation.qualify || null,
          evaluation.reportCompleted || null,
          evaluation.iepCompleted || null,
          evaluation.meetingDate || null,
          evaluation.dateCreated,
          evaluation.dateUpdated
        );
      }
      console.log(`✅ Imported ${data.evaluations.length} evaluations`);
    }
    
    // Import Scheduled Sessions
    if (data.scheduledSessions && data.scheduledSessions.length > 0) {
      console.log(`📅 Importing ${data.scheduledSessions.length} scheduled sessions...`);
      const insertScheduledSession = db.prepare(`
        INSERT INTO scheduled_sessions (
          id, studentIds, startTime, endTime, duration, dayOfWeek, specificDates,
          recurrencePattern, startDate, endDate, goalsTargeted, notes,
          isDirectServices, dateCreated, dateUpdated, active, cancelledDates
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const session of data.scheduledSessions) {
        insertScheduledSession.run(
          session.id,
          JSON.stringify(session.studentIds || []),
          session.startTime,
          session.endTime || null,
          session.duration || null,
          session.dayOfWeek ? JSON.stringify(session.dayOfWeek) : null,
          session.specificDates ? JSON.stringify(session.specificDates) : null,
          session.recurrencePattern || 'none',
          session.startDate,
          session.endDate || null,
          JSON.stringify(session.goalsTargeted || []),
          session.notes || null,
          session.isDirectServices !== false ? 1 : 0,
          session.dateCreated || new Date().toISOString(),
          session.dateUpdated || new Date().toISOString(),
          session.active !== false ? 1 : 0,
          session.cancelledDates ? JSON.stringify(session.cancelledDates) : null
        );
      }
      console.log(`✅ Imported ${data.scheduledSessions.length} scheduled sessions`);
    }
    
      });
  
  // Execute transaction
  transaction();
  
  // Re-enable foreign keys
  db.pragma('foreign_keys = ON');
  
  console.log('\n✨ Migration completed successfully!');
  console.log('📊 Database location: ./data/slp-caseload.db');
}

// Main execution
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('❌ Error: Please provide a JSON file path');
  console.log('Usage: npm run migrate -- <path-to-json-file>');
  console.log('\nExample:');
  console.log('  1. Export data from browser console using exportData() from storage.ts');
  console.log('  2. Save to backup.json');
  console.log('  3. Run: npm run migrate -- backup.json');
  process.exit(1);
}

const filePath = args[0];
try {
  // Initialize database
  initDatabase();
  
  // Read and parse JSON file
  console.log(`📖 Reading file: ${filePath}`);
  const fileContent = readFileSync(filePath, 'utf-8');
  const data: ImportData = JSON.parse(fileContent);
  
  // Validate data structure
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid JSON structure');
  }
  
  // Migrate data
  migrateData(data);
  
  // Close database
  db.close();
  console.log('\n✅ All done!');
} catch (error: any) {
  console.error('❌ Migration failed:', error.message);
  db.close();
  process.exit(1);
}

