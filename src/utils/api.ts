/**
 * API Client for SLP Caseload Tracker Backend
 * 
 * This client communicates with the Express + SQLite backend.
 * Set VITE_API_URL in your .env file or it defaults to http://localhost:3001
 */

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
  } catch (error: any) {
    console.error(`API request failed: ${endpoint}`, error);
    // Provide more helpful error messages
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
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
      request<any[]>(`/students${school ? `?school=${encodeURIComponent(school)}` : ''}`),
    getById: (id: string) => 
      request<any>(`/students/${id}`),
    create: (student: any) => 
      request<{ id: string; message: string }>('/students', {
        method: 'POST',
        body: JSON.stringify(student),
      }),
    update: (id: string, updates: any) => 
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
      return request<any[]>(`/goals${params.toString() ? `?${params}` : ''}`);
    },
    getById: (id: string) => 
      request<any>(`/goals/${id}`),
    create: (goal: any) => 
      request<{ id: string; message: string }>('/goals', {
        method: 'POST',
        body: JSON.stringify(goal),
      }),
    update: (id: string, updates: any) => 
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
      return request<any[]>(`/sessions${params.toString() ? `?${params}` : ''}`);
    },
    getById: (id: string) => 
      request<any>(`/sessions/${id}`),
    create: (session: any) => 
      request<{ id: string; message: string }>('/sessions', {
        method: 'POST',
        body: JSON.stringify(session),
      }),
    update: (id: string, updates: any) => 
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
      request<any[]>('/activities'),
    getById: (id: string) => 
      request<any>(`/activities/${id}`),
    create: (activity: any) => 
      request<{ id: string; message: string }>('/activities', {
        method: 'POST',
        body: JSON.stringify(activity),
      }),
    update: (id: string, updates: any) => 
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
      return request<any[]>(`/evaluations${params.toString() ? `?${params}` : ''}`);
    },
    getById: (id: string) => 
      request<any>(`/evaluations/${id}`),
    create: (evaluation: any) => 
      request<{ id: string; message: string }>('/evaluations', {
        method: 'POST',
        body: JSON.stringify(evaluation),
      }),
    update: (id: string, updates: any) => 
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
      request<any[]>('/schools'),
    getById: (id: string) => 
      request<any>(`/schools/${id}`),
    getByName: (name: string) => 
      request<any>(`/schools/name/${encodeURIComponent(name)}`),
    create: (school: any) => 
      request<{ id: string; message: string }>('/schools', {
        method: 'POST',
        body: JSON.stringify(school),
      }),
    update: (id: string, updates: any) => 
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
      request<any[]>(`/lunches${school ? `?school=${encodeURIComponent(school)}` : ''}`),
    getById: (id: string) => 
      request<any>(`/lunches/${id}`),
    create: (lunch: any) => 
      request<{ id: string; message: string }>('/lunches', {
        method: 'POST',
        body: JSON.stringify(lunch),
      }),
    update: (id: string, updates: any) => 
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

