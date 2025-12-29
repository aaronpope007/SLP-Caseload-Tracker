/**
 * Script to import ONLY scheduled sessions into the database
 * This will NOT delete existing data, only add scheduled sessions
 * 
 * Usage: npm run import-scheduled-sessions -- scheduled-sessions.json
 */

import { readFileSync } from 'fs';
import { initDatabase, db } from './src/db';

interface ScheduledSessionsData {
  scheduledSessions?: any[];
}

function importScheduledSessions(data: ScheduledSessionsData) {
  console.log('🔄 Starting scheduled sessions import...\n');

  if (!data.scheduledSessions || !Array.isArray(data.scheduledSessions)) {
    console.error('❌ Error: No scheduledSessions array found in the data');
    console.log('Expected format: { "scheduledSessions": [...] }');
    process.exit(1);
  }

  if (data.scheduledSessions.length === 0) {
    console.log('⚠️  No scheduled sessions to import');
    return;
  }

  // Start transaction
  const transaction = db.transaction(() => {
    const insertScheduledSession = db.prepare(`
      INSERT INTO scheduled_sessions (
        id, studentIds, startTime, endTime, duration, dayOfWeek, specificDates,
        recurrencePattern, startDate, endDate, goalsTargeted, notes,
        isDirectServices, dateCreated, dateUpdated, active, cancelledDates
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let imported = 0;
    let skipped = 0;

    for (const session of data.scheduledSessions) {
      try {
        // Check if session already exists
        const existing = db.prepare('SELECT id FROM scheduled_sessions WHERE id = ?').get(session.id);
        if (existing) {
          console.log(`⏭️  Skipping ${session.id} (already exists)`);
          skipped++;
          continue;
        }

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
        imported++;
      } catch (error: any) {
        console.error(`❌ Error importing session ${session.id}:`, error.message);
      }
    }

    console.log(`\n✅ Imported ${imported} scheduled sessions`);
    if (skipped > 0) {
      console.log(`⏭️  Skipped ${skipped} existing sessions`);
    }
  });

  // Execute transaction
  transaction();

  console.log('\n✨ Import completed successfully!');
}

// Main execution
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('❌ Error: Please provide a JSON file path');
  console.log('Usage: npm run import-scheduled-sessions -- <path-to-json-file>');
  console.log('\nExample:');
  console.log('  1. Extract scheduled sessions using extract-scheduled-sessions.js');
  console.log('  2. Create a file with format: { "scheduledSessions": [...] }');
  console.log('  3. Run: npm run import-scheduled-sessions -- scheduled-sessions.json');
  process.exit(1);
}

const filePath = args[0];
try {
  // Initialize database
  initDatabase();

  // Read and parse JSON file
  console.log(`📖 Reading file: ${filePath}`);
  let fileContent = readFileSync(filePath, 'utf-8');
  // Remove BOM (Byte Order Mark) if present
  if (fileContent.charCodeAt(0) === 0xFEFF) {
    fileContent = fileContent.slice(1);
  }
  const data: ScheduledSessionsData = JSON.parse(fileContent);

  // Validate data structure
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid JSON structure');
  }

  // Import scheduled sessions
  importScheduledSessions(data);

  // Close database
  db.close();
  console.log('\n✅ All done!');
} catch (error: any) {
  console.error('❌ Import failed:', error.message);
  db.close();
  process.exit(1);
}

