/**
 * API Client for SLP Caseload Tracker Backend
 * 
 * This client communicates with the Express + SQLite backend.
 * Set VITE_API_URL in your .env file or it defaults to http://localhost:3001
 */

import type { Student, Goal, Session, Activity, Evaluation, School, Lunch } from '../types';

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

  // Lunches
  lunches: {
    getAll: (school?: string) => 
      request<Lunch[]>(`/lunches${school ? `?school=${encodeURIComponent(school)}` : ''}`),
    getById: (id: string) => 
      request<Lunch>(`/lunches/${id}`),
    create: (lunch: Omit<Lunch, 'id' | 'dateCreated'>) => 
      request<{ id: string; message: string }>('/lunches', {
        method: 'POST',
        body: JSON.stringify(lunch),
      }),
    update: (id: string, updates: Partial<Lunch>) => 
      request<{ message: string }>(`/lunches/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    delete: (id: string) => 
      request<{ message: string }>(`/lunches/${id}`, {
        method: 'DELETE',
      }),
  },

  // Export
  export: {
    getAll: () => 
      request<any>('/export/all'),
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

