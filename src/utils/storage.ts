import type { Student, Goal, Session, Activity, GoalTemplate, Evaluation, School, ScheduledSession } from '../types';

const STORAGE_KEYS = {
  STUDENTS: 'slp_students',
  GOALS: 'slp_goals',
  SESSIONS: 'slp_sessions',
  ACTIVITIES: 'slp_activities',
  EVALUATIONS: 'slp_evaluations',
  SCHOOLS: 'slp_schools',
  SCHEDULED_SESSIONS: 'slp_scheduled_sessions',
} as const;

const DEFAULT_SCHOOL = 'Noble Academy';

// Migrate existing students to have school field
const migrateStudents = (): void => {
  const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
  if (!data) return;
  
  try {
    const students = JSON.parse(data) as Student[];
    let needsMigration = false;
    const migrated = students.map((student) => {
      if (!student.school) {
        needsMigration = true;
        return { ...student, school: DEFAULT_SCHOOL };
      }
      return student;
    });
    
    if (needsMigration) {
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(migrated));
    }
  } catch {
    // If parsing fails, ignore
  }
};

// Run migration on first load
if (typeof window !== 'undefined') {
  migrateStudents();
}

// Students
export const getStudents = (school?: string): Student[] => {
  const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
  
  // Only log warning in development and only once
  if (process.env.NODE_ENV === 'development' && (!data || data === '[]' || data === 'null')) {
    const hasWarned = sessionStorage.getItem('slp_students_warned');
    if (!hasWarned) {
      console.warn('⚠️ No SLP students data found in localStorage!');
      sessionStorage.setItem('slp_students_warned', 'true');
    }
  }
  
  let students: Student[] = data ? JSON.parse(data) : [];
  
  // Migrate on each get to ensure all students have school
  const migrated = students.map((student) => {
    if (!student.school) {
      return { ...student, school: DEFAULT_SCHOOL };
    }
    return student;
  });
  
  // If migration happened, save it
  if (migrated.some((s, i) => !students[i]?.school)) {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(migrated));
    students = migrated;
  }
  
  // Filter by school if provided (case-insensitive, trimmed comparison)
  if (school && school.trim()) {
    const normalizedSchool = school.trim();
    const filtered = migrated.filter((s) => {
      const studentSchool = (s.school || DEFAULT_SCHOOL).trim();
      return studentSchool === normalizedSchool;
    });
    return filtered;
  }
  
  return migrated;
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

export const getGoalsByStudent = (studentId: string, school?: string): Goal[] => {
  const allGoals = getGoals();
  const students = getStudents(school);
  const studentIds = new Set(students.map(s => s.id));
  return allGoals.filter(g => g.studentId === studentId && studentIds.has(g.studentId));
};

export const getGoalsBySchool = (school: string): Goal[] => {
  const allGoals = getGoals();
  const students = getStudents(school);
  const studentIds = new Set(students.map(s => s.id));
  return allGoals.filter(g => studentIds.has(g.studentId));
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

export const getSessionsByStudent = (studentId: string, school?: string): Session[] => {
  const allSessions = getSessions();
  const students = school ? getStudents(school) : getStudents();
  const studentIds = new Set(students.map(s => s.id));
  return allSessions
    .filter(s => s.studentId === studentId && studentIds.has(s.studentId))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const getSessionsBySchool = (school: string): Session[] => {
  const allSessions = getSessions();
  const students = getStudents(school);
  const studentIds = new Set(students.map(s => s.id));
  return allSessions
    .filter(s => studentIds.has(s.studentId))
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

// Evaluations
export const getEvaluations = (school?: string): Evaluation[] => {
  const data = localStorage.getItem(STORAGE_KEYS.EVALUATIONS);
  let evaluations: Evaluation[] = data ? JSON.parse(data) : [];
  
  // Filter by school if provided
  if (school && school.trim()) {
    const students = getStudents(school);
    const studentIds = new Set(students.map(s => s.id));
    evaluations = evaluations.filter(e => studentIds.has(e.studentId));
  }
  
  return evaluations;
};

export const getEvaluationsByStudent = (studentId: string): Evaluation[] => {
  const allEvaluations = getEvaluations();
  return allEvaluations
    .filter(e => e.studentId === studentId)
    .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
};

export const saveEvaluations = (evaluations: Evaluation[]): void => {
  localStorage.setItem(STORAGE_KEYS.EVALUATIONS, JSON.stringify(evaluations));
};

export const addEvaluation = (evaluation: Evaluation): void => {
  const evaluations = getEvaluations();
  evaluations.push(evaluation);
  saveEvaluations(evaluations);
};

export const updateEvaluation = (id: string, updates: Partial<Evaluation>): void => {
  const evaluations = getEvaluations();
  const index = evaluations.findIndex(e => e.id === id);
  if (index !== -1) {
    evaluations[index] = { 
      ...evaluations[index], 
      ...updates,
      dateUpdated: new Date().toISOString(),
    };
    saveEvaluations(evaluations);
  }
};

export const deleteEvaluation = (id: string): void => {
  const evaluations = getEvaluations().filter(e => e.id !== id);
  saveEvaluations(evaluations);
};

// Schools
// Migrate existing schools to have teletherapy field
const migrateSchools = (): void => {
  const data = localStorage.getItem(STORAGE_KEYS.SCHOOLS);
  if (!data) return;
  
  try {
    const schools = JSON.parse(data) as School[];
    let needsMigration = false;
    const migrated = schools.map((school) => {
      if (school.teletherapy === undefined) {
        needsMigration = true;
        return { ...school, teletherapy: false };
      }
      return school;
    });
    
    if (needsMigration) {
      localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(migrated));
    }
  } catch {
    // If parsing fails, ignore
  }
};

// Run migration on first load
if (typeof window !== 'undefined') {
  migrateSchools();
}

export const getSchools = (): School[] => {
  const data = localStorage.getItem(STORAGE_KEYS.SCHOOLS);
  let schools: School[] = data ? JSON.parse(data) : [];
  
  // Ensure all schools have teletherapy field
  const migrated = schools.map((school) => {
    if (school.teletherapy === undefined) {
      return { ...school, teletherapy: false };
    }
    return school;
  });
  
  // If migration happened, save it
  if (migrated.some((s, i) => schools[i]?.teletherapy === undefined)) {
    localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(migrated));
    schools = migrated;
  }
  
  return schools;
};

export const saveSchools = (schools: School[]): void => {
  localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(schools));
};

export const addSchool = (school: School): void => {
  const schools = getSchools();
  schools.push(school);
  saveSchools(schools);
};

export const updateSchool = (id: string, updates: Partial<School>): void => {
  const schools = getSchools();
  const index = schools.findIndex(s => s.id === id);
  if (index !== -1) {
    schools[index] = { ...schools[index], ...updates };
    saveSchools(schools);
  }
};

export const deleteSchool = (id: string): void => {
  const schools = getSchools().filter(s => s.id !== id);
  saveSchools(schools);
};

export const getSchoolByName = (name: string): School | undefined => {
  const schools = getSchools();
  return schools.find(s => s.name.trim().toLowerCase() === name.trim().toLowerCase());
};

// Export/Import
export const exportData = (): string => {
  return JSON.stringify({
    students: getStudents(),
    goals: getGoals(),
    sessions: getSessions(),
    activities: getActivities(),
    evaluations: getEvaluations(),
    schools: getSchools(),
    scheduledSessions: getScheduledSessions(),
    exportDate: new Date().toISOString(),
  }, null, 2);
};

// Scheduled Sessions
export const getScheduledSessions = (school?: string): ScheduledSession[] => {
  const data = localStorage.getItem(STORAGE_KEYS.SCHEDULED_SESSIONS);
  let scheduledSessions: ScheduledSession[] = data ? JSON.parse(data) : [];
  
  // Filter by school if provided
  if (school && school.trim()) {
    const students = getStudents(school);
    const studentIds = new Set(students.map(s => s.id));
    scheduledSessions = scheduledSessions.filter(ss => 
      ss.studentIds.some(id => studentIds.has(id))
    );
  }
  
  return scheduledSessions.filter(ss => ss.active !== false);
};

export const saveScheduledSessions = (scheduledSessions: ScheduledSession[]): void => {
  localStorage.setItem(STORAGE_KEYS.SCHEDULED_SESSIONS, JSON.stringify(scheduledSessions));
};

export const addScheduledSession = (scheduledSession: ScheduledSession): void => {
  const scheduledSessions = getScheduledSessions();
  scheduledSessions.push(scheduledSession);
  saveScheduledSessions(scheduledSessions);
};

export const updateScheduledSession = (id: string, updates: Partial<ScheduledSession>): void => {
  const scheduledSessions = getScheduledSessions();
  const index = scheduledSessions.findIndex(ss => ss.id === id);
  if (index !== -1) {
    scheduledSessions[index] = { ...scheduledSessions[index], ...updates, dateUpdated: new Date().toISOString() };
    saveScheduledSessions(scheduledSessions);
  }
};

export const deleteScheduledSession = (id: string): void => {
  const scheduledSessions = getScheduledSessions();
  const filtered = scheduledSessions.filter(ss => ss.id !== id);
  saveScheduledSessions(filtered);
};

export const importData = (jsonString: string): void => {
  try {
    const data = JSON.parse(jsonString);
    if (data.students) saveStudents(data.students);
    if (data.goals) saveGoals(data.goals);
    if (data.sessions) saveSessions(data.sessions);
    if (data.activities) saveActivities(data.activities);
    if (data.evaluations) saveEvaluations(data.evaluations);
    if (data.schools) saveSchools(data.schools);
    if (data.scheduledSessions) saveScheduledSessions(data.scheduledSessions);
  } catch (error) {
    throw new Error('Invalid JSON data');
  }
};

