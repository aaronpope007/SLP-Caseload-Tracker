import { Router } from 'express';
import { db } from '../db';
import { scheduleReportsForStudent, updateReportStatuses } from '../utils/progressReportScheduler';
import { asyncHandler } from '../middleware/asyncHandler';

// Database row types
interface ProgressReportRow {
  id: string;
  studentId: string;
  reportType: string;
  dueDate: string;
  scheduledDate: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  completedDate: string | null;
  templateId: string | null;
  content: string | null;
  dateCreated: string;
  dateUpdated: string;
  customDueDate: string | null;
  reminderSent: number;
  reminderSentDate: string | null;
}

export const progressReportsRouter = Router();

// Update statuses before handling requests
progressReportsRouter.use((_req, _res, next) => {
  updateReportStatuses();
  next();
});

// Get all progress reports (filterable by studentId, school, status, date range)
progressReportsRouter.get('/', asyncHandler(async (req, res) => {
  const { studentId, school, status, startDate, endDate } = req.query;
  
  let query = `
    SELECT pr.* FROM progress_reports pr
  `;
  const params: string[] = [];
  const conditions: string[] = [];

  if (studentId) {
    conditions.push('pr.studentId = ?');
    params.push(studentId as string);
  }

  if (school) {
    query += ' INNER JOIN students s ON pr.studentId = s.id';
    conditions.push('s.school = ?');
    params.push(school as string);
  }

  if (status) {
    conditions.push('pr.status = ?');
    params.push(status as string);
  }

  if (startDate) {
    conditions.push('pr.dueDate >= ?');
    params.push(startDate as string);
  }

  if (endDate) {
    conditions.push('pr.dueDate <= ?');
    params.push(endDate as string);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY pr.dueDate ASC';

  const reports = db.prepare(query).all(...params) as ProgressReportRow[];
  
  // Parse reminderSent from integer to boolean
  const parsed = reports.map((r) => ({
    ...r,
    reminderSent: r.reminderSent === 1,
  }));

  res.json(parsed);
}));

// Get upcoming/overdue reports
progressReportsRouter.get('/upcoming', asyncHandler(async (req, res) => {
  const { days = '30', school } = req.query;
  const daysNum = parseInt(days as string, 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + daysNum);
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];

  let query = `
    SELECT pr.* FROM progress_reports pr
    WHERE pr.status != 'completed' AND pr.dueDate <= ? AND pr.dueDate >= ?
  `;
  const params: string[] = [cutoffDateStr, todayStr];

  if (school) {
    query = `
      SELECT pr.* FROM progress_reports pr
      INNER JOIN students s ON pr.studentId = s.id
      WHERE pr.status != 'completed' AND pr.dueDate <= ? AND pr.dueDate >= ? AND s.school = ?
    `;
    params.push(school as string);
  }

  query += ' ORDER BY pr.dueDate ASC';

  const reports = db.prepare(query).all(...params) as ProgressReportRow[];
  
  const parsed = reports.map((r) => ({
    ...r,
    reminderSent: r.reminderSent === 1,
  }));

  res.json(parsed);
}));

// Get progress report by ID
progressReportsRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const report = db.prepare('SELECT * FROM progress_reports WHERE id = ?').get(id) as ProgressReportRow | undefined;
  
  if (!report) {
    return res.status(404).json({ error: 'Progress report not found' });
  }
  
  res.json({
    ...report,
    reminderSent: report.reminderSent === 1,
  });
}));

// Create progress report
progressReportsRouter.post('/', asyncHandler(async (req, res) => {
  const report = req.body;
  
  db.prepare(`
    INSERT INTO progress_reports (
      id, studentId, reportType, dueDate, scheduledDate, periodStart, periodEnd,
      status, completedDate, templateId, content, dateCreated, dateUpdated,
      customDueDate, reminderSent, reminderSentDate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    report.id,
    report.studentId,
    report.reportType,
    report.dueDate,
    report.scheduledDate,
    report.periodStart,
    report.periodEnd,
    report.status,
    report.completedDate || null,
    report.templateId || null,
    report.content || null,
    report.dateCreated,
    report.dateUpdated,
    report.customDueDate || null,
    report.reminderSent ? 1 : 0,
    report.reminderSentDate || null
  );
  
  res.status(201).json({ id: report.id, message: 'Progress report created' });
}));

// Auto-schedule reports for a student or all active students
progressReportsRouter.post('/schedule-auto', asyncHandler(async (req, res) => {
  const { studentId, school } = req.body;
  
  if (studentId) {
    // Schedule for specific student
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId) as any;
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    const reports = scheduleReportsForStudent(studentId, student);
    res.json({ message: `Scheduled ${reports.length} report(s)`, reports });
  } else {
    // Schedule for all active students in school (or all if no school specified)
    let students: any[];
    if (school) {
      students = db.prepare('SELECT * FROM students WHERE status = ? AND school = ? AND (archived IS NULL OR archived = 0)').all('active', school);
    } else {
      students = db.prepare('SELECT * FROM students WHERE status = ? AND (archived IS NULL OR archived = 0)').all('active');
    }

    const allReports: any[] = [];
    for (const student of students) {
      const reports = scheduleReportsForStudent(student.id, student);
      allReports.push(...reports);
    }

    res.json({ message: `Scheduled ${allReports.length} report(s) for ${students.length} student(s)`, reports: allReports });
  }
}));

// Update progress report
progressReportsRouter.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const existing = db.prepare('SELECT * FROM progress_reports WHERE id = ?').get(id) as ProgressReportRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Progress report not found' });
  }
  
  const report = { ...existing, ...updates, dateUpdated: new Date().toISOString() };
  
  // Update status if completed
  if (updates.status === 'completed' && !report.completedDate) {
    report.completedDate = new Date().toISOString();
  }
  
  db.prepare(`
    UPDATE progress_reports 
    SET studentId = ?, reportType = ?, dueDate = ?, scheduledDate = ?, periodStart = ?,
        periodEnd = ?, status = ?, completedDate = ?, templateId = ?, content = ?,
        dateUpdated = ?, customDueDate = ?, reminderSent = ?, reminderSentDate = ?
    WHERE id = ?
  `).run(
    report.studentId,
    report.reportType,
    report.dueDate,
    report.scheduledDate,
    report.periodStart,
    report.periodEnd,
    report.status,
    report.completedDate || null,
    report.templateId || null,
    report.content || null,
    report.dateUpdated,
    report.customDueDate || null,
    report.reminderSent ? 1 : 0,
    report.reminderSentDate || null,
    id
  );
  
  res.json({ message: 'Progress report updated' });
}));

// Mark report as completed
progressReportsRouter.post('/:id/complete', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM progress_reports WHERE id = ?').get(id) as ProgressReportRow | undefined;
  
  if (!existing) {
    return res.status(404).json({ error: 'Progress report not found' });
  }
  
  db.prepare(`
    UPDATE progress_reports 
    SET status = 'completed', completedDate = ?, dateUpdated = ?
    WHERE id = ?
  `).run(new Date().toISOString(), new Date().toISOString(), id);
  
  res.json({ message: 'Progress report marked as completed' });
}));

// Bulk delete progress reports
progressReportsRouter.delete('/bulk', asyncHandler(async (req, res) => {
  const { ids } = req.body;
  
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  }
  
  const placeholders = ids.map(() => '?').join(',');
  const result = db.prepare(`DELETE FROM progress_reports WHERE id IN (${placeholders})`).run(...ids);
  
  res.json({ message: `Deleted ${result.changes} progress report(s)`, deletedCount: result.changes });
}));

// Delete progress report
progressReportsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM progress_reports WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Progress report not found' });
  }
  
  res.json({ message: 'Progress report deleted' });
}));

