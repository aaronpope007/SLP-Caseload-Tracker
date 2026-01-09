import { db } from '../db';
import type { Reminder } from '../types';

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get goal review reminders for stagnant goals
 * A goal is considered stagnant if it hasn't been targeted in a session for 30+ days
 */
function getGoalReviewReminders(school?: string): Reminder[] {
  const reminders: Reminder[] = [];
  const now = new Date();
  const stagnantThresholdDays = 30; // Goals without progress for 30+ days

  // Get all active, in-progress goals
  let goalsQuery = `
    SELECT g.*, s.name as studentName, s.school
    FROM goals g
    INNER JOIN students s ON g.studentId = s.id
    WHERE g.status = 'in-progress' 
    AND s.status = 'active' 
    AND (s.archived IS NULL OR s.archived = 0)
  `;
  
  const params: any[] = [];
  if (school) {
    goalsQuery += ' AND s.school = ?';
    params.push(school);
  }

  const goals = db.prepare(goalsQuery).all(...params) as any[];

  for (const goal of goals) {
    // Find the most recent session that targeted this goal
    // goalsTargeted is stored as JSON array, so we need to check all sessions and parse JSON
    const allSessions = db.prepare(`
      SELECT date, goalsTargeted FROM sessions 
      WHERE studentId = ?
      ORDER BY date DESC
    `).all(goal.studentId) as any[];

    let lastSessionDate: Date | null = null;
    
    // Find the most recent session that includes this goal
    for (const session of allSessions) {
      try {
        const goalsTargeted = session.goalsTargeted ? JSON.parse(session.goalsTargeted) : [];
        if (Array.isArray(goalsTargeted) && goalsTargeted.includes(goal.id)) {
          lastSessionDate = new Date(session.date);
          break;
        }
      } catch (e) {
        // If JSON parsing fails, skip this session
        continue;
      }
    }
    
    // If no sessions found, use goal creation date
    if (!lastSessionDate) {
      lastSessionDate = new Date(goal.dateCreated);
    }

    const daysSinceLastSession = daysBetween(now, lastSessionDate);
    
    if (daysSinceLastSession >= stagnantThresholdDays) {
      reminders.push({
        id: `goal-review-${goal.id}`,
        type: 'goal-review',
        title: 'Goal Review Needed',
        description: `Goal hasn't been targeted in ${daysSinceLastSession} days: "${goal.description.substring(0, 60)}${goal.description.length > 60 ? '...' : ''}"`,
        studentId: goal.studentId,
        studentName: goal.studentName,
        relatedId: goal.id,
        priority: daysSinceLastSession >= 60 ? 'high' : 'medium',
        daysUntilDue: -daysSinceLastSession, // Negative because it's overdue
        dateCreated: now.toISOString(),
      });
    }
  }

  return reminders;
}

/**
 * Get re-evaluation due date reminders
 * Alert when evaluations are due within 14 days
 */
function getReEvaluationReminders(school?: string): Reminder[] {
  const reminders: Reminder[] = [];
  const now = new Date();
  const alertDays = 14; // Alert 14 days before due date

  let evaluationsQuery = `
    SELECT e.*, s.name as studentName, s.school
    FROM evaluations e
    INNER JOIN students s ON e.studentId = s.id
    WHERE e.dueDate IS NOT NULL 
    AND (e.reportCompleted IS NULL OR e.reportCompleted != 'yes')
    AND s.status = 'active'
    AND (s.archived IS NULL OR s.archived = 0)
  `;
  
  const params: any[] = [];
  if (school) {
    evaluationsQuery += ' AND s.school = ?';
    params.push(school);
  }

  const evaluations = db.prepare(evaluationsQuery).all(...params) as any[];

  for (const evaluation of evaluations) {
    const dueDate = new Date(evaluation.dueDate);
    const daysUntilDue = daysBetween(now, dueDate);
    
    // Alert if due within alertDays or overdue
    if (daysUntilDue <= alertDays) {
      reminders.push({
        id: `re-evaluation-${evaluation.id}`,
        type: 're-evaluation',
        title: 'Re-evaluation Due',
        description: `${evaluation.evaluationType} evaluation is ${daysUntilDue < 0 ? `overdue by ${Math.abs(daysUntilDue)} days` : `due in ${daysUntilDue} days`}`,
        studentId: evaluation.studentId,
        studentName: evaluation.studentName,
        relatedId: evaluation.id,
        dueDate: evaluation.dueDate,
        priority: daysUntilDue < 0 ? 'high' : daysUntilDue <= 7 ? 'high' : 'medium',
        daysUntilDue: daysUntilDue,
        dateCreated: now.toISOString(),
      });
    }
  }

  return reminders;
}

/**
 * Get progress report deadline reminders
 * Alert when reports are due within 7 days
 */
function getReportDeadlineReminders(school?: string): Reminder[] {
  const reminders: Reminder[] = [];
  const now = new Date();
  const alertDays = 7; // Alert 7 days before due date

  let reportsQuery = `
    SELECT pr.*, s.name as studentName, s.school
    FROM progress_reports pr
    INNER JOIN students s ON pr.studentId = s.id
    WHERE pr.status != 'completed'
    AND s.status = 'active'
    AND (s.archived IS NULL OR s.archived = 0)
  `;
  
  const params: any[] = [];
  if (school) {
    reportsQuery += ' AND s.school = ?';
    params.push(school);
  }

  const reports = db.prepare(reportsQuery).all(...params) as any[];

  for (const report of reports) {
    const dueDate = new Date(report.dueDate);
    const daysUntilDue = daysBetween(now, dueDate);
    
    // Alert if due within alertDays or overdue
    if (daysUntilDue <= alertDays) {
      reminders.push({
        id: `report-deadline-${report.id}`,
        type: 'report-deadline',
        title: 'Progress Report Due',
        description: `${report.reportType === 'quarterly' ? 'Quarterly' : 'Annual'} progress report is ${daysUntilDue < 0 ? `overdue by ${Math.abs(daysUntilDue)} days` : `due in ${daysUntilDue} days`}`,
        studentId: report.studentId,
        studentName: report.studentName,
        relatedId: report.id,
        dueDate: report.dueDate,
        priority: daysUntilDue < 0 ? 'high' : 'high',
        daysUntilDue: daysUntilDue,
        dateCreated: now.toISOString(),
      });
    }
  }

  return reminders;
}

/**
 * Get annual review prep reminders
 * Alert when annual reviews are approaching (30 days and 14 days before)
 */
function getAnnualReviewReminders(school?: string): Reminder[] {
  const reminders: Reminder[] = [];
  const now = new Date();
  const alertDays = 30; // Alert 30 days before annual review

  let studentsQuery = `
    SELECT id, name, school, annualReviewDate
    FROM students
    WHERE status = 'active'
    AND (archived IS NULL OR archived = 0)
    AND annualReviewDate IS NOT NULL
  `;
  
  const params: any[] = [];
  if (school) {
    studentsQuery += ' AND school = ?';
    params.push(school);
  }

  const students = db.prepare(studentsQuery).all(...params) as any[];

  for (const student of students) {
    const reviewDate = new Date(student.annualReviewDate);
    const daysUntilReview = daysBetween(now, reviewDate);
    
    // Alert if review is within alertDays
    if (daysUntilReview <= alertDays && daysUntilReview >= 0) {
      reminders.push({
        id: `annual-review-${student.id}-${reviewDate.toISOString()}`,
        type: 'annual-review',
        title: 'Annual Review Approaching',
        description: `Annual IEP review is ${daysUntilReview === 0 ? 'today' : `in ${daysUntilReview} days`}. Prepare meeting materials and review progress.`,
        studentId: student.id,
        studentName: student.name,
        dueDate: student.annualReviewDate,
        priority: daysUntilReview <= 7 ? 'high' : daysUntilReview <= 14 ? 'high' : 'medium',
        daysUntilDue: daysUntilReview,
        dateCreated: now.toISOString(),
      });
    }
  }

  return reminders;
}

/**
 * Get frequency tracking reminders
 * Alert when students are falling behind their expected session frequency
 */
function getFrequencyAlerts(school?: string): Reminder[] {
  const reminders: Reminder[] = [];
  const now = new Date();

  // Get all active students with frequency set
  let studentsQuery = `
    SELECT id, name, school, frequencyPerWeek, frequencyType
    FROM students
    WHERE status = 'active'
    AND (archived IS NULL OR archived = 0)
    AND frequencyPerWeek IS NOT NULL
    AND frequencyType IS NOT NULL
  `;
  
  const params: any[] = [];
  if (school) {
    studentsQuery += ' AND school = ?';
    params.push(school);
  }

  const students = db.prepare(studentsQuery).all(...params) as any[];

  for (const student of students) {
    const frequencyPerWeek = student.frequencyPerWeek as number;
    const frequencyType = student.frequencyType as 'per-week' | 'per-month';
    
    // Determine the tracking period
    let periodStart: Date;
    let expectedSessions: number;
    
    if (frequencyType === 'per-week') {
      // Check last 4 weeks
      periodStart = new Date(now);
      periodStart.setDate(periodStart.getDate() - 28); // 4 weeks ago
      expectedSessions = frequencyPerWeek * 4; // Expected sessions in 4 weeks
    } else {
      // Check last month (30 days)
      periodStart = new Date(now);
      periodStart.setDate(periodStart.getDate() - 30);
      // Convert per-month frequency to expected sessions in 30 days
      // If frequencyPerWeek is set for per-month, it represents sessions per month
      expectedSessions = frequencyPerWeek; // Direct monthly frequency
    }

    // Get actual sessions in the period (only direct services, not missed sessions)
    const sessions = db.prepare(`
      SELECT date, missedSession, isDirectServices
      FROM sessions
      WHERE studentId = ?
      AND date >= ?
      AND date <= ?
      AND (isDirectServices = 1 OR isDirectServices IS NULL)
      AND (missedSession = 0 OR missedSession IS NULL)
      ORDER BY date DESC
    `).all(student.id, periodStart.toISOString(), now.toISOString()) as any[];

    const actualSessions = sessions.length;
    const sessionsBehind = expectedSessions - actualSessions;

    // Alert if student is behind by 1 or more sessions
    if (sessionsBehind >= 1) {
      const periodDays = frequencyType === 'per-week' ? 28 : 30;
      const frequencyDisplay = frequencyType === 'per-week' 
        ? `${frequencyPerWeek} per week` 
        : `${frequencyPerWeek} per month`;
      
      reminders.push({
        id: `frequency-alert-${student.id}-${now.toISOString()}`,
        type: 'frequency-alert',
        title: 'Frequency Behind Schedule',
        description: `Student is ${sessionsBehind} session${sessionsBehind > 1 ? 's' : ''} behind expected frequency (${frequencyDisplay}). Had ${actualSessions} of ${expectedSessions} expected sessions in the last ${periodDays} days.`,
        studentId: student.id,
        studentName: student.name,
        priority: sessionsBehind >= 3 ? 'high' : sessionsBehind >= 2 ? 'medium' : 'low',
        daysUntilDue: -sessionsBehind, // Negative to indicate behind
        dateCreated: now.toISOString(),
      });
    }
  }

  return reminders;
}

/**
 * Get reminders for students with no goals
 * Alert when active students don't have any goals
 */
function getNoGoalsReminders(school?: string): Reminder[] {
  const reminders: Reminder[] = [];
  const now = new Date();

  // Get all active students
  let studentsQuery = `
    SELECT id, name, school, dateAdded
    FROM students
    WHERE status = 'active'
    AND (archived IS NULL OR archived = 0)
  `;
  
  const params: any[] = [];
  if (school) {
    studentsQuery += ' AND school = ?';
    params.push(school);
  }

  const students = db.prepare(studentsQuery).all(...params) as any[];

  // Get all goals for these students
  const allGoals = db.prepare(`
    SELECT studentId FROM goals
  `).all() as any[];

  const studentsWithGoals = new Set(allGoals.map(g => g.studentId));

  // Find students without goals
  for (const student of students) {
    if (!studentsWithGoals.has(student.id)) {
      const daysSinceAdded = daysBetween(now, new Date(student.dateAdded));
      
      reminders.push({
        id: `no-goals-${student.id}`,
        type: 'no-goals',
        title: 'Add Goals for Student',
        description: `Student has no goals. Click to add goals.`,
        studentId: student.id,
        studentName: student.name,
        priority: daysSinceAdded >= 7 ? 'high' : 'medium',
        dateCreated: now.toISOString(),
      });
    }
  }

  return reminders;
}

/**
 * Extract percentage from target string (matches frontend logic)
 */
function extractPercentageFromTarget(target: string | null): string {
  if (!target || !target.trim()) return '';
  
  // Try to find a number followed by optional % sign
  const match = target.match(/(\d+(?:\.\d+)?)\s*%/);
  if (match) {
    return match[1];
  }
  
  // If no % sign, try to parse as a plain number
  const numMatch = target.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) {
    return numMatch[1];
  }
  
  return '';
}

/**
 * Get reminders for goals with no target percentage
 * Alert when active goals don't have a target percentage set
 */
function getNoTargetReminders(school?: string): Reminder[] {
  const reminders: Reminder[] = [];
  const now = new Date();

  // Get all active, in-progress goals
  let goalsQuery = `
    SELECT g.*, s.name as studentName, s.school
    FROM goals g
    INNER JOIN students s ON g.studentId = s.id
    WHERE g.status = 'in-progress' 
    AND s.status = 'active' 
    AND (s.archived IS NULL OR s.archived = 0)
  `;
  
  const params: any[] = [];
  if (school) {
    goalsQuery += ' AND s.school = ?';
    params.push(school);
  }

  const goals = db.prepare(goalsQuery).all(...params) as any[];

  // Find goals without target percentage
  for (const goal of goals) {
    const target = goal.target || '';
    const percentage = extractPercentageFromTarget(target);
    
    if (!percentage) {
      const daysSinceCreated = daysBetween(now, new Date(goal.dateCreated));
      
      reminders.push({
        id: `no-target-${goal.id}`,
        type: 'no-target',
        title: 'Goal Missing Target Percentage',
        description: `Goal needs a target percentage: "${goal.description.substring(0, 60)}${goal.description.length > 60 ? '...' : ''}"`,
        studentId: goal.studentId,
        studentName: goal.studentName,
        relatedId: goal.id,
        priority: daysSinceCreated >= 7 ? 'high' : 'medium',
        dateCreated: now.toISOString(),
      });
    }
  }

  return reminders;
}

/**
 * Get all reminders for a school (or all schools if not specified)
 */
export function getAllReminders(school?: string): Reminder[] {
  const reminders: Reminder[] = [];
  
  reminders.push(...getGoalReviewReminders(school));
  reminders.push(...getReEvaluationReminders(school));
  reminders.push(...getReportDeadlineReminders(school));
  reminders.push(...getAnnualReviewReminders(school));
  reminders.push(...getFrequencyAlerts(school));
  reminders.push(...getNoGoalsReminders(school));
  reminders.push(...getNoTargetReminders(school));
  
  // Sort by priority (high first) and then by days until due
  reminders.sort((a, b) => {
    const priorityOrder: Record<'high' | 'medium' | 'low', number> = { high: 0, medium: 1, low: 2 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then sort by days until due (overdue/sooner first)
    const daysA = a.daysUntilDue ?? Infinity;
    const daysB = b.daysUntilDue ?? Infinity;
    return daysA - daysB;
  });
  
  return reminders;
}

