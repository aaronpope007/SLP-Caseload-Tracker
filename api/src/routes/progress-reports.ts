import { Router } from 'express';
import { db } from '../db';
import { scheduleReportsForStudent, updateReportStatuses } from '../utils/progressReportScheduler';

export const progressReportsRouter = Router();

// Update statuses before handling requests
progressReportsRouter.use((_req, _res, next) => {
  updateReportStatuses();
  next();
});

// Get all progress reports (filterable by studentId, school, status, date range)
progressReportsRouter.get('/', (req, res) => {
  try {
    const { studentId, school, status, startDate, endDate } = req.query;
    
    let query = `
      SELECT pr.* FROM progress_reports pr
    `;
    const params: any[] = [];
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

    const reports = db.prepare(query).all(...params);
    
    // Parse reminderSent from integer to boolean
    const parsed = reports.map((r: any) => ({
      ...r,
      reminderSent: r.reminderSent === 1,
    }));

    res.json(parsed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get upcoming/overdue reports
progressReportsRouter.get('/upcoming', (req, res) => {
  try {
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
    const params: any[] = [cutoffDateStr, todayStr];

    if (school) {
      query = `
        SELECT pr.* FROM progress_reports pr
        INNER JOIN students s ON pr.studentId = s.id
        WHERE pr.status != 'completed' AND pr.dueDate <= ? AND pr.dueDate >= ? AND s.school = ?
      `;
      params.push(school as string);
    }

    query += ' ORDER BY pr.dueDate ASC';

    const reports = db.prepare(query).all(...params);
    
    const parsed = reports.map((r: any) => ({
      ...r,
      reminderSent: r.reminderSent === 1,
    }));

    res.json(parsed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get progress report by ID
progressReportsRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const report = db.prepare('SELECT * FROM progress_reports WHERE id = ?').get(id) as any;
    
    if (!report) {
      return res.status(404).json({ error: 'Progress report not found' });
    }
    
    res.json({
      ...report,
      reminderSent: report.reminderSent === 1,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create progress report
progressReportsRouter.post('/', (req, res) => {
  try {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Auto-schedule reports for a student or all active students
progressReportsRouter.post('/schedule-auto', (req, res) => {
  try {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update progress report
progressReportsRouter.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = db.prepare('SELECT * FROM progress_reports WHERE id = ?').get(id) as any;
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark report as completed
progressReportsRouter.post('/:id/complete', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM progress_reports WHERE id = ?').get(id) as any;
    
    if (!existing) {
      return res.status(404).json({ error: 'Progress report not found' });
    }
    
    db.prepare(`
      UPDATE progress_reports 
      SET status = 'completed', completedDate = ?, dateUpdated = ?
      WHERE id = ?
    `).run(new Date().toISOString(), new Date().toISOString(), id);
    
    res.json({ message: 'Progress report marked as completed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete progress report
progressReportsRouter.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM progress_reports WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Progress report not found' });
    }
    
    res.json({ message: 'Progress report deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

