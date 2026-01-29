/**
 * React Query hooks for data fetching
 * 
 * These hooks provide automatic caching, deduplication, and refetching
 * for common data fetching operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Student, Teacher, CaseManager, Goal } from '../types';
import {
  getStudents,
  getTeachers,
  getCaseManagers,
  getGoalsByStudent,
  addStudent,
  updateStudent,
  deleteStudent,
  addTeacher,
  updateTeacher,
  deleteTeacher,
  addCaseManager,
  updateCaseManager,
  deleteCaseManager,
} from '../utils/storage-api';
import { logError, logWarn } from '../utils/logger';

/**
 * Query key factory for consistent query key generation
 */
export const queryKeys = {
  students: {
    all: ['students'] as const,
    bySchool: (school?: string) => ['students', 'school', school] as const,
    byId: (id: string) => ['students', id] as const,
  },
  teachers: {
    all: ['teachers'] as const,
    bySchool: (school?: string) => ['teachers', 'school', school] as const,
  },
  caseManagers: {
    all: ['caseManagers'] as const,
    bySchool: (school?: string) => ['caseManagers', 'school', school] as const,
  },
  goals: {
    all: ['goals'] as const,
    byStudent: (studentId: string, school?: string) => ['goals', 'student', studentId, school] as const,
  },
};

/**
 * Hook to fetch students for a school
 * Automatically caches, deduplicates, and refetches when needed
 */
export function useStudents(school?: string) {
  return useQuery({
    queryKey: queryKeys.students.bySchool(school),
    queryFn: async () => {
      if (!school) {
        logWarn('No school selected, cannot load students');
        return [];
      }
      
      try {
        // First, check if ANY students exist (without school filter)
        const allStudentsUnfiltered = await getStudents();
        
        // Then filter by school
        const allStudents = await getStudents(school);
        
        // If no students found for this school but students exist, show a warning
        if (process.env.NODE_ENV === 'development' && allStudents.length === 0 && allStudentsUnfiltered.length > 0) {
          logWarn('⚠️ Students exist but none match the selected school!', {
            selectedSchool: school,
            availableSchools: [...new Set(allStudentsUnfiltered.map(s => s.school || 'NO SCHOOL'))]
          });
        }
        
        // Deduplicate students by ID to prevent duplicate key warnings
        const uniqueStudents = Array.from(
          new Map(allStudents.map(student => [student.id, student])).values()
        );
        
        // Sort alphabetically by first name
        const sortedStudents = [...uniqueStudents].sort((a, b) => {
          const firstNameA = a.name.split(' ')[0].toLowerCase();
          const firstNameB = b.name.split(' ')[0].toLowerCase();
          return firstNameA.localeCompare(firstNameB);
        });
        
        return sortedStudents;
      } catch (error) {
        logError('Failed to load students', error);
        throw error;
      }
    },
    enabled: !!school, // Only run query if school is provided
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });
}

/**
 * Hook to fetch teachers for a school
 */
export function useTeachers(school?: string) {
  return useQuery({
    queryKey: queryKeys.teachers.bySchool(school),
    queryFn: async () => {
      if (!school) {
        return [];
      }
      
      try {
        const allTeachers = await getTeachers(school);
        // Deduplicate teachers by ID to prevent duplicate key warnings
        const uniqueTeachers = Array.from(
          new Map(allTeachers.map(teacher => [teacher.id, teacher])).values()
        );
        // Sort alphabetically by name
        return [...uniqueTeachers].sort((a, b) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
      } catch (error) {
        logError('Failed to load teachers', error);
        throw error;
      }
    },
    enabled: !!school,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch case managers for a school
 */
export function useCaseManagers(school?: string) {
  return useQuery({
    queryKey: queryKeys.caseManagers.bySchool(school),
    queryFn: async () => {
      if (!school) {
        return [];
      }
      
      try {
        const allCaseManagers = await getCaseManagers(school);
        // Deduplicate case managers by ID to prevent duplicate key warnings
        const uniqueCaseManagers = Array.from(
          new Map(allCaseManagers.map(caseManager => [caseManager.id, caseManager])).values()
        );
        // Sort alphabetically by name
        return [...uniqueCaseManagers].sort((a, b) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
      } catch (error) {
        logError('Failed to load case managers', error);
        throw error;
      }
    },
    enabled: !!school,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch students with no goals
 * This is a derived query that depends on students and goals
 */
export function useStudentsWithNoGoals(school?: string) {
  const { data: students = [] } = useStudents(school);
  
  return useQuery({
    queryKey: ['studentsWithNoGoals', school, students.map(s => s.id).join(',')],
    queryFn: async () => {
      if (!school || students.length === 0) {
        return new Set<string>();
      }
      
      const noGoalsSet = new Set<string>();
      for (const student of students) {
        try {
          const goals = await getGoalsByStudent(student.id, school);
          if (goals.length === 0) {
            noGoalsSet.add(student.id);
          }
        } catch (error) {
          logError(`Failed to check goals for student ${student.id}`, error);
        }
      }
      return noGoalsSet;
    },
    enabled: !!school && students.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mutation hook for creating a student (with optimistic update)
 */
export function useCreateStudent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (student: Student) => addStudent(student),
    onMutate: async (newStudent) => {
      const school = newStudent.school;
      if (!school) return;
      await queryClient.cancelQueries({ queryKey: queryKeys.students.bySchool(school) });
      const previousStudents = queryClient.getQueryData<Student[]>(queryKeys.students.bySchool(school));
      queryClient.setQueryData<Student[]>(queryKeys.students.bySchool(school), (old = []) => {
        const merged = [...old, newStudent];
        merged.sort((a, b) => a.name.split(' ')[0].toLowerCase().localeCompare(b.name.split(' ')[0].toLowerCase()));
        return merged;
      });
      return { previousStudents };
    },
    onError: (_err, _newStudent, context) => {
      if (context?.previousStudents !== undefined) {
        const school = _newStudent.school;
        if (school) {
          queryClient.setQueryData(queryKeys.students.bySchool(school), context.previousStudents);
        }
      }
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
      if (variables.school) {
        queryClient.invalidateQueries({ queryKey: queryKeys.students.bySchool(variables.school) });
      }
    },
  });
}

/**
 * Mutation hook for updating a student (with optimistic update)
 */
export function useUpdateStudent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Student> }) =>
      updateStudent(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.students.all });
      const previous: Array<{ queryKey: readonly unknown[]; data: Student[] }> = [];
      queryClient.getQueriesData<Student[]>({ queryKey: queryKeys.students.all }).forEach(([queryKey, data]) => {
        if (data && data.some(s => s.id === id)) {
          previous.push({ queryKey, data: [...data] });
          const updated = data.map(s => s.id === id ? { ...s, ...updates } : s);
          queryClient.setQueryData(queryKey, updated);
        }
      });
      return { previous };
    },
    onError: (_err, _variables, context) => {
      context?.previous?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.students.byId(variables.id) });
    },
  });
}

/**
 * Mutation hook for deleting a student (with optimistic update)
 */
export function useDeleteStudent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteStudent(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.students.all });
      const previous: Array<{ queryKey: readonly unknown[]; data: Student[] }> = [];
      queryClient.getQueriesData<Student[]>({ queryKey: queryKeys.students.all }).forEach(([queryKey, data]) => {
        if (data && data.some(s => s.id === id)) {
          previous.push({ queryKey, data: [...data] });
          queryClient.setQueryData(queryKey, data.filter(s => s.id !== id));
        }
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      context?.previous?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
    },
  });
}

/**
 * Mutation hook for creating a teacher
 */
export function useCreateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (teacher: Teacher) => addTeacher(teacher),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all });
      if (variables.school) {
        queryClient.invalidateQueries({ queryKey: queryKeys.teachers.bySchool(variables.school) });
      }
    },
  });
}

/**
 * Mutation hook for updating a teacher
 */
export function useUpdateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Teacher> }) =>
      updateTeacher(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all });
    },
  });
}

/**
 * Mutation hook for deleting a teacher
 */
export function useDeleteTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTeacher(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all });
    },
  });
}

/**
 * Mutation hook for creating a case manager
 */
export function useCreateCaseManager() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (caseManager: CaseManager) => addCaseManager(caseManager),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.caseManagers.all });
      if (variables.school) {
        queryClient.invalidateQueries({ queryKey: queryKeys.caseManagers.bySchool(variables.school) });
      }
    },
  });
}

/**
 * Mutation hook for updating a case manager
 */
export function useUpdateCaseManager() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CaseManager> }) =>
      updateCaseManager(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.caseManagers.all });
    },
  });
}

/**
 * Mutation hook for deleting a case manager
 */
export function useDeleteCaseManager() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCaseManager(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.caseManagers.all });
    },
  });
}
