import type { Student, Goal, Session, Activity, GoalTemplate } from '../types';

const STORAGE_KEYS = {
  STUDENTS: 'slp_students',
  GOALS: 'slp_goals',
  SESSIONS: 'slp_sessions',
  ACTIVITIES: 'slp_activities',
} as const;

// Students
export const getStudents = (): Student[] => {
  const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
  return data ? JSON.parse(data) : [];
};

export const saveStudents = (students: Student[]): void => {
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
};

export const addStudent = (student: Student): void => {
  const students = getStudents();
  students.push(student);
  saveStudents(students);
};

export const updateStudent = (id: string, updates: Partial<Student>): void => {
  const students = getStudents();
  const index = students.findIndex(s => s.id === id);
  if (index !== -1) {
    students[index] = { ...students[index], ...updates };
    saveStudents(students);
  }
};

export const deleteStudent = (id: string): void => {
  const students = getStudents().filter(s => s.id !== id);
  saveStudents(students);
};

// Goals
export const getGoals = (): Goal[] => {
  const data = localStorage.getItem(STORAGE_KEYS.GOALS);
  return data ? JSON.parse(data) : [];
};

export const getGoalsByStudent = (studentId: string): Goal[] => {
  return getGoals().filter(g => g.studentId === studentId);
};

export const saveGoals = (goals: Goal[]): void => {
  localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
};

export const addGoal = (goal: Goal): void => {
  const goals = getGoals();
  goals.push(goal);
  saveGoals(goals);
};

export const updateGoal = (id: string, updates: Partial<Goal>): void => {
  const goals = getGoals();
  const index = goals.findIndex(g => g.id === id);
  if (index !== -1) {
    goals[index] = { ...goals[index], ...updates };
    saveGoals(goals);
  }
};

export const deleteGoal = (id: string): void => {
  const goals = getGoals().filter(g => g.id !== id);
  saveGoals(goals);
};

// Sessions
export const getSessions = (): Session[] => {
  const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
  return data ? JSON.parse(data) : [];
};

export const getSessionsByStudent = (studentId: string): Session[] => {
  return getSessions()
    .filter(s => s.studentId === studentId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const saveSessions = (sessions: Session[]): void => {
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
};

export const addSession = (session: Session): void => {
  const sessions = getSessions();
  sessions.push(session);
  saveSessions(sessions);
};

export const updateSession = (id: string, updates: Partial<Session>): void => {
  const sessions = getSessions();
  const index = sessions.findIndex(s => s.id === id);
  if (index !== -1) {
    sessions[index] = { ...sessions[index], ...updates };
    saveSessions(sessions);
  }
};

export const deleteSession = (id: string): void => {
  const sessions = getSessions().filter(s => s.id !== id);
  saveSessions(sessions);
};

// Activities
export const getActivities = (): Activity[] => {
  const data = localStorage.getItem(STORAGE_KEYS.ACTIVITIES);
  return data ? JSON.parse(data) : [];
};

export const saveActivities = (activities: Activity[]): void => {
  localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities));
};

export const addActivity = (activity: Activity): void => {
  const activities = getActivities();
  activities.push(activity);
  saveActivities(activities);
};

export const updateActivity = (id: string, updates: Partial<Activity>): void => {
  const activities = getActivities();
  const index = activities.findIndex(a => a.id === id);
  if (index !== -1) {
    activities[index] = { ...activities[index], ...updates };
    saveActivities(activities);
  }
};

export const deleteActivity = (id: string): void => {
  const activities = getActivities().filter(a => a.id !== id);
  saveActivities(activities);
};

// Export/Import
export const exportData = (): string => {
  return JSON.stringify({
    students: getStudents(),
    goals: getGoals(),
    sessions: getSessions(),
    activities: getActivities(),
    exportDate: new Date().toISOString(),
  }, null, 2);
};

export const importData = (jsonString: string): void => {
  try {
    const data = JSON.parse(jsonString);
    if (data.students) saveStudents(data.students);
    if (data.goals) saveGoals(data.goals);
    if (data.sessions) saveSessions(data.sessions);
    if (data.activities) saveActivities(data.activities);
  } catch (error) {
    throw new Error('Invalid JSON data');
  }
};

