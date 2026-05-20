/** Primary school contact for CC on cancellation emails - teacher, case manager, or custom */
export interface PrimarySchoolContact {
  contactType: 'teacher' | 'case-manager' | 'custom';
  contactId?: string; // For teacher/case-manager
  name?: string; // For custom
  email?: string; // For custom
}

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
  studentTimes?: {
    startTime: string; // Student start time in HH:mm format (e.g., "08:00"), default "08:00"
    endTime: string; // Student end time in HH:mm format (e.g., "15:00"), default "15:00"
  };
  primarySchoolContact?: PrimarySchoolContact;
}

export interface Teacher {
  id: string;
  name: string;
  grade: string;
  school: string; // School name the teacher belongs to
  phoneNumber?: string;
  emailAddress?: string;
  dateCreated: string;
  gender?: 'male' | 'female' | 'non-binary';
}

export interface CaseManager {
  id: string;
  name: string;
  role: string; // e.g., 'SPED', 'SLP', 'OT', 'PT', etc.
  school: string; // School name the case manager belongs to
  phoneNumber?: string;
  emailAddress?: string;
  dateCreated: string;
  gender?: 'male' | 'female' | 'non-binary';
}

/** One ICD-10 code on a student record (SpedForms-aligned). */
export interface Icd10CodeEntry {
  code: string;
  description: string;
  primary: boolean;
  startDate?: string;
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
  gender?: 'male' | 'female' | 'non-binary';
  /** Date of birth (ISO or YYYY-MM-DD) */
  dob?: string;
  /** Medicaid / member number for exports */
  maNumber?: string;
  /** Time-study / billing mapped goals (JSON from API) */
  tsgoals?: TsGoalEntry[];
  /** Top-level billing / diagnosis domain (not per-goal) */
  domain?: string;
  /** SpedForms-aligned ICD-10 entries (API may still return legacy string[] until migrated). */
  icd10Codes?: Icd10CodeEntry[] | string[];
  /** @deprecated Parallel descriptions for legacy string[] icd10Codes; use description on each entry. */
  icd10Descriptions?: string[];
  cptCodeIndividual?: string;
  cptCodeGroup?: string;
  codesMappedAt?: string;
  codesMappedByAI?: boolean;
}

/** Billing-oriented goal mapping stored on the student record */
export interface TsGoalEntry {
  goalText: string;
  domain?: string;
  icd10Codes: string[];
  icd10Descriptions?: string[];
  cptCodeIndividual?: string;
  cptCodeGroup?: string;
  mappedAt?: string;
  mappedByAI?: boolean;
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
  /** User who created the goal (from settings) */
  createdBy?: string;
  /** When the goal was last modified (ISO string) */
  dateModified?: string;
  /** User who last edited the goal (from settings) */
  modifiedBy?: string;
  // Goal management enhancements
  parentGoalId?: string; // For sub-goals
  subGoalIds?: string[]; // IDs of sub-goals
  /** Clinical domain; use values from `GOAL_DOMAINS` in `src/constants/goalDomains.ts`. */
  domain?: string;
  priority?: 'high' | 'medium' | 'low';
  templateId?: string; // Reference to goal template used
  archived?: boolean; // Optional for backward compatibility
  dateArchived?: string; // Date when goal set was archived (e.g. after reassessment)
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
  /** Explicit goals addressed for billing (goal IDs); if empty, UI/API may fall back to goalsTargeted */
  goalsAddressed?: string[];
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
  plan?: string; // Plan for next session (required for direct services)
  /** True when session is group treatment (2+ students) for billing */
  tsisGroup?: boolean;
  /** Optional stored CPT (e.g. eval); treatment rows often derive 92507/92508 in session log */
  cptCode?: string;
  icd10Codes?: string[];
  /** AI-generated Medicaid-style progress note (batch from Session Log) */
  aiGeneratedNote?: string;
  /** Session has been logged to Medicaid / MA billing (optional on older payloads) */
  maLogged?: boolean;
}

/** One row from GET /api/students/goals-export */
export interface GoalsExportRow {
  firstName: string;
  lastName: string;
  dob?: string;
  maNumber?: string;
  goals: { goalText: string; archived?: boolean }[];
}

/** One performance row from GET /api/sessions/log */
export interface SessionLogPerformanceSummaryEntry {
  goalId: string;
  goalDescription: string;
  accuracy: number;
  correctTrials: number;
  incorrectTrials: number;
  totalTrials: number;
  cuingLevels: string[];
  notes: string;
}

/** One row from GET /api/sessions/log */
export interface SessionLogEntry {
  id: string;
  date: string;
  /** Same as `date` — session start instant (ISO) */
  startTime: string;
  /** When true, session was marked missed (excluded from session log API; optional on cached rows) */
  missedSession?: boolean;
  endTime: string | null;
  studentId: string;
  studentName: string;
  isGroup: boolean;
  /** Present when session is part of a linked multi-student group (from `sessions.groupSessionId`) */
  groupSessionId?: string | null;
  /** True when `goalsAddressed` was saved with at least one goal id (distinct from display-only backfill from performance) */
  hasStoredGoalsAddressed?: boolean;
  groupSize?: number;
  notes?: string;
  /** Goal descriptions from `goalsAddressed` and/or inferred from `performanceData` when addressed is empty */
  goalsAddressedText: string[];
  /** Trial-level results per goal (from `performanceData`) */
  performanceSummary: SessionLogPerformanceSummaryEntry[];
  resolvedCptCode: string;
  icd10Codes: string[];
  icd10Descriptions: string[];
  domain?: string;
  codesMapped: boolean;
  /** Persisted AI progress note from Session Log generator */
  aiGeneratedNote?: string;
  /** Logged to MA (Medicaid) billing */
  maLogged: boolean;
}

/** One session row nested under GET /api/sessions/ma-billing-log student */
export interface MaBillingLogSessionEntry {
  sessionId: string;
  serviceDate: string;
  maLoggedAt: string | null;
}

/** One student row from GET /api/sessions/ma-billing-log */
export interface MaBillingLogStudent {
  studentId: string;
  studentName: string;
  grade: string;
  initials: string;
  sessionCount: number;
  dates: string[];
  sessions: MaBillingLogSessionEntry[];
}

export type MaBillingLogFilterBy = 'serviceDate' | 'loggedDate';

/** One student row from GET /api/sessions/ma-billing-log evalStudents */
export interface MaBillingLogEvalStudent {
  studentId: string;
  studentName: string;
  grade: string;
  initials: string;
  evalCount: number;
  dates: string[];
  titles: string[];
}

/** One student row from GET /api/sessions/ma-billing-log docStudents */
export interface MaBillingLogDocStudent {
  studentId: string;
  studentName: string;
  grade: string;
  initials: string;
  docCount: number;
  dates: string[];
  categories: string[];
}

export interface MaBillingLogResponse {
  students: MaBillingLogStudent[];
  evalStudents: MaBillingLogEvalStudent[];
  docStudents: MaBillingLogDocStudent[];
  totalSessions: number;
  totalEvals: number;
  totalDocs: number;
  dateRange: { startDate: string; endDate: string };
  filterBy: MaBillingLogFilterBy;
}

/** One row from GET /api/meetings/documentation-log */
export interface DocLogEntry {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  title: string;
  category: string;
  studentId: string;
  studentName: string;
  maLogged: boolean;
  maLoggedAt: string | null;
}

/** One row from GET /api/meetings/eval-log (meeting category exposed as `type`) */
export interface EvalLogEntry {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  title: string;
  type: string;
  studentId: string;
  studentName: string;
  cptCode: string;
  billable: boolean;
  needsReview: boolean;
  maLogged: boolean;
  maLoggedAt: string | null;
  maNote: string | null;
}

/** One mapping from POST /api/students/:id/map-goals */
export interface GoalMapAiMapping {
  goalId: string;
  goalText: string;
  domain: 'articulation' | 'language' | 'pragmatics' | 'unknown';
  cptCodeIndividual: string;
  cptCodeGroup: string;
  rationale: string;
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

export interface ReassessmentPlanItem {
  id: string;
  planId: string;
  description: string;
  dueDate: string; // ISO string
  completed: boolean;
  completedDate?: string; // ISO string - when completed
  order: number; // Display order within the plan
  dateCreated: string;
  dateUpdated: string;
}

export interface ReassessmentPlan {
  id: string;
  studentId: string;
  evaluationId?: string; // Optional link to an evaluation
  title: string;
  description?: string;
  dueDate: string; // ISO string - overall plan due date
  status: 'pending' | 'in-progress' | 'completed';
  templateId?: string; // Reference to template used (if created from template)
  dateCreated: string;
  dateUpdated: string;
}

export interface ReassessmentPlanTemplate {
  id: string;
  name: string; // e.g., "Standard 3-Year Reassessment", "Initial Evaluation Plan"
  description?: string;
  items: Omit<ReassessmentPlanItem, 'id' | 'planId' | 'completed' | 'completedDate' | 'dateCreated' | 'dateUpdated'>[]; // Template items without IDs
  dateCreated: string;
  dateUpdated: string;
}

export interface DisorderedPhoneme {
  phoneme: string; // IPA symbol (e.g., 'p', 'θ', 'ʃ')
  note?: string; // Optional note about the disordered phoneme
}

export interface ArticulationScreener {
  id: string;
  studentId: string;
  date: string; // Date the screening was performed
  disorderedPhonemes: DisorderedPhoneme[]; // Array of disordered phonemes with optional notes
  report?: string; // Generated screening report
  /** Free-text notes about productions (e.g., "fox -> fawsss") for AI analysis */
  additionalNotes?: string;
  evaluationId?: string; // Optional link to an evaluation
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

export interface IEPNote {
  id: string;
  studentId: string;
  previousNote: string; // The current/old IEP Communication note pasted in
  generatedNote: string; // The AI-generated updated note
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
  content?: string; // JSON stringified section contents (for editor)
  finalReportText?: string; // Final formatted report text (for viewing/editing)
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
  type: 'goal-review' | 're-evaluation' | 'report-deadline' | 'annual-review' | 'frequency-alert' | 'no-goals' | 'no-target';
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

export interface Communication {
  id: string;
  studentId?: string; // Optional - communication may be about a student
  contactType: 'teacher' | 'parent' | 'case-manager';
  contactId?: string; // ID of teacher, case manager, or parent (if stored)
  contactName: string; // Name of the person communicated with
  contactEmail?: string; // Email address
  subject: string;
  body: string;
  method: 'email' | 'phone' | 'text' | 'in-person' | 'other';
  date: string; // ISO string - when communication occurred
  sessionId?: string; // Optional - link to session if related to missed session
  relatedTo?: string; // Optional - description of what this is related to (e.g., "Missed Session")
  dateCreated: string;
}

export interface TimesheetNote {
  id: string;
  content: string;
  dateCreated: string;
  dateFor?: string; // Optional date the note is for (YYYY-MM-DD format)
  school: string;
}

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  dateCreated: string;
  dateUpdated: string;
  completedDate?: string; // ISO string - when completed
}

/** For IEP and Assessment: whether this is a meeting, updates/documentation, or assessment */
export type MeetingActivitySubtype = 'meeting' | 'updates' | 'assessment';

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  date: string; // ISO string - meeting date/time (start)
  endTime?: string; // ISO string - meeting end time
  school: string; // School name the meeting is for
  /** Optional - one or more students (e.g. for caseload planning). Prefer this over studentId. */
  studentIds?: string[];
  /** @deprecated Use studentIds. Optional - single student (legacy). */
  studentId?: string;
  category?: string; // e.g., "IEP", "Staff Meeting", "Team Meeting", "Other"
  /** For IEP and Assessment: "meeting", "updates", or "assessment" - drives timesheet line (e.g. "IEP activity, meeting:" vs "IEP activity, updates:" vs "IEP activity, assessment:") */
  activitySubtype?: MeetingActivitySubtype;
  dateCreated: string;
  dateUpdated: string;
}

export interface CombinedProgressNote {
  id: string;
  studentId: string;
  content: string; // The generated combined progress note text
  selectedGoalIds?: string; // JSON stringified array of goal IDs that were included
  dateCreated: string;
  dateUpdated: string;
}