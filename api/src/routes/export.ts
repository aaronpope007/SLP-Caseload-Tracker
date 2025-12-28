import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { parseJsonField } from '../utils/jsonHelpers';

export const exportRouter = Router();

// Export all data as JSON
exportRouter.get('/all', asyncHandler(async (req, res) => {
  // Get all data
  const schools = db.prepare('SELECT * FROM schools').all() as any[];
  const students = db.prepare('SELECT * FROM students').all() as any[];
  const teachers = db.prepare('SELECT * FROM teachers').all();
  const goals = db.prepare('SELECT * FROM goals').all() as any[];
  const sessions = db.prepare('SELECT * FROM sessions').all() as any[];
  const activities = db.prepare('SELECT * FROM activities').all() as any[];
  const evaluations = db.prepare('SELECT * FROM evaluations').all();
  const lunches = db.prepare('SELECT * FROM lunches').all();
  
  // Parse JSON fields
  const parsedData = {
    schools: schools.map((s) => ({
      ...s,
      teletherapy: s.teletherapy === 1,
    })),
    students: students.map((s) => ({
      ...s,
      concerns: parseJsonField<string[]>(s.concerns, []),
      exceptionality: parseJsonField<string[]>(s.exceptionality, undefined),
      archived: s.archived === 1,
    })),
    teachers,
    goals: goals.map((g) => ({
      ...g,
      subGoalIds: parseJsonField<string[]>(g.subGoalIds, undefined),
    })),
    sessions: sessions.map((s) => ({
      ...s,
      goalsTargeted: parseJsonField<string[]>(s.goalsTargeted, []),
      activitiesUsed: parseJsonField<string[]>(s.activitiesUsed, []),
      performanceData: parseJsonField<any[]>(s.performanceData, []),
      isDirectServices: s.isDirectServices === 1,
      missedSession: s.missedSession === 1,
    })),
    activities: activities.map((a) => ({
      ...a,
      materials: parseJsonField<string[]>(a.materials, []),
      isFavorite: a.isFavorite === 1,
    })),
    evaluations,
    lunches,
    exportDate: new Date().toISOString(),
  };
  
  res.json(parsedData);
}));

// Backup database file endpoint (returns file path info)
exportRouter.get('/backup-info', asyncHandler(async (req, res) => {
  res.json({
    message: 'Database file location',
    path: './data/slp-caseload.db',
    note: 'You can copy this file to create a backup',
  });
}));

