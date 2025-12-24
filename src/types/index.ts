export interface School {
  id: string;
  name: string;
  state: string; // US state abbreviation (e.g., 'NC', 'NY', 'CA')
  teletherapy: boolean; // Teletherapy role
  dateCreated: string;
  studentCount?: number; // Optional: number of students in this school (from API)
  schoolHours?: {
    startHour: number; // Start hour (0-23), default 8
    endHour: number; // End hour (0-23), default 17 (5 PM)
  };
}

export interface Teacher {
  id: string;
  name: string;
  grade: string;
  school: string; // School name the teacher belongs to
  phoneNumber?: string;
  emailAddress?: string;
  dateCreated: string;
}

export interface CaseManager {
  id: string;
  name: string;
  role: string; // e.g., 'SPED', 'SLP', 'OT', 'PT', etc.
  school: string; // School name the case manager belongs to
  phoneNumber?: string;
  emailAddress?: string;
  dateCreated: string;
}

export interface Student {
  id: string;
  name: string;
  age: number;
  grade: string;
  concerns: string[];
  exceptionality?: string[]; // Optional for backward compatibility
  status: 'active' | 'discharged';
  dateAdded: string;
  archived?: boolean; // Optional for backward compatibility
  dateArchived?: string;
  school: string; // School name the student belongs to
  teacherId?: string; // Optional teacher ID
  caseManagerId?: string; // Optional case manager ID
  iepDate?: string; // Date of current IEP (ISO string)
  annualReviewDate?: string; // Next annual review date (ISO string)
  progressReportFrequency?: 'quarterly' | 'annual'; // Default report frequency
  frequencyPerWeek?: number; // Number of sessions per week (e.g., 2, 3)
  frequencyType?: 'per-week' | 'per-month'; // Whether frequency is per week or per month
}

export interface Goal {
  id: string;
  studentId: string;
  description: string;
  baseline: string;
  target: string;
  status: 'in-progress' | 'achieved' | 'modified';
  dateCreated: string;
  dateAchieved?: string; // Date when goal was marked as achieved
  // Goal management enhancements
  parentGoalId?: string; // For sub-goals
  subGoalIds?: string[]; // IDs of sub-goals
  domain?: string; // e.g., 'Articulation', 'Language', 'Pragmatics', 'Fluency'
  priority?: 'high' | 'medium' | 'low';
  templateId?: string; // Reference to goal template used
}

export interface GoalTemplate {
  id: string;
  title: string;
  description: string;
  domain: string;
  suggestedBaseline?: string;
  suggestedTarget?: string;
  ageRange?: string;
  keywords?: string[]; // For matching concerns
}

export interface Session {
  id: string;
  studentId: string;
  date: string; // Start time
  endTime?: string; // End time
  goalsTargeted: string[]; // Goal IDs
  activitiesUsed: string[];
  performanceData: {
    goalId: string;
    accuracy?: number;
    correctTrials?: number;
    incorrectTrials?: number;
    notes?: string;
    cuingLevels?: ('independent' | 'verbal' | 'visual' | 'tactile' | 'physical')[];
  }[];
  notes: string;
  isDirectServices?: boolean; // true for Direct Services, false for Indirect Services
  indirectServicesNotes?: string; // Notes for indirect services
  groupSessionId?: string; // ID to link related sessions (for group sessions)
  missedSession?: boolean; // true if this was a missed session (only for Direct Services)
  selectedSubjectiveStatements?: string[]; // Selected subjective statements for SOAP notes
  customSubjective?: string; // Custom subjective statement for SOAP notes
  scheduledSessionId?: string; // ID of the scheduled session template this was created from
}

export interface ScheduledSession {
  id: string;
  studentIds: string[]; // Support for group sessions
  startTime: string; // Time of day in HH:mm format (24-hour)
  endTime?: string; // End time in HH:mm format
  duration?: number; // Duration in minutes (alternative to endTime)
  dayOfWeek?: number[]; // 0-6 (Sunday-Saturday), undefined means specific dates
  specificDates?: string[]; // ISO date strings for specific dates (alternative to dayOfWeek)
  recurrencePattern: 'weekly' | 'daily' | 'specific-dates' | 'none'; // none = one-time
  startDate: string; // ISO string - when to start the recurrence
  endDate?: string; // ISO string - when to end the recurrence (optional)
  goalsTargeted: string[]; // Goal IDs (shared across all instances)
  notes?: string;
  isDirectServices?: boolean;
  dateCreated: string;
  dateUpdated: string;
  active?: boolean; // Whether this scheduled session is active
  cancelledDates?: string[]; // ISO date strings for dates that have been cancelled (YYYY-MM-DD format)
}

export interface Activity {
  id: string;
  description: string;
  goalArea: string;
  ageRange: string;
  materials: string[];
  isFavorite: boolean;
  source: 'AI' | 'manual';
  dateCreated: string;
}

export interface Evaluation {
  id: string;
  studentId: string;
  grade: string;
  evaluationType: string; // e.g., "Initial", "3-year", "Adding Academic"
  areasOfConcern: string; // Comma-separated or single value
  teacher?: string;
  resultsOfScreening?: string;
  dueDate?: string;
  assessments?: string;
  qualify?: string; // e.g., "qualified", "did not qualify"
  reportCompleted?: string; // e.g., "yes", "no"
  iepCompleted?: string; // e.g., "yes", "no", "n/a"
  meetingDate?: string;
  dateCreated: string;
  dateUpdated: string;
}

export interface SOAPNote {
  id: string;
  sessionId: string; // Link to session
  studentId: string;
  date: string; // Date of the session
  templateId?: string; // Which template was used
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  dateCreated: string;
  dateUpdated: string;
}

export interface ProgressReportSection {
  id: string;
  title: string; // e.g., "Student Information", "Goal Progress", "Recommendations"
  order: number; // Display order
  content?: string; // Template content/instructions
  includeGoals?: boolean; // Auto-include goal progress
  includeSessions?: boolean; // Auto-include session data
}

export interface ProgressReportTemplate {
  id: string;
  name: string; // e.g., "Quarterly Progress Report", "Annual IEP Progress"
  reportType: 'quarterly' | 'annual';
  sections: ProgressReportSection[];
  isDefault: boolean; // One default per type
  dateCreated: string;
  dateUpdated: string;
}

export interface ProgressReport {
  id: string;
  studentId: string;
  reportType: 'quarterly' | 'annual';
  dueDate: string; // ISO string - when report is due
  scheduledDate: string; // ISO string - when it was auto-scheduled
  periodStart: string; // Start of reporting period (ISO string)
  periodEnd: string; // End of reporting period (ISO string)
  status: 'scheduled' | 'in-progress' | 'completed' | 'overdue';
  completedDate?: string; // ISO string - when completed
  templateId?: string; // Which template was used
  content?: string; // Report content/generated text
  dateCreated: string;
  dateUpdated: string;
  // Optional fields for customization
  customDueDate?: string; // Override auto-calculated due date
  reminderSent?: boolean; // Track if reminder email was sent
  reminderSentDate?: string; // When reminder was sent
}

export interface DueDateItem {
  id: string;
  title: string;
  description?: string;
  dueDate: string; // ISO string
  studentId?: string; // Optional - link to student
  status: 'pending' | 'completed' | 'overdue';
  completedDate?: string; // ISO string - when completed
  category?: string; // e.g., "IEP", "Evaluation", "Meeting", "Report", "Other"
  priority?: 'high' | 'medium' | 'low';
  dateCreated: string;
  dateUpdated: string;
}

export interface Reminder {
  id: string;
  type: 'goal-review' | 're-evaluation' | 'report-deadline' | 'annual-review' | 'frequency-alert';
  title: string;
  description: string;
  studentId: string;
  studentName: string;
  relatedId?: string; // ID of related goal, evaluation, report, etc.
  dueDate?: string; // ISO string - when the reminder is due
  priority: 'high' | 'medium' | 'low';
  daysUntilDue?: number; // Days until the related item is due (negative if overdue)
  dateCreated: string;
}