import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onStorageChange } from '../utils/storageSync';

const SCHOOL_STORAGE_KEY = 'slp_selected_school';
const SCHOOLS_LIST_KEY = 'slp_schools_list';
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

  // Get available schools from all students and stored schools list
  const refreshAvailableSchools = useCallback(() => {
    try {
      const schools = new Set<string>();
      
      // Add schools from stored list
      const storedSchools = JSON.parse(localStorage.getItem(SCHOOLS_LIST_KEY) || '[]');
      storedSchools.forEach((school: string) => {
        if (school && school.trim()) {
          schools.add(school.trim());
        }
      });
      
      // Add schools from students
      const students = JSON.parse(localStorage.getItem('slp_students') || '[]');
      students.forEach((student: any) => {
        if (student.school && student.school.trim()) {
          schools.add(student.school.trim());
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
    const trimmedSchool = school.trim();
    if (!trimmedSchool) return;
    
    try {
      // Get existing schools list
      const storedSchools = JSON.parse(localStorage.getItem(SCHOOLS_LIST_KEY) || '[]');
      
      // Add school if it doesn't exist
      if (!storedSchools.includes(trimmedSchool)) {
        const updated = [...storedSchools, trimmedSchool];
        localStorage.setItem(SCHOOLS_LIST_KEY, JSON.stringify(updated));
      }
      
      // Refresh available schools and select the new school
      refreshAvailableSchools();
      setSelectedSchool(trimmedSchool);
    } catch (error) {
      console.error('Error adding school:', error);
    }
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

