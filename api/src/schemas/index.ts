/**
 * Zod validation schemas for API request validation
 * Ensures type safety and data integrity at the API boundary
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

/** Non-empty trimmed string */
const nonEmptyString = z.string().min(1, 'This field is required').transform(s => s.trim());

/** Optional trimmed string (empty becomes undefined) */
const optionalString = z.string().optional().transform(s => s?.trim() || undefined);

/** ISO date string */
const isoDateString = z.string().datetime({ offset: true }).or(
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date (YYYY-MM-DD)')
);

/** Optional ISO date string */
const optionalIsoDate = isoDateString.optional().or(z.literal('').transform(() => undefined));

/** ID string (UUID or custom format) */
const idString = z.string().min(1, 'ID is required');

// ============================================================================
// School Schema
// ============================================================================

export const schoolSchema = z.object({
  id: idString.optional(),
  name: nonEmptyString.pipe(z.string().max(200, 'Name must be 200 characters or less')),
  state: z.string().max(2, 'State must be 2 characters or less').default(''),
  teletherapy: z.boolean().default(false),
  schoolHours: z.object({
    startHour: z.number().int().min(0).max(23).default(8),
    endHour: z.number().int().min(0).max(23).default(17),
  }).optional(),
});

export const createSchoolSchema = schoolSchema.omit({ id: true });
export const updateSchoolSchema = schoolSchema.partial();

// ============================================================================
// Teacher Schema
// ============================================================================

export const teacherSchema = z.object({
  id: idString.optional(),
  name: nonEmptyString.pipe(z.string().max(200, 'Name must be 200 characters or less')),
  grade: z.string().max(50, 'Grade must be 50 characters or less').default(''),
  school: nonEmptyString,
  phoneNumber: optionalString,
  emailAddress: z.string().email('Invalid email address').optional().or(z.literal('')),
});

export const createTeacherSchema = teacherSchema.omit({ id: true });
export const updateTeacherSchema = teacherSchema.partial();

// ============================================================================
// Case Manager Schema
// ============================================================================

export const caseManagerSchema = z.object({
  id: idString.optional(),
  name: nonEmptyString.pipe(z.string().max(200, 'Name must be 200 characters or less')),
  role: z.string().max(50, 'Role must be 50 characters or less').default(''),
  school: nonEmptyString,
  phoneNumber: optionalString,
  emailAddress: z.string().email('Invalid email address').optional().or(z.literal('')),
});

export const createCaseManagerSchema = caseManagerSchema.omit({ id: true });
export const updateCaseManagerSchema = caseManagerSchema.partial();

// ============================================================================
// Student Schema
// ============================================================================

export const studentStatusSchema = z.enum(['active', 'discharged']);
export const progressReportFrequencySchema = z.enum(['quarterly', 'annual']);
export const frequencyTypeSchema = z.enum(['per-week', 'per-month']);

export const studentSchema = z.object({
  id: idString.optional(),
  name: nonEmptyString.pipe(z.string().max(200, 'Name must be 200 characters or less')),
  age: z.number().int().min(0, 'Age must be 0 or greater').max(25, 'Age must be 25 or less'),
  grade: z.string().max(20, 'Grade must be 20 characters or less').default(''),
  concerns: z.array(z.string()).default([]),
  exceptionality: z.array(z.string()).optional(),
  status: studentStatusSchema.default('active'),
  archived: z.boolean().default(false),
  dateArchived: optionalIsoDate,
  school: nonEmptyString,
  teacherId: optionalString,
  caseManagerId: optionalString,
  iepDate: optionalIsoDate,
  annualReviewDate: optionalIsoDate,
  progressReportFrequency: progressReportFrequencySchema.optional(),
  frequencyPerWeek: z.number().int().min(1).max(10).optional().nullable(),
  frequencyType: frequencyTypeSchema.optional(),
});

export const createStudentSchema = studentSchema.omit({ id: true });
export const updateStudentSchema = studentSchema.partial();

// ============================================================================
// Goal Schema
// ============================================================================

export const goalStatusSchema = z.enum(['in-progress', 'achieved', 'modified']);
export const prioritySchema = z.enum(['high', 'medium', 'low']);

export const goalSchema = z.object({
  id: idString.optional(),
  studentId: idString,
  description: nonEmptyString.pipe(z.string().max(2000, 'Description must be 2000 characters or less')),
  baseline: z.string().max(500, 'Baseline must be 500 characters or less').default(''),
  target: z.string().max(500, 'Target must be 500 characters or less').default(''),
  status: goalStatusSchema.default('in-progress'),
  dateAchieved: optionalIsoDate,
  parentGoalId: optionalString,
  subGoalIds: z.array(z.string()).optional(),
  domain: optionalString,
  priority: prioritySchema.optional(),
  templateId: optionalString,
});

export const createGoalSchema = goalSchema.omit({ id: true });
export const updateGoalSchema = goalSchema.partial();

// ============================================================================
// Session Schema
// ============================================================================

export const cuingLevelSchema = z.enum(['independent', 'verbal', 'visual', 'tactile', 'physical']);

export const performanceDataSchema = z.object({
  goalId: idString,
  accuracy: z.number().min(0).max(100).optional(),
  correctTrials: z.number().int().min(0).optional(),
  incorrectTrials: z.number().int().min(0).optional(),
  notes: optionalString,
  cuingLevels: z.array(cuingLevelSchema).optional(),
});

export const sessionSchema = z.object({
  id: idString.optional(),
  studentId: idString,
  date: isoDateString,
  endTime: optionalIsoDate,
  goalsTargeted: z.array(z.string()).default([]),
  activitiesUsed: z.array(z.string()).default([]),
  performanceData: z.array(performanceDataSchema).default([]),
  notes: z.string().max(5000, 'Notes must be 5000 characters or less').default(''),
  isDirectServices: z.boolean().default(true),
  indirectServicesNotes: optionalString,
  groupSessionId: optionalString,
  missedSession: z.boolean().default(false),
  selectedSubjectiveStatements: z.array(z.string()).optional(),
  customSubjective: optionalString,
  scheduledSessionId: optionalString,
  plan: optionalString,
});

export const createSessionSchema = sessionSchema.omit({ id: true });
export const updateSessionSchema = sessionSchema.partial();

// ============================================================================
// Scheduled Session Schema
// ============================================================================

export const recurrencePatternSchema = z.enum(['weekly', 'daily', 'specific-dates', 'none']);

export const scheduledSessionSchema = z.object({
  id: idString.optional(),
  studentIds: z.array(z.string()).min(1, 'At least one student is required'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in HH:mm format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be in HH:mm format').optional(),
  duration: z.number().int().min(1).max(480).optional(),
  dayOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  specificDates: z.array(z.string()).optional(),
  recurrencePattern: recurrencePatternSchema,
  startDate: isoDateString,
  endDate: optionalIsoDate,
  goalsTargeted: z.array(z.string()).default([]),
  notes: optionalString,
  isDirectServices: z.boolean().default(true),
  active: z.boolean().default(true),
  cancelledDates: z.array(z.string()).optional(),
});

export const createScheduledSessionSchema = scheduledSessionSchema;
export const updateScheduledSessionSchema = scheduledSessionSchema.partial();

// ============================================================================
// Activity Schema
// ============================================================================

export const activitySourceSchema = z.enum(['AI', 'manual']);

export const activitySchema = z.object({
  id: idString.optional(),
  description: nonEmptyString.pipe(z.string().max(5000, 'Description must be 5000 characters or less')),
  goalArea: nonEmptyString.pipe(z.string().max(100, 'Goal area must be 100 characters or less')),
  ageRange: z.string().max(50, 'Age range must be 50 characters or less').default(''),
  materials: z.array(z.string()).default([]),
  isFavorite: z.boolean().default(false),
  source: activitySourceSchema.default('manual'),
});

export const createActivitySchema = activitySchema.omit({ id: true });
export const updateActivitySchema = activitySchema.partial();

// ============================================================================
// Evaluation Schema
// ============================================================================

export const evaluationSchema = z.object({
  id: idString.optional(),
  studentId: idString,
  grade: z.string().max(20).default(''),
  evaluationType: nonEmptyString.pipe(z.string().max(100)),
  areasOfConcern: z.string().max(500).default(''),
  teacher: optionalString,
  resultsOfScreening: optionalString,
  dueDate: optionalIsoDate,
  assessments: optionalString,
  qualify: optionalString,
  reportCompleted: optionalString,
  iepCompleted: optionalString,
  meetingDate: optionalIsoDate,
});

export const createEvaluationSchema = evaluationSchema.omit({ id: true });
export const updateEvaluationSchema = evaluationSchema.partial();

// ============================================================================
// SOAP Note Schema
// ============================================================================

export const soapNoteSchema = z.object({
  id: idString.optional(),
  sessionId: idString,
  studentId: idString,
  date: isoDateString,
  templateId: optionalString,
  subjective: z.string().max(2000).default(''),
  objective: z.string().max(2000).default(''),
  assessment: z.string().max(2000).default(''),
  plan: z.string().max(2000).default(''),
});

export const createSOAPNoteSchema = soapNoteSchema;
export const updateSOAPNoteSchema = soapNoteSchema.partial();

// ============================================================================
// Progress Report Schema
// ============================================================================

export const reportTypeSchema = z.enum(['quarterly', 'annual']);
export const reportStatusSchema = z.enum(['scheduled', 'in-progress', 'completed', 'overdue']);

export const progressReportSchema = z.object({
  id: idString.optional(),
  studentId: idString,
  reportType: reportTypeSchema,
  dueDate: isoDateString,
  scheduledDate: isoDateString,
  periodStart: isoDateString,
  periodEnd: isoDateString,
  status: reportStatusSchema.default('scheduled'),
  completedDate: optionalIsoDate,
  templateId: optionalString,
  content: optionalString,
  customDueDate: optionalIsoDate,
  reminderSent: z.boolean().default(false),
  reminderSentDate: optionalIsoDate,
});

export const createProgressReportSchema = progressReportSchema;
export const updateProgressReportSchema = progressReportSchema.partial();

// ============================================================================
// Progress Report Template Schema
// ============================================================================

export const progressReportSectionSchema = z.object({
  id: idString,
  title: nonEmptyString.pipe(z.string().max(200)),
  order: z.number().int().min(0),
  content: optionalString,
  includeGoals: z.boolean().optional(),
  includeSessions: z.boolean().optional(),
});

export const progressReportTemplateSchema = z.object({
  id: idString.optional(),
  name: nonEmptyString.pipe(z.string().max(200)),
  reportType: reportTypeSchema,
  sections: z.array(progressReportSectionSchema).default([]),
  isDefault: z.boolean().default(false),
});

export const createProgressReportTemplateSchema = progressReportTemplateSchema.omit({ id: true });
export const updateProgressReportTemplateSchema = progressReportTemplateSchema.partial();

// ============================================================================
// Due Date Item Schema
// ============================================================================

export const dueDateStatusSchema = z.enum(['pending', 'completed', 'overdue']);

export const dueDateItemSchema = z.object({
  id: idString.optional(),
  title: nonEmptyString.pipe(z.string().max(200)),
  description: optionalString,
  dueDate: isoDateString,
  studentId: optionalString,
  status: dueDateStatusSchema.default('pending'),
  completedDate: optionalIsoDate,
  category: optionalString,
  priority: prioritySchema.optional(),
});

export const createDueDateItemSchema = dueDateItemSchema.omit({ id: true });
export const updateDueDateItemSchema = dueDateItemSchema.partial();

// ============================================================================
// Communication Schema
// ============================================================================

export const contactTypeSchema = z.enum(['teacher', 'parent', 'case-manager']);
export const communicationMethodSchema = z.enum(['email', 'phone', 'in-person', 'other']);

export const communicationSchema = z.object({
  id: idString.optional(),
  studentId: optionalString,
  contactType: contactTypeSchema,
  contactId: optionalString,
  contactName: nonEmptyString.pipe(z.string().max(200)),
  contactEmail: z.string().email().optional().or(z.literal('')),
  subject: z.string().max(500).default(''),
  body: z.string().max(10000).default(''),
  method: communicationMethodSchema,
  date: isoDateString,
  sessionId: optionalString,
  relatedTo: optionalString,
});

export const createCommunicationSchema = communicationSchema.omit({ id: true });
export const updateCommunicationSchema = communicationSchema.partial();

// ============================================================================
// Email Schema
// ============================================================================

export const emailSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: nonEmptyString.pipe(z.string().max(500)),
  body: nonEmptyString.pipe(z.string().max(50000)),
  fromEmail: z.string().email().optional(),
  fromName: optionalString,
  smtpHost: optionalString,
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUser: optionalString,
  smtpPassword: optionalString,
  cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
});

// ============================================================================
// Timesheet Note Schema
// ============================================================================

export const timesheetNoteSchema = z.object({
  id: idString.optional(),
  content: nonEmptyString.pipe(z.string().max(10000)),
  dateFor: optionalIsoDate,
  school: nonEmptyString,
});

export const createTimesheetNoteSchema = timesheetNoteSchema;
export const updateTimesheetNoteSchema = timesheetNoteSchema.partial();

// ============================================================================
// Query Parameter Schemas
// ============================================================================

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const schoolFilterQuerySchema = z.object({
  school: z.string().optional(),
});

export const studentFilterQuerySchema = z.object({
  studentId: z.string().optional(),
  school: z.string().optional(),
  teacherId: z.string().optional(),
  caseManagerId: z.string().optional(),
});

export const sessionFilterQuerySchema = z.object({
  studentId: z.string().optional(),
  school: z.string().optional(),
});

export const dateRangeQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SchoolInput = z.infer<typeof createSchoolSchema>;
export type TeacherInput = z.infer<typeof createTeacherSchema>;
export type CaseManagerInput = z.infer<typeof createCaseManagerSchema>;
export type StudentInput = z.infer<typeof createStudentSchema>;
export type GoalInput = z.infer<typeof createGoalSchema>;
export type SessionInput = z.infer<typeof createSessionSchema>;
export type ScheduledSessionInput = z.infer<typeof createScheduledSessionSchema>;
export type ActivityInput = z.infer<typeof createActivitySchema>;
export type EvaluationInput = z.infer<typeof createEvaluationSchema>;
export type SOAPNoteInput = z.infer<typeof createSOAPNoteSchema>;
export type ProgressReportInput = z.infer<typeof createProgressReportSchema>;
export type ProgressReportTemplateInput = z.infer<typeof createProgressReportTemplateSchema>;
export type DueDateItemInput = z.infer<typeof createDueDateItemSchema>;
export type CommunicationInput = z.infer<typeof createCommunicationSchema>;
export type EmailInput = z.infer<typeof emailSchema>;
export type TimesheetNoteInput = z.infer<typeof createTimesheetNoteSchema>;

