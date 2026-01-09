/**
 * API-side type definitions
 * 
 * These mirror the frontend types but are kept separate to avoid
 * cross-project imports that break TypeScript compilation.
 */

// ============================================================================
// Scheduled Session Types
// ============================================================================

export interface ScheduledSession {
  id: string;
  studentIds: string[];
  startTime: string;
  endTime?: string;
  duration?: number;
  dayOfWeek?: number[];
  specificDates?: string[];
  recurrencePattern: 'weekly' | 'daily' | 'specific-dates' | 'none';
  startDate: string;
  endDate?: string;
  goalsTargeted: string[];
  notes?: string;
  isDirectServices?: boolean;
  dateCreated: string;
  dateUpdated: string;
  active?: boolean;
  cancelledDates?: string[];
}

// ============================================================================
// Progress Report Types
// ============================================================================

export interface ProgressReport {
  id: string;
  studentId: string;
  reportType: 'quarterly' | 'annual';
  dueDate: string;
  scheduledDate: string;
  periodStart: string;
  periodEnd: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'overdue';
  completedDate?: string;
  templateId?: string;
  content?: string;
  dateCreated: string;
  dateUpdated: string;
  customDueDate?: string;
  reminderSent?: boolean;
  reminderSentDate?: string;
}

// ============================================================================
// Reminder Types
// ============================================================================

export interface Reminder {
  id: string;
  type: 'goal-review' | 're-evaluation' | 'report-deadline' | 'annual-review' | 'frequency-alert' | 'no-goals' | 'no-target';
  title: string;
  description: string;
  studentId: string;
  studentName: string;
  relatedId?: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  daysUntilDue?: number;
  dateCreated: string;
}

