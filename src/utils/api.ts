/**
 * API Client for SLP Caseload Tracker Backend
 * 
 * This client communicates with the Express + SQLite backend.
 * Set VITE_API_URL in your .env file or it defaults to http://localhost:3001
 */

import type { Student, Goal, Session, Activity, Evaluation, School, Teacher, CaseManager, SOAPNote, ProgressReport, ProgressReportTemplate, DueDateItem, Reminder, Communication, ScheduledSession, TimesheetNote } from '../types';
import { buildQueryString } from './queryHelpers';
import { logError } from './logger';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Validation error detail from the API
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
}

/**
 * Custom API Error class for better error handling
 * Provides status code, endpoint, validation errors, and user-friendly error messages
 */
export class ApiError extends Error {
  /** Validation error details from the API (for 400 errors) */
  public validationErrors?: ValidationErrorDetail[];

  constructor(
    message: string,
    public status?: number,
    public endpoint?: string,
    public originalError?: unknown,
    validationErrors?: ValidationErrorDetail[]
  ) {
    super(message);
    this.name = 'ApiError';
    this.validationErrors = validationErrors;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Get a user-friendly error message based on status code
   */
  getUserMessage(): string {
    // If we have validation errors, format them nicely
    if (this.validationErrors && this.validationErrors.length > 0) {
      if (this.validationErrors.length === 1) {
        return this.validationErrors[0].message;
      }
      return this.validationErrors.map(e => `• ${e.message}`).join('\n');
    }

    if (this.status) {
      switch (this.status) {
        case 400:
          return 'Invalid request. Please check your input and try again.';
        case 401:
          return 'Authentication required. Please log in and try again.';
        case 403:
          return 'You do not have permission to perform this action.';
        case 404:
          return 'The requested resource was not found.';
        case 409:
          return 'This resource already exists. Please check for duplicates.';
        case 422:
          return 'The request could not be processed. Please check your input.';
        case 429:
          return 'Too many requests. Please wait a moment and try again.';
        case 500:
          return 'A server error occurred. Please try again later.';
        case 503:
          return 'The service is temporarily unavailable. Please try again later.';
        default:
          if (this.status >= 500) {
            return 'A server error occurred. Please try again later.';
          } else if (this.status >= 400) {
            return 'An error occurred with your request. Please check your input.';
          }
      }
    }
    
    // Network errors
    if (this.message.includes('Failed to fetch') || this.message.includes('NetworkError')) {
      return 'Cannot connect to the server. Make sure the API server is running on http://localhost:3001';
    }
    
    // Return the original message if no specific handling
    return this.message;
  }

  /**
   * Check if this is a validation error (400 with details)
   */
  isValidationError(): boolean {
    return this.status === 400 && !!this.validationErrors && this.validationErrors.length > 0;
  }

  /**
   * Get validation error for a specific field
   */
  getFieldError(fieldName: string): string | undefined {
    return this.validationErrors?.find(e => e.field === fieldName)?.message;
  }

  /**
   * Get all field names that have errors
   */
  getErrorFields(): string[] {
    return this.validationErrors?.map(e => e.field) || [];
  }

  /**
   * Check if this is a network/connection error
   */
  isNetworkError(): boolean {
    return (
      !this.status &&
      (this.message.includes('Failed to fetch') ||
       this.message.includes('NetworkError') ||
       this.message.includes('Network request failed'))
    );
  }

  /**
   * Check if this is a client error (4xx)
   */
  isClientError(): boolean {
    return this.status !== undefined && this.status >= 400 && this.status < 500;
  }

  /**
   * Check if this is a server error (5xx)
   */
  isServerError(): boolean {
    return this.status !== undefined && this.status >= 500;
  }

  /**
   * Check if this is a rate limit error (429)
   */
  isRateLimitError(): boolean {
    return this.status === 429;
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      // Try to parse error response
      let errorMessage = response.statusText;
      let errorData: unknown = null;
      let validationErrors: ValidationErrorDetail[] | undefined;
      
      try {
        errorData = await response.json();
        if (errorData && typeof errorData === 'object') {
          // Extract validation error details if present
          if ('details' in errorData && Array.isArray(errorData.details)) {
            validationErrors = errorData.details as ValidationErrorDetail[];
          }
          // Extract error message
          if ('message' in errorData) {
            errorMessage = String(errorData.message);
          } else if ('error' in errorData) {
            errorMessage = String(errorData.error);
          }
        }
      } catch {
        // If JSON parsing fails, use status text
      }

      // Create ApiError with status code, endpoint, and validation errors
      throw new ApiError(
        errorMessage || `HTTP ${response.status}`,
        response.status,
        endpoint,
        errorData,
        validationErrors
      );
    }

    return response.json();
  } catch (error: unknown) {
    // If it's already an ApiError, just log and re-throw
    if (error instanceof ApiError) {
      logError(`API request failed: ${endpoint}`, error);
      throw error;
    }

    // Handle network errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError(`API request failed: ${endpoint}`, error);

    // Create ApiError for network errors
    if (errorMessage.includes('Failed to fetch') || 
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Network request failed')) {
      throw new ApiError(
        'Cannot connect to API server. Make sure the server is running on http://localhost:3001',
        undefined,
        endpoint,
        error
      );
    }

    // For other errors, wrap in ApiError
    throw new ApiError(
      errorMessage || 'An unknown error occurred',
      undefined,
      endpoint,
      error
    );
  }
}

// Students
export const api = {
  // Students
  students: {
    getAll: (school?: string, teacherId?: string, caseManagerId?: string) => 
      request<Student[]>(`/students${buildQueryString({ school, teacherId, caseManagerId })}`),
    getById: (id: string) => 
      request<Student>(`/students/${id}`),
    create: (student: Omit<Student, 'id' | 'dateAdded'>) => 
      request<{ id: string; message: string }>('/students', {
        method: 'POST',
        body: JSON.stringify(student),
      }),
    update: (id: string, updates: Partial<Student>) => 
      request<{ message: string }>(`/students/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    delete: (id: string) => 
      request<{ message: string }>(`/students/${id}`, {
        method: 'DELETE',
      }),
  },

  // Goals
  goals: {
    getAll: (studentId?: string, school?: string) => 
      request<Goal[]>(`/goals${buildQueryString({ studentId, school })}`),
    getById: (id: string) => 
      request<Goal>(`/goals/${id}`),
    create: (goal: Omit<Goal, 'id' | 'dateCreated'>) => 
      request<{ id: string; message: string }>('/goals', {
        method: 'POST',
        body: JSON.stringify(goal),
      }),
    update: (id: string, updates: Partial<Goal>) => 
      request<{ message: string }>(`/goals/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    delete: (id: string) => 
      request<{ message: string }>(`/goals/${id}`, {
        method: 'DELETE',
      }),
  },

  // Sessions
  sessions: {
    getAll: (studentId?: string, school?: string) => 
      request<Session[]>(`/sessions${buildQueryString({ studentId, school })}`),
    getById: (id: string) => 
      request<Session>(`/sessions/${id}`),
    create: (session: Omit<Session, 'id'>) => 
      request<{ id: string; message: string }>('/sessions', {
        method: 'POST',
        body: JSON.stringify(session),
      }),
    update: (id: string, updates: Partial<Session>) => 
      request<{ message: string }>(`/sessions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    delete: (id: string) => 
      request<{ message: string }>(`/sessions/${id}`, {
        method: 'DELETE',
      }),
  },

  // Activities
  activities: {
    getAll: () => 
      request<Activity[]>('/activities'),
    getById: (id: string) => 
      request<Activity>(`/activities/${id}`),
    create: (activity: Omit<Activity, 'id' | 'dateCreated'>) => 
      request<{ id: string; message: string }>('/activities', {
        method: 'POST',
        body: JSON.stringify(activity),
      }),
    update: (id: string, updates: Partial<Activity>) => 
      request<{ message: string }>(`/activities/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    delete: (id: string) => 
      request<{ message: string }>(`/activities/${id}`, {
        method: 'DELETE',
      }),
  },

  // Evaluations
  evaluations: {
    getAll: (studentId?: string, school?: string) => 
      request<Evaluation[]>(`/evaluations${buildQueryString({ studentId, school })}`),
    getById: (id: string) => 
      request<Evaluation>(`/evaluations/${id}`),
    create: (evaluation: Omit<Evaluation, 'id' | 'dateCreated' | 'dateUpdated'>) => 
      request<{ id: string; message: string }>('/evaluations', {
        method: 'POST',
        body: JSON.stringify(evaluation),
      }),
    update: (id: string, updates: Partial<Evaluation>) => 
      request<{ message: string }>(`/evaluations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    delete: (id: string) => 
      request<{ message: string }>(`/evaluations/${id}`, {
        method: 'DELETE',
      }),
  },

  // Schools
  schools: {
    getAll: () => 
      request<School[]>('/schools'),
    getById: (id: string) => 
      request<School>(`/schools/${id}`),
    getByName: (name: string) => 
      request<School>(`/schools/name/${encodeURIComponent(name)}`),
    create: (school: Omit<School, 'id' | 'dateCreated'>) => 
      request<{ id: string; message: string }>('/schools', {
        method: 'POST',
        body: JSON.stringify(school),
      }),
    update: (id: string, updates: Partial<School>) => 
      request<{ message: string }>(`/schools/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    delete: (id: string) => 
      request<{ message: string }>(`/schools/${id}`, {
        method: 'DELETE',
      }),
  },

  // Teachers
  teachers: {
    getAll: (school?: string) => 
      request<Teacher[]>(`/teachers${buildQueryString({ school })}`),
    getById: (id: string) => 
      request<Teacher>(`/teachers/${id}`),
    create: (teacher: Omit<Teacher, 'id' | 'dateCreated'>) => 
      request<{ id: string; message: string }>('/teachers', {
        method: 'POST',
        body: JSON.stringify(teacher),
      }),
    update: (id: string, updates: Partial<Teacher>) => 
      request<{ message: string }>(`/teachers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    delete: (id: string) => 
      request<{ message: string }>(`/teachers/${id}`, {
        method: 'DELETE',
      }),
  },

  // Case Managers
  caseManagers: {
    getAll: (school?: string) => 
      request<CaseManager[]>(`/case-managers${buildQueryString({ school })}`),
    getById: (id: string) => 
      request<CaseManager>(`/case-managers/${id}`),
    create: (caseManager: CaseManager) => 
      request<{ id: string; message: string }>('/case-managers', {
        method: 'POST',
        body: JSON.stringify(caseManager),
      }),
    update: (id: string, updates: Partial<CaseManager>) => 
      request<{ message: string }>(`/case-managers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    delete: (id: string) => 
      request<{ message: string }>(`/case-managers/${id}`, {
        method: 'DELETE',
      }),
  },

  // SOAP Notes
  soapNotes: {
    getAll: (studentId?: string, sessionId?: string) => 
      request<SOAPNote[]>(`/soap-notes${buildQueryString({ studentId, sessionId })}`),
    getById: (id: string) => 
      request<SOAPNote>(`/soap-notes/${id}`),
    create: (soapNote: SOAPNote) => 
      request<{ id: string; message: string }>('/soap-notes', {
        method: 'POST',
        body: JSON.stringify(soapNote),
      }),
    update: (id: string, updates: Partial<SOAPNote>) => 
      request<{ message: string }>(`/soap-notes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    delete: (id: string) => 
      request<{ message: string }>(`/soap-notes/${id}`, {
        method: 'DELETE',
      }),
  },

  // Export
  export: {
    getAll: () => 
      request<any>('/export/all'),
  },

  // Progress Reports
  progressReports: {
    getAll: (studentId?: string, school?: string, status?: string, startDate?: string, endDate?: string) => 
      request<ProgressReport[]>(`/progress-reports${buildQueryString({ studentId, school, status, startDate, endDate })}`),
    getUpcoming: (days?: number, school?: string) => 
      request<ProgressReport[]>(`/progress-reports/upcoming${buildQueryString({ days, school })}`),
    getById: (id: string) => 
      request<ProgressReport>(`/progress-reports/${id}`),
    create: (report: ProgressReport) => 
      request<{ id: string; message: string }>('/progress-reports', {
        method: 'POST',
        body: JSON.stringify(report),
      }),
    update: (id: string, updates: Partial<ProgressReport>) => 
      request<{ message: string }>(`/progress-reports/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    scheduleAuto: (studentId?: string, school?: string) => 
      request<{ message: string; reports: ProgressReport[] }>('/progress-reports/schedule-auto', {
        method: 'POST',
        body: JSON.stringify({ studentId, school }),
      }),
    complete: (id: string) => 
      request<{ message: string }>(`/progress-reports/${id}/complete`, {
        method: 'POST',
      }),
    delete: (id: string) => 
      request<{ message: string }>(`/progress-reports/${id}`, {
        method: 'DELETE',
      }),
  },

  // Progress Report Templates
  progressReportTemplates: {
    getAll: (reportType?: 'quarterly' | 'annual') => 
      request<ProgressReportTemplate[]>(`/progress-report-templates${buildQueryString({ reportType })}`),
    getById: (id: string) => 
      request<ProgressReportTemplate>(`/progress-report-templates/${id}`),
    create: (template: Omit<ProgressReportTemplate, 'id' | 'dateCreated' | 'dateUpdated'>) => 
      request<{ id: string; message: string }>('/progress-report-templates', {
        method: 'POST',
        body: JSON.stringify(template),
      }),
    update: (id: string, updates: Partial<ProgressReportTemplate>) => 
      request<{ message: string }>(`/progress-report-templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    setDefault: (id: string) => 
      request<{ message: string }>(`/progress-report-templates/${id}/set-default`, {
        method: 'POST',
      }),
    delete: (id: string) => 
      request<{ message: string }>(`/progress-report-templates/${id}`, {
        method: 'DELETE',
      }),
  },

  // Due Date Items
  dueDateItems: {
    getAll: (studentId?: string, status?: string, category?: string, startDate?: string, endDate?: string, school?: string) => 
      request<DueDateItem[]>(`/due-date-items${buildQueryString({ studentId, status, category, startDate, endDate, school })}`),
    getUpcoming: (days?: number, school?: string) => 
      request<DueDateItem[]>(`/due-date-items/upcoming${buildQueryString({ days, school })}`),
    getById: (id: string) => 
      request<DueDateItem>(`/due-date-items/${id}`),
    create: (item: Omit<DueDateItem, 'id' | 'dateCreated' | 'dateUpdated'>) => 
      request<{ id: string; message: string }>('/due-date-items', {
        method: 'POST',
        body: JSON.stringify(item),
      }),
    update: (id: string, updates: Partial<DueDateItem>) => 
      request<{ message: string }>(`/due-date-items/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    complete: (id: string) => 
      request<{ message: string }>(`/due-date-items/${id}/complete`, {
        method: 'POST',
      }),
    delete: (id: string) => 
      request<{ message: string }>(`/due-date-items/${id}`, {
        method: 'DELETE',
      }),
  },

  // Reminders
  reminders: {
    getAll: (school?: string) => 
      request<Reminder[]>(`/reminders${buildQueryString({ school })}`),
  },

  // Email
  email: {
    send: (data: {
      to: string;
      subject: string;
      body: string;
      fromEmail?: string;
      fromName?: string;
      smtpHost?: string;
      smtpPort?: number;
      smtpUser?: string;
      smtpPassword?: string;
      cc?: string | string[];
      bcc?: string | string[];
    }) =>
      request<{ success: boolean; messageId?: string; message: string }>('/email/send', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Communications
  communications: {
    getAll: (studentId?: string, contactType?: string, school?: string) => 
      request<Communication[]>(`/communications${buildQueryString({ studentId, contactType, school })}`),
    getById: (id: string) => 
      request<Communication>(`/communications/${id}`),
    create: (communication: Omit<Communication, 'id' | 'dateCreated'>) => 
      request<{ id: string; message: string }>('/communications', {
        method: 'POST',
        body: JSON.stringify(communication),
      }),
    update: (id: string, updates: Partial<Communication>) => 
      request<{ message: string }>(`/communications/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    delete: (id: string) => 
      request<{ message: string }>(`/communications/${id}`, {
        method: 'DELETE',
      }),
  },

  // Scheduled Sessions
  scheduledSessions: {
    getAll: (school?: string) => 
      request<ScheduledSession[]>(`/scheduled-sessions${buildQueryString({ school })}`),
    getById: (id: string) => 
      request<ScheduledSession>(`/scheduled-sessions/${id}`),
    create: (session: ScheduledSession) => 
      request<{ id: string; message: string }>('/scheduled-sessions', {
        method: 'POST',
        body: JSON.stringify(session),
      }),
    update: (id: string, updates: Partial<ScheduledSession>) => 
      request<{ message: string }>(`/scheduled-sessions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    delete: (id: string) => 
      request<{ message: string }>(`/scheduled-sessions/${id}`, {
        method: 'DELETE',
      }),
  },

  // Timesheet Notes
  timesheetNotes: {
    getAll: (school?: string) => 
      request<TimesheetNote[]>(`/timesheet-notes${buildQueryString({ school })}`),
    getById: (id: string) => 
      request<TimesheetNote>(`/timesheet-notes/${id}`),
    create: (note: Omit<TimesheetNote, 'id' | 'dateCreated'>) => 
      request<{ id: string; message: string }>('/timesheet-notes', {
        method: 'POST',
        body: JSON.stringify({
          ...note,
          id: crypto.randomUUID(),
          dateCreated: new Date().toISOString(),
        }),
      }),
    update: (id: string, updates: Partial<TimesheetNote>) => 
      request<{ message: string }>(`/timesheet-notes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    delete: (id: string) => 
      request<{ message: string }>(`/timesheet-notes/${id}`, {
        method: 'DELETE',
      }),
  },

  // Seed Test Data
  seedTestData: {
    create: () => 
      request<{ message: string; schoolId: string; teacherCount: number; studentCount: number }>('/seed-test-data', {
        method: 'POST',
      }),
    delete: () => 
      request<{ message: string; deletedStudents: number; deletedTeachers: number; deletedSchool: number }>('/seed-test-data', {
        method: 'DELETE',
      }),
    exists: () => 
      request<{ exists: boolean; studentCount?: number; teacherCount?: number }>('/seed-test-data/exists'),
  },

  // Database Backup
  backup: {
    list: () =>
      request<{
        count: number;
        backups: Array<{
          filename: string;
          size: number;
          sizeFormatted: string;
          createdAt: string;
        }>;
      }>('/backup'),
    create: () =>
      request<{
        message: string;
        filename: string;
        size: number;
        sizeFormatted: string;
      }>('/backup', { method: 'POST' }),
    delete: (filename: string) =>
      request<{ message: string }>(`/backup/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      }),
    restore: (filename: string) =>
      request<{ message: string; warning: string }>(`/backup/${encodeURIComponent(filename)}/restore`, {
        method: 'POST',
      }),
    getDownloadUrl: (filename: string) =>
      `${API_URL}/backup/${encodeURIComponent(filename)}`,
  },
};

// Check if API is available
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL.replace('/api', '')}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// Force module refresh

