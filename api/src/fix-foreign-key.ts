/**
 * Migration script to remove foreign key constraint from students table
 * Run this once to fix the foreign key issue
 */

import { db, initDatabase } from './db';

function fixForeignKey() {
  console.log('🔧 Fixing foreign key constraint...\n');
  
  try {
    // Get all students data
    const students = db.prepare('SELECT * FROM students').all();
    console.log(`📊 Found ${students.length} students to migrate`);
    
    // Drop the old table
    db.exec('DROP TABLE IF EXISTS students');
    console.log('✅ Dropped old students table');
    
    // Recreate without foreign key constraint
    db.exec(`
      CREATE TABLE students (
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
    console.log('✅ Created new students table without foreign key');
    
    // Re-insert all students
    const insert = db.prepare(`
      INSERT INTO students (id, name, age, grade, concerns, exceptionality, status, dateAdded, archived, dateArchived, school)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const transaction = db.transaction(() => {
      for (const student of students as any[]) {
        insert.run(
          student.id,
          student.name,
          student.age,
          student.grade,
          student.concerns, // Already JSON string
          student.exceptionality,
          student.status,
          student.dateAdded,
          student.archived,
          student.dateArchived,
          student.school
        );
      }
    });
    
    transaction();
    console.log(`✅ Re-inserted ${students.length} students`);
    
    // Recreate indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_students_school ON students(school)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_students_status ON students(status)');
    console.log('✅ Recreated indexes');
    
    console.log('\n✨ Foreign key constraint removed successfully!');
    console.log('📊 All students preserved');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Initialize database first
initDatabase();

// Run the fix
fixForeignKey();

