import { db } from '../db';
import type { ProgressReport } from '../types';

interface Quarter {
  start: Date;
  end: Date;
  quarter: number;
}

/**
 * Get school year quarters based on IEP date or default to September 1 start
 */
function getSchoolYearQuarters(iepDate?: string, currentDate: Date = new Date()): Quarter[] {
  const baseDate = iepDate ? new Date(iepDate) : new Date(currentDate.getFullYear(), 8, 1); // September 1
  const year = baseDate.getMonth() >= 8 ? baseDate.getFullYear() : baseDate.getFullYear() - 1; // School year starts in September
  
  return [
    { start: new Date(year, 8, 1), end: new Date(year, 10, 30), quarter: 1 }, // Sept-Nov
    { start: new Date(year, 11, 1), end: new Date(year + 1, 1, 28), quarter: 2 }, // Dec-Feb
    { start: new Date(year + 1, 2, 1), end: new Date(year + 1, 4, 31), quarter: 3 }, // Mar-May
    { start: new Date(year + 1, 5, 1), end: new Date(year + 1, 7, 31), quarter: 4 }, // Jun-Aug
  ];
}

/**
 * Check if a progress report already exists for a given period
 */
function reportExistsForPeriod(
  studentId: string,
  periodStart: string,
  periodEnd: string,
  reportType: 'quarterly' | 'annual'
): boolean {
  const existing = db.prepare(`
    SELECT * FROM progress_reports 
    WHERE studentId = ? AND periodStart = ? AND periodEnd = ? AND reportType = ?
  `).get(studentId, periodStart, periodEnd, reportType);
  
  return !!existing;
}

/**
 * Schedule quarterly progress reports for a student
 */
export function scheduleQuarterlyReports(
  studentId: string,
  iepDate?: string,
  annualReviewDate?: string
): ProgressReport[] {
  const quarters = getSchoolYearQuarters(iepDate);
  const now = new Date();
  const annualReview = annualReviewDate ? new Date(annualReviewDate) : null;
  const scheduledReports: ProgressReport[] = [];

  for (const quarter of quarters) {
    // Skip quarters that have already ended more than 3 months ago
    const quarterEndDate = new Date(quarter.end);
    quarterEndDate.setMonth(quarterEndDate.getMonth() + 3);
    if (quarterEndDate < now) {
      continue;
    }

    // Calculate due date: 2 weeks after quarter end, or 3 weeks before annual review if sooner
    let dueDate = new Date(quarter.end);
    dueDate.setDate(dueDate.getDate() + 14); // 2 weeks after quarter end

    if (annualReview && dueDate > annualReview) {
      dueDate = new Date(annualReview);
      dueDate.setDate(dueDate.getDate() - 21); // 3 weeks before annual review
    }

    const periodStartStr = quarter.start.toISOString().split('T')[0];
    const periodEndStr = quarter.end.toISOString().split('T')[0];
    const dueDateStr = dueDate.toISOString().split('T')[0];

    // Check if report already exists
    if (reportExistsForPeriod(studentId, periodStartStr, periodEndStr, 'quarterly')) {
      continue;
    }

    const report: ProgressReport = {
      id: `progress-report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      studentId,
      reportType: 'quarterly',
      dueDate: dueDateStr,
      scheduledDate: now.toISOString(),
      periodStart: periodStartStr,
      periodEnd: periodEndStr,
      status: dueDate < now ? 'overdue' : 'scheduled',
      dateCreated: now.toISOString(),
      dateUpdated: now.toISOString(),
    };

    // Insert into database
    db.prepare(`
      INSERT INTO progress_reports (
        id, studentId, reportType, dueDate, scheduledDate, periodStart, periodEnd,
        status, dateCreated, dateUpdated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      report.id,
      report.studentId,
      report.reportType,
      report.dueDate,
      report.scheduledDate,
      report.periodStart,
      report.periodEnd,
      report.status,
      report.dateCreated,
      report.dateUpdated
    );

    scheduledReports.push(report);
  }

  return scheduledReports;
}

/**
 * Schedule annual progress report for a student
 */
export function scheduleAnnualReport(
  studentId: string,
  annualReviewDate?: string,
  iepDate?: string
): ProgressReport | null {
  let annualReview: Date;
  
  if (annualReviewDate) {
    annualReview = new Date(annualReviewDate);
  } else if (iepDate) {
    annualReview = new Date(iepDate);
    annualReview.setFullYear(annualReview.getFullYear() + 1);
  } else {
    return null; // Cannot schedule without dates
  }

  // Calculate period: one year before annual review
  const periodStart = new Date(annualReview);
  periodStart.setFullYear(periodStart.getFullYear() - 1);
  
  // Due date: 3 weeks before annual review
  const dueDate = new Date(annualReview);
  dueDate.setDate(dueDate.getDate() - 21);

  const periodStartStr = periodStart.toISOString().split('T')[0];
  const periodEndStr = annualReview.toISOString().split('T')[0];
  const dueDateStr = dueDate.toISOString().split('T')[0];

  // Check if report already exists
  if (reportExistsForPeriod(studentId, periodStartStr, periodEndStr, 'annual')) {
    return null;
  }

  const now = new Date();
  const report: ProgressReport = {
    id: `progress-report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    studentId,
    reportType: 'annual',
    dueDate: dueDateStr,
    scheduledDate: now.toISOString(),
    periodStart: periodStartStr,
    periodEnd: periodEndStr,
    status: dueDate < now ? 'overdue' : 'scheduled',
    dateCreated: now.toISOString(),
    dateUpdated: now.toISOString(),
  };

  // Insert into database
  db.prepare(`
    INSERT INTO progress_reports (
      id, studentId, reportType, dueDate, scheduledDate, periodStart, periodEnd,
      status, dateCreated, dateUpdated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    report.id,
    report.studentId,
    report.reportType,
    report.dueDate,
    report.scheduledDate,
    report.periodStart,
    report.periodEnd,
    report.status,
    report.dateCreated,
    report.dateUpdated
  );

  return report;
}

/**
 * Auto-schedule reports for a student based on their settings
 */
export function scheduleReportsForStudent(studentId: string, student: any): ProgressReport[] {
  const reports: ProgressReport[] = [];
  const frequency = student.progressReportFrequency || 'annual';

  if (frequency === 'quarterly') {
    const quarterlyReports = scheduleQuarterlyReports(
      studentId,
      student.iepDate,
      student.annualReviewDate
    );
    reports.push(...quarterlyReports);
  } else {
    const annualReport = scheduleAnnualReport(
      studentId,
      student.annualReviewDate,
      student.iepDate
    );
    if (annualReport) {
      reports.push(annualReport);
    }
  }

  return reports;
}

/**
 * Update report statuses based on due dates
 */
export function updateReportStatuses(): void {
  const now = new Date().toISOString().split('T')[0];
  
  // Update scheduled reports that are now overdue
  db.prepare(`
    UPDATE progress_reports 
    SET status = 'overdue', dateUpdated = ?
    WHERE status = 'scheduled' AND dueDate < ?
  `).run(new Date().toISOString(), now);
}

