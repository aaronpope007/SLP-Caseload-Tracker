/**
 * API-based storage implementation
 * This replaces localStorage with API calls to the Express + SQLite backend
 */

import type { Student, Goal, Session, Activity, Evaluation, ArticulationScreener, School, Teacher, CaseManager, SOAPNote, ProgressReport, ProgressReportTemplate, DueDateItem, Meeting, Reminder, ScheduledSession, Todo } from '../types';
import { api } from './api';
import { logError, logDebug } from './logger';

const DEFAULT_SCHOOL = 'Noble Academy';

// Students
export const getStudents = async (school?: string): Promise<Student[]> => {
  try {
    const students = await api.students.getAll(school);
    return students;
  } catch (error) {
    logError('Failed to fetch students', error);
    return [];
  }
};

export const getStudentsByTeacher = async (teacherId: string): Promise<Student[]> => {
  try {
    const students = await api.students.getAll(undefined, teacherId);
    return students;
  } catch (error) {
    logError('Failed to fetch students by teacher', error);
    return [];
  }
};

export const getStudentsByCaseManager = async (caseManagerId: string): Promise<Student[]> => {
  try {
    const students = await api.students.getAll(undefined, undefined, caseManagerId);
    return students;
  } catch (error) {
    logError('Failed to fetch students by case manager', error);
    return [];
  }
};

export const saveStudents = async (students: Student[]): Promise<void> => {
  // Note: This is a bulk operation - you may want to implement a bulk endpoint
  // For now, we'll update/create each student individually
  for (const student of students) {
    try {
      await api.students.update(student.id, student);
    } catch {
      // If update fails, try creating
      try {
        await api.students.create(student);
      } catch (error) {
        logError(`Failed to save student ${student.id}`, error);
      }
    }
  }
};

export const addStudent = async (student: Student): Promise<void> => {
  await api.students.create(student);
};

export const updateStudent = async (id: string, updates: Partial<Student>): Promise<void> => {
  await api.students.update(id, updates);
};

export const deleteStudent = async (id: string): Promise<void> => {
  await api.students.delete(id);
};

// Goals
export const getGoals = async (): Promise<Goal[]> => {
  try {
    return await api.goals.getAll();
  } catch (error) {
    logError('Failed to fetch goals', error);
    return [];
  }
};

export const getGoalsByStudent = async (studentId: string, school?: string): Promise<Goal[]> => {
  try {
    return await api.goals.getAll(studentId, school);
  } catch (error) {
    logError('Failed to fetch goals', error);
    return [];
  }
};

export const getGoalsBySchool = async (school: string): Promise<Goal[]> => {
  try {
    return await api.goals.getAll(undefined, school);
  } catch (error) {
    logError('Failed to fetch goals', error);
    return [];
  }
};

export const saveGoals = async (goals: Goal[]): Promise<void> => {
  for (const goal of goals) {
    try {
      await api.goals.update(goal.id, goal);
    } catch {
      try {
        await api.goals.create(goal);
      } catch (error) {
        logError(`Failed to save goal ${goal.id}`, error);
      }
    }
  }
};

export const addGoal = async (goal: Omit<Goal, 'id' | 'dateCreated'>): Promise<string> => {
  const response = await api.goals.create(goal);
  return response.id;
};

export const updateGoal = async (id: string, updates: Partial<Goal>): Promise<void> => {
  await api.goals.update(id, updates);
};

export const deleteGoal = async (id: string): Promise<void> => {
  await api.goals.delete(id);
};

// Sessions
export const getSessions = async (studentId?: string, school?: string): Promise<Session[]> => {
  try {
    return await api.sessions.getAll(studentId, school);
  } catch (error) {
    logError('Failed to fetch sessions', error);
    return [];
  }
};

export const getSessionsByStudent = async (studentId: string, school?: string): Promise<Session[]> => {
  try {
    return await api.sessions.getAll(studentId, school);
  } catch (error) {
    logError('Failed to fetch sessions', error);
    return [];
  }
};

export const getSessionsBySchool = async (school: string): Promise<Session[]> => {
  try {
    return await api.sessions.getAll(undefined, school);
  } catch (error) {
    logError('Failed to fetch sessions', error);
    return [];
  }
};

export const saveSessions = async (sessions: Session[]): Promise<void> => {
  for (const session of sessions) {
    try {
      await api.sessions.update(session.id, session);
    } catch {
      try {
        await api.sessions.create(session);
      } catch (error) {
        logError(`Failed to save session ${session.id}`, error);
      }
    }
  }
};

export const addSession = async (session: Session): Promise<void> => {
  await api.sessions.create(session);
};

export const updateSession = async (id: string, updates: Partial<Session>): Promise<void> => {
  await api.sessions.update(id, updates);
};

export const deleteSession = async (id: string): Promise<void> => {
  await api.sessions.delete(id);
};

// Activities
export const getActivities = async (): Promise<Activity[]> => {
  try {
    return await api.activities.getAll();
  } catch (error) {
    logError('Failed to fetch activities', error);
    return [];
  }
};

export const saveActivities = async (activities: Activity[]): Promise<void> => {
  for (const activity of activities) {
    try {
      await api.activities.update(activity.id, activity);
    } catch {
      try {
        await api.activities.create(activity);
      } catch (error) {
        logError(`Failed to save activity ${activity.id}`, error);
      }
    }
  }
};

export const addActivity = async (activity: Activity): Promise<void> => {
  await api.activities.create(activity);
};

export const updateActivity = async (id: string, updates: Partial<Activity>): Promise<void> => {
  await api.activities.update(id, updates);
};

export const deleteActivity = async (id: string): Promise<void> => {
  await api.activities.delete(id);
};

// Evaluations
export const getEvaluations = async (school?: string): Promise<Evaluation[]> => {
  try {
    return await api.evaluations.getAll(undefined, school);
  } catch (error) {
    logError('Failed to fetch evaluations', error);
    return [];
  }
};

export const getEvaluationsByStudent = async (studentId: string): Promise<Evaluation[]> => {
  try {
    return await api.evaluations.getAll(studentId);
  } catch (error) {
    logError('Failed to fetch evaluations', error);
    return [];
  }
};

export const saveEvaluations = async (evaluations: Evaluation[]): Promise<void> => {
  for (const evaluation of evaluations) {
    try {
      await api.evaluations.update(evaluation.id, evaluation);
    } catch {
      try {
        await api.evaluations.create(evaluation);
      } catch (error) {
        logError(`Failed to save evaluation ${evaluation.id}`, error);
      }
    }
  }
};

export const addEvaluation = async (evaluation: Evaluation): Promise<void> => {
  await api.evaluations.create(evaluation);
};

export const updateEvaluation = async (id: string, updates: Partial<Evaluation>): Promise<void> => {
  await api.evaluations.update(id, updates);
};

export const deleteEvaluation = async (id: string): Promise<void> => {
  await api.evaluations.delete(id);
};

// Articulation Screeners
export const getArticulationScreeners = async (school?: string): Promise<ArticulationScreener[]> => {
  try {
    return await api.articulationScreeners.getAll(undefined, school);
  } catch (error) {
    logError('Failed to fetch articulation screeners', error);
    return [];
  }
};

export const getArticulationScreenersByStudent = async (studentId: string): Promise<ArticulationScreener[]> => {
  try {
    return await api.articulationScreeners.getAll(studentId);
  } catch (error) {
    logError('Failed to fetch articulation screeners', error);
    return [];
  }
};

export const getArticulationScreenerById = async (id: string): Promise<ArticulationScreener | null> => {
  try {
    return await api.articulationScreeners.getById(id);
  } catch (error) {
    logError('Failed to fetch articulation screener', error);
    return null;
  }
};

export const addArticulationScreener = async (screener: ArticulationScreener): Promise<void> => {
  await api.articulationScreeners.create(screener);
};

export const updateArticulationScreener = async (id: string, updates: Partial<ArticulationScreener>): Promise<void> => {
  await api.articulationScreeners.update(id, updates);
};

export const deleteArticulationScreener = async (id: string): Promise<void> => {
  await api.articulationScreeners.delete(id);
};

// Schools
export const getSchools = async (): Promise<School[]> => {
  try {
    const schools = await api.schools.getAll();
    logDebug('Fetched schools', { count: schools.length });
    return schools;
  } catch (error) {
    logError('Failed to fetch schools', error);
    return [];
  }
};

export const saveSchools = async (schools: School[]): Promise<void> => {
  for (const school of schools) {
    try {
      await api.schools.update(school.id, school);
    } catch {
      try {
        await api.schools.create(school);
      } catch (error) {
        logError(`Failed to save school ${school.id}`, error);
      }
    }
  }
};

export const addSchool = async (school: School): Promise<void> => {
  await api.schools.create(school);
};

export const updateSchool = async (id: string, updates: Partial<School>): Promise<void> => {
  await api.schools.update(id, updates);
};

export const deleteSchool = async (id: string): Promise<void> => {
  await api.schools.delete(id);
};

export const getSchoolByName = async (name: string): Promise<School | undefined> => {
  try {
    return await api.schools.getByName(name);
  } catch {
    return undefined;
  }
};

// Teachers
export const getTeachers = async (school?: string): Promise<Teacher[]> => {
  try {
    return await api.teachers.getAll(school);
  } catch (error) {
    logError('Failed to fetch teachers', error);
    return [];
  }
};

export const saveTeachers = async (teachers: Teacher[]): Promise<void> => {
  for (const teacher of teachers) {
    try {
      await api.teachers.update(teacher.id, teacher);
    } catch {
      try {
        await api.teachers.create(teacher);
      } catch (error) {
        logError(`Failed to save teacher ${teacher.id}`, error);
      }
    }
  }
};

export const addTeacher = async (teacher: Teacher): Promise<void> => {
  await api.teachers.create(teacher);
};

export const updateTeacher = async (id: string, updates: Partial<Teacher>): Promise<void> => {
  await api.teachers.update(id, updates);
};

export const deleteTeacher = async (id: string): Promise<void> => {
  await api.teachers.delete(id);
};

// Case Managers
export const getCaseManagers = async (school?: string): Promise<CaseManager[]> => {
  try {
    return await api.caseManagers.getAll(school);
  } catch (error) {
    logError('Failed to fetch case managers', error);
    return [];
  }
};

export const saveCaseManagers = async (caseManagers: CaseManager[]): Promise<void> => {
  for (const caseManager of caseManagers) {
    try {
      await api.caseManagers.update(caseManager.id, caseManager);
    } catch {
      try {
        await api.caseManagers.create(caseManager);
      } catch (error) {
        logError(`Failed to save case manager ${caseManager.id}`, error);
      }
    }
  }
};

export const addCaseManager = async (caseManager: CaseManager): Promise<void> => {
  try {
    // The API expects the full object including id and dateCreated
    await api.caseManagers.create(caseManager);
  } catch (error) {
    logError('[storage-api] Error adding case manager', error);
    throw error;
  }
};

export const updateCaseManager = async (id: string, updates: Partial<CaseManager>): Promise<void> => {
  await api.caseManagers.update(id, updates);
};

export const deleteCaseManager = async (id: string): Promise<void> => {
  await api.caseManagers.delete(id);
};

// Export/Import
export const exportData = async (): Promise<string> => {
  try {
    const data = await api.export.getAll();
    return JSON.stringify(data, null, 2);
  } catch (error) {
    logError('Failed to export data', error);
    throw error;
  }
};

export const importData = async (jsonString: string): Promise<void> => {
  // Note: You'll need to implement a bulk import endpoint for this
  // For now, this is a placeholder
  try {
    const data = JSON.parse(jsonString);
    
    if (data.schools) {
      for (const school of data.schools) {
        await addSchool(school);
      }
    }
    if (data.teachers) {
      for (const teacher of data.teachers) {
        await addTeacher(teacher);
      }
    }
    if (data.students) {
      for (const student of data.students) {
        await addStudent(student);
      }
    }
    if (data.goals) {
      for (const goal of data.goals) {
        // Strip id and dateCreated to let API generate new ones
        const { id, dateCreated, ...goalWithoutId } = goal;
        await addGoal(goalWithoutId);
      }
    }
    if (data.sessions) {
      for (const session of data.sessions) {
        await addSession(session);
      }
    }
    if (data.activities) {
      for (const activity of data.activities) {
        await addActivity(activity);
      }
    }
    if (data.evaluations) {
      for (const evaluation of data.evaluations) {
        await addEvaluation(evaluation);
      }
    }
  } catch (error) {
    throw new Error('Invalid JSON data');
  }
};

// SOAP Notes
export const getSOAPNotes = async (): Promise<SOAPNote[]> => {
  try {
    return await api.soapNotes.getAll();
  } catch (error) {
    logError('Failed to fetch SOAP notes', error);
    return [];
  }
};

export const getSOAPNotesBySession = async (sessionId: string): Promise<SOAPNote[]> => {
  try {
    return await api.soapNotes.getAll(undefined, sessionId);
  } catch (error) {
    logError('Failed to fetch SOAP notes by session', error);
    return [];
  }
};

export const getSOAPNotesByStudent = async (studentId: string): Promise<SOAPNote[]> => {
  try {
    return await api.soapNotes.getAll(studentId);
  } catch (error) {
    logError('Failed to fetch SOAP notes by student', error);
    return [];
  }
};

export const getSOAPNote = async (id: string): Promise<SOAPNote | undefined> => {
  try {
    return await api.soapNotes.getById(id);
  } catch (error) {
    logError('Failed to fetch SOAP note', error);
    return undefined;
  }
};

export const addSOAPNote = async (soapNote: SOAPNote): Promise<void> => {
  await api.soapNotes.create(soapNote);
};

export const updateSOAPNote = async (id: string, updates: Partial<SOAPNote>): Promise<void> => {
  await api.soapNotes.update(id, updates);
};

export const deleteSOAPNote = async (id: string): Promise<void> => {
  await api.soapNotes.delete(id);
};

// Progress Reports
export const getProgressReports = async (studentId?: string, school?: string, status?: string, startDate?: string, endDate?: string): Promise<ProgressReport[]> => {
  try {
    return await api.progressReports.getAll(studentId, school, status, startDate, endDate);
  } catch (error) {
    logError('Failed to fetch progress reports', error);
    return [];
  }
};

export const getUpcomingProgressReports = async (days?: number, school?: string): Promise<ProgressReport[]> => {
  try {
    return await api.progressReports.getUpcoming(days, school);
  } catch (error) {
    logError('Failed to fetch upcoming progress reports', error);
    return [];
  }
};

export const getProgressReport = async (id: string): Promise<ProgressReport | undefined> => {
  try {
    return await api.progressReports.getById(id);
  } catch (error) {
    logError('Failed to fetch progress report', error);
    return undefined;
  }
};

export const addProgressReport = async (report: ProgressReport): Promise<void> => {
  await api.progressReports.create(report);
};

export const updateProgressReport = async (id: string, updates: Partial<ProgressReport>): Promise<void> => {
  await api.progressReports.update(id, updates);
};

export const deleteProgressReport = async (id: string): Promise<void> => {
  await api.progressReports.delete(id);
};

export const scheduleProgressReports = async (studentId?: string, school?: string): Promise<ProgressReport[]> => {
  try {
    const result = await api.progressReports.scheduleAuto(studentId, school);
    return result.reports;
  } catch (error) {
    logError('Failed to schedule progress reports', error);
    return [];
  }
};

export const completeProgressReport = async (id: string): Promise<void> => {
  await api.progressReports.complete(id);
};

// Progress Report Templates
export const getProgressReportTemplates = async (reportType?: 'quarterly' | 'annual'): Promise<ProgressReportTemplate[]> => {
  try {
    return await api.progressReportTemplates.getAll(reportType);
  } catch (error) {
    logError('Failed to fetch progress report templates', error);
    return [];
  }
};

export const getProgressReportTemplate = async (id: string): Promise<ProgressReportTemplate | undefined> => {
  try {
    return await api.progressReportTemplates.getById(id);
  } catch (error) {
    logError('Failed to fetch progress report template', error);
    return undefined;
  }
};

export const addProgressReportTemplate = async (template: Omit<ProgressReportTemplate, 'id' | 'dateCreated' | 'dateUpdated'>): Promise<void> => {
  await api.progressReportTemplates.create(template);
};

export const updateProgressReportTemplate = async (id: string, updates: Partial<ProgressReportTemplate>): Promise<void> => {
  await api.progressReportTemplates.update(id, updates);
};

export const deleteProgressReportTemplate = async (id: string): Promise<void> => {
  await api.progressReportTemplates.delete(id);
};

export const setDefaultProgressReportTemplate = async (id: string): Promise<void> => {
  await api.progressReportTemplates.setDefault(id);
};

// Due Date Items
export const getDueDateItems = async (studentId?: string, status?: string, category?: string, startDate?: string, endDate?: string, school?: string): Promise<DueDateItem[]> => {
  try {
    return await api.dueDateItems.getAll(studentId, status, category, startDate, endDate, school);
  } catch (error) {
    logError('Failed to fetch due date items', error);
    return [];
  }
};

export const getUpcomingDueDateItems = async (days?: number, school?: string): Promise<DueDateItem[]> => {
  try {
    return await api.dueDateItems.getUpcoming(days, school);
  } catch (error) {
    logError('Failed to fetch upcoming due date items', error);
    return [];
  }
};

export const getDueDateItem = async (id: string): Promise<DueDateItem | undefined> => {
  try {
    return await api.dueDateItems.getById(id);
  } catch (error) {
    logError('Failed to fetch due date item', error);
    return undefined;
  }
};

export const addDueDateItem = async (item: Omit<DueDateItem, 'id' | 'dateCreated' | 'dateUpdated'>): Promise<void> => {
  await api.dueDateItems.create(item);
};

export const updateDueDateItem = async (id: string, updates: Partial<DueDateItem>): Promise<void> => {
  await api.dueDateItems.update(id, updates);
};

export const deleteDueDateItem = async (id: string): Promise<void> => {
  await api.dueDateItems.delete(id);
};

export const completeDueDateItem = async (id: string): Promise<void> => {
  await api.dueDateItems.complete(id);
};

// Meetings
export const getMeetings = async (studentId?: string, school?: string, category?: string, startDate?: string, endDate?: string): Promise<Meeting[]> => {
  try {
    return await api.meetings.getAll(studentId, school, category, startDate, endDate);
  } catch (error) {
    logError('Failed to fetch meetings', error);
    return [];
  }
};

export const getMeeting = async (id: string): Promise<Meeting | undefined> => {
  try {
    return await api.meetings.getById(id);
  } catch (error) {
    logError('Failed to fetch meeting', error);
    return undefined;
  }
};

export const createMeeting = async (meeting: Omit<Meeting, 'id' | 'dateCreated' | 'dateUpdated'>): Promise<string> => {
  const response = await api.meetings.create(meeting);
  return response.id;
};

export const updateMeeting = async (id: string, updates: Partial<Meeting>): Promise<void> => {
  await api.meetings.update(id, updates);
};

export const deleteMeeting = async (id: string): Promise<void> => {
  await api.meetings.delete(id);
};

// Reminders
export const getReminders = async (school?: string): Promise<Reminder[]> => {
  try {
    return await api.reminders.getAll(school);
  } catch (error) {
    logError('Failed to fetch reminders', error);
    return [];
  }
};

export const dismissReminder = async (reminder: Reminder): Promise<void> => {
  try {
    // For frequency alerts, store the sessions behind count as dismissedState
    const dismissedState = reminder.type === 'frequency-alert' && reminder.daysUntilDue !== undefined
      ? String(Math.abs(reminder.daysUntilDue))
      : undefined;
    
    await api.reminders.dismiss(reminder.id, {
      type: reminder.type,
      studentId: reminder.studentId,
      relatedId: reminder.relatedId,
      dismissedState,
    });
  } catch (error) {
    logError('Failed to dismiss reminder', error);
    throw error;
  }
};

// Scheduled Sessions
export const getScheduledSessions = async (school?: string): Promise<ScheduledSession[]> => {
  try {
    return await api.scheduledSessions.getAll(school);
  } catch (error) {
    logError('Failed to fetch scheduled sessions', error);
    return [];
  }
};

export const getScheduledSession = async (id: string): Promise<ScheduledSession | undefined> => {
  try {
    return await api.scheduledSessions.getById(id);
  } catch (error) {
    logError('Failed to fetch scheduled session', error);
    return undefined;
  }
};

export const addScheduledSession = async (session: ScheduledSession): Promise<void> => {
  await api.scheduledSessions.create(session);
};

export const updateScheduledSession = async (id: string, updates: Partial<ScheduledSession>): Promise<void> => {
  await api.scheduledSessions.update(id, updates);
};

export const deleteScheduledSession = async (id: string): Promise<void> => {
  await api.scheduledSessions.delete(id);
};

// Todos
export const getTodos = async (): Promise<Todo[]> => {
  try {
    return await api.todos.getAll();
  } catch (error) {
    logError('Failed to fetch todos', error);
    return [];
  }
};

export const createTodo = async (todo: Omit<Todo, 'id' | 'dateCreated' | 'dateUpdated'>): Promise<string> => {
  const result = await api.todos.create(todo);
  return result.id;
};

export const updateTodo = async (id: string, updates: Partial<Todo>): Promise<void> => {
  await api.todos.update(id, updates);
};

export const toggleTodo = async (id: string): Promise<void> => {
  await api.todos.toggle(id);
};

export const deleteTodo = async (id: string): Promise<void> => {
  await api.todos.delete(id);
};

