/**
 * API Client for SLP Caseload Tracker Backend
 * 
 * This client communicates with the Express + SQLite backend.
 * Set VITE_API_URL in your .env file or it defaults to http://localhost:3001
 */

import type { Student, Goal, Session, Activity, Evaluation, School, Teacher, CaseManager, SOAPNote, ProgressReport, ProgressReportTemplate, DueDateItem, Reminder, Communication } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  } catch (error: unknown) {
    console.error(`API request failed: ${endpoint}`, error);
    // Provide more helpful error messages
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
      throw new Error('Cannot connect to API server. Make sure the server is running on http://localhost:3001');
    }
    throw error;
  }
}

// Students
export const api = {
  // Students
  students: {
    getAll: (school?: string) => 
      request<Student[]>(`/students${school ? `?school=${encodeURIComponent(school)}` : ''}`),
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
    getAll: (studentId?: string, school?: string) => {
      const params = new URLSearchParams();
      if (studentId) params.append('studentId', studentId);
      if (school) params.append('school', school);
      return request<Goal[]>(`/goals${params.toString() ? `?${params}` : ''}`);
    },
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
    getAll: (studentId?: string, school?: string) => {
      const params = new URLSearchParams();
      if (studentId) params.append('studentId', studentId);
      if (school) params.append('school', school);
      return request<Session[]>(`/sessions${params.toString() ? `?${params}` : ''}`);
    },
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
    getAll: (studentId?: string, school?: string) => {
      const params = new URLSearchParams();
      if (studentId) params.append('studentId', studentId);
      if (school) params.append('school', school);
      return request<Evaluation[]>(`/evaluations${params.toString() ? `?${params}` : ''}`);
    },
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
      request<Teacher[]>(`/teachers${school ? `?school=${encodeURIComponent(school)}` : ''}`),
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
      request<CaseManager[]>(`/case-managers${school ? `?school=${encodeURIComponent(school)}` : ''}`),
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
    getAll: (studentId?: string, sessionId?: string) => {
      const params = new URLSearchParams();
      if (studentId) params.append('studentId', studentId);
      if (sessionId) params.append('sessionId', sessionId);
      return request<SOAPNote[]>(`/soap-notes${params.toString() ? `?${params}` : ''}`);
    },
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
    getAll: (studentId?: string, school?: string, status?: string, startDate?: string, endDate?: string) => {
      const params = new URLSearchParams();
      if (studentId) params.append('studentId', studentId);
      if (school) params.append('school', school);
      if (status) params.append('status', status);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      return request<ProgressReport[]>(`/progress-reports${params.toString() ? `?${params}` : ''}`);
    },
    getUpcoming: (days?: number, school?: string) => {
      const params = new URLSearchParams();
      if (days) params.append('days', days.toString());
      if (school) params.append('school', school);
      return request<ProgressReport[]>(`/progress-reports/upcoming${params.toString() ? `?${params}` : ''}`);
    },
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
      request<ProgressReportTemplate[]>(`/progress-report-templates${reportType ? `?reportType=${reportType}` : ''}`),
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
    getAll: (studentId?: string, status?: string, category?: string, startDate?: string, endDate?: string, school?: string) => {
      const params = new URLSearchParams();
      if (studentId) params.append('studentId', studentId);
      if (status) params.append('status', status);
      if (category) params.append('category', category);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (school) params.append('school', school);
      return request<DueDateItem[]>(`/due-date-items${params.toString() ? `?${params}` : ''}`);
    },
    getUpcoming: (days?: number, school?: string) => {
      const params = new URLSearchParams();
      if (days) params.append('days', days.toString());
      if (school) params.append('school', school);
      return request<DueDateItem[]>(`/due-date-items/upcoming${params.toString() ? `?${params}` : ''}`);
    },
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
    getAll: (school?: string) => {
      const params = new URLSearchParams();
      if (school) params.append('school', school);
      return request<Reminder[]>(`/reminders${params.toString() ? `?${params}` : ''}`);
    },
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
    }) =>
      request<{ success: boolean; messageId?: string; message: string }>('/email/send', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Communications
  communications: {
    getAll: (studentId?: string, contactType?: string, school?: string) => {
      const params = new URLSearchParams();
      if (studentId) params.append('studentId', studentId);
      if (contactType) params.append('contactType', contactType);
      if (school) params.append('school', school);
      return request<Communication[]>(`/communications${params.toString() ? `?${params}` : ''}`);
    },
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

