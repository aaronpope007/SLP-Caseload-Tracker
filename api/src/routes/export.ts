import { Router } from 'express';
import { db } from '../db';

export const exportRouter = Router();

// Export all data as JSON
exportRouter.get('/all', (req, res) => {
  try {
    // Get all data
    const schools = db.prepare('SELECT * FROM schools').all();
    const students = db.prepare('SELECT * FROM students').all();
    const goals = db.prepare('SELECT * FROM goals').all();
    const sessions = db.prepare('SELECT * FROM sessions').all();
    const activities = db.prepare('SELECT * FROM activities').all();
    const evaluations = db.prepare('SELECT * FROM evaluations').all();
    const lunches = db.prepare('SELECT * FROM lunches').all();
    
    // Parse JSON fields
    const parsedData = {
      schools: schools.map((s: any) => ({
        ...s,
        teletherapy: s.teletherapy === 1,
      })),
      students: students.map((s: any) => ({
        ...s,
        concerns: s.concerns ? JSON.parse(s.concerns) : [],
        exceptionality: s.exceptionality ? JSON.parse(s.exceptionality) : undefined,
        archived: s.archived === 1,
      })),
      goals: goals.map((g: any) => ({
        ...g,
        subGoalIds: g.subGoalIds ? JSON.parse(g.subGoalIds) : undefined,
      })),
      sessions: sessions.map((s: any) => ({
        ...s,
        goalsTargeted: s.goalsTargeted ? JSON.parse(s.goalsTargeted) : [],
        activitiesUsed: s.activitiesUsed ? JSON.parse(s.activitiesUsed) : [],
        performanceData: s.performanceData ? JSON.parse(s.performanceData) : [],
        isDirectServices: s.isDirectServices === 1,
        missedSession: s.missedSession === 1,
      })),
      activities: activities.map((a: any) => ({
        ...a,
        materials: a.materials ? JSON.parse(a.materials) : [],
        isFavorite: a.isFavorite === 1,
      })),
      evaluations,
      lunches,
      exportDate: new Date().toISOString(),
    };
    
    res.json(parsedData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Backup database file endpoint (returns file path info)
exportRouter.get('/backup-info', (req, res) => {
  try {
    const dbPath = db.prepare('PRAGMA database_list').get() as any;
    res.json({
      message: 'Database file location',
      path: './data/slp-caseload.db',
      note: 'You can copy this file to create a backup',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

