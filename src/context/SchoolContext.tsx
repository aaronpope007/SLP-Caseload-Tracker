import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onStorageChange } from '../utils/storageSync';

const SCHOOL_STORAGE_KEY = 'slp_selected_school';
const DEFAULT_SCHOOL = 'Noble Academy';

interface SchoolContextType {
  selectedSchool: string;
  setSelectedSchool: (school: string) => void;
  availableSchools: string[];
  addSchool: (school: string) => void;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider = ({ children }: { children: ReactNode }) => {
  const [selectedSchool, setSelectedSchoolState] = useState<string>(DEFAULT_SCHOOL);
  const [availableSchools, setAvailableSchools] = useState<string[]>([DEFAULT_SCHOOL]);

  // Get available schools from all students
  const refreshAvailableSchools = useCallback(() => {
    try {
      const students = JSON.parse(localStorage.getItem('slp_students') || '[]');
      const schools = new Set<string>();
      students.forEach((student: any) => {
        if (student.school) {
          schools.add(student.school);
        }
      });
      // Always include the default school
      schools.add(DEFAULT_SCHOOL);
      const sorted = Array.from(schools).sort();
      setAvailableSchools(sorted);
    } catch {
      setAvailableSchools([DEFAULT_SCHOOL]);
    }
  }, []);

  // Load selected school from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(SCHOOL_STORAGE_KEY);
    if (saved) {
      setSelectedSchoolState(saved);
    } else {
      // Set default school if none is selected
      localStorage.setItem(SCHOOL_STORAGE_KEY, DEFAULT_SCHOOL);
      setSelectedSchoolState(DEFAULT_SCHOOL);
    }
    refreshAvailableSchools();
  }, [refreshAvailableSchools]);

  // Listen for storage changes to refresh available schools
  useEffect(() => {
    const unsubscribe = onStorageChange(() => {
      refreshAvailableSchools();
    });
    return unsubscribe;
  }, [refreshAvailableSchools]);

  const setSelectedSchool = (school: string) => {
    setSelectedSchoolState(school);
    localStorage.setItem(SCHOOL_STORAGE_KEY, school);
  };

  const addSchool = (school: string) => {
    // School will be added automatically when a student with that school is created
    // This function is here for future extensibility
    setSelectedSchool(school);
  };

  return (
    <SchoolContext.Provider
      value={{
        selectedSchool,
        setSelectedSchool,
        availableSchools,
        addSchool,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
};

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (context === undefined) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
};

