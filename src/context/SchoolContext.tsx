import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { getSchools, addSchool as addSchoolStorage, getSchoolByName, type School, getStudents } from '../utils/storage-api';
import { generateId } from '../utils/helpers';
import { logError } from '../utils/logger';

const SCHOOL_STORAGE_KEY = 'slp_selected_school';
const DEFAULT_SCHOOL_NAME = 'Noble Academy';

interface SchoolContextType {
  selectedSchool: string;
  setSelectedSchool: (school: string) => void;
  availableSchools: string[];
  schools: School[];
  addSchool: (name: string, state?: string, teletherapy?: boolean) => Promise<void>;
  getSchoolState: (schoolName: string) => Promise<string | undefined>;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider = ({ children }: { children: ReactNode }) => {
  const [selectedSchool, setSelectedSchoolState] = useState<string>(DEFAULT_SCHOOL_NAME);
  const [availableSchools, setAvailableSchools] = useState<string[]>([DEFAULT_SCHOOL_NAME]);
  const [schools, setSchools] = useState<School[]>([]);
  const isRefreshingRef = useRef(false);

  // Get available schools from School objects and students
  const refreshAvailableSchools = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isRefreshingRef.current) {
      return;
    }
    
    try {
      isRefreshingRef.current = true;
      const schoolNames = new Set<string>();
      
      // Add schools from School objects
      const schoolObjects = await getSchools();
      schoolObjects.forEach((school) => {
        if (school.name && school.name.trim()) {
          schoolNames.add(school.name.trim());
        }
      });
      setSchools(schoolObjects);
      
      // Add schools from students (for backward compatibility)
      const students = await getStudents();
      students.forEach((student) => {
        if (student.school && student.school.trim()) {
          schoolNames.add(student.school.trim());
        }
      });
      
      // Always include the default school
      schoolNames.add(DEFAULT_SCHOOL_NAME);
      
      // Ensure default school exists as a School object if it doesn't
      if (!schoolObjects.find(s => s.name === DEFAULT_SCHOOL_NAME)) {
        await addSchoolStorage({
          id: generateId(),
          name: DEFAULT_SCHOOL_NAME,
          state: '',
          teletherapy: false,
          dateCreated: new Date().toISOString(),
        });
      }
      
      const sorted = Array.from(schoolNames).sort();
      setAvailableSchools(sorted);
    } catch (error) {
      logError('Error refreshing available schools', error);
      // Don't clear schools on error, just keep existing state
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  // Load selected school from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(SCHOOL_STORAGE_KEY);
    if (saved) {
      setSelectedSchoolState(saved);
    } else {
      // Set default school if none is selected
      localStorage.setItem(SCHOOL_STORAGE_KEY, DEFAULT_SCHOOL_NAME);
      setSelectedSchoolState(DEFAULT_SCHOOL_NAME);
    }
    refreshAvailableSchools();
  }, [refreshAvailableSchools]);

  // Refresh schools periodically (since we don't have storage sync events with API)
  // Only refresh when tab is visible to save resources
  // Increased interval to 60 seconds and removed immediate refresh on visibility change to reduce API calls
  useEffect(() => {
    let interval: number | null = null;
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Clear interval when tab is hidden
        if (interval !== null) {
          clearInterval(interval);
          interval = null;
        }
      } else {
        // Resume interval when tab becomes visible (don't refresh immediately to avoid spam)
        interval = window.setInterval(() => {
          refreshAvailableSchools();
        }, 60000); // Refresh every 60 seconds (increased from 30 seconds)
      }
    };
    
    // Start interval if tab is visible
    if (!document.hidden) {
      interval = window.setInterval(() => {
        refreshAvailableSchools();
      }, 60000); // Refresh every 60 seconds
    }
    
    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (interval !== null) {
        clearInterval(interval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshAvailableSchools]);

  const setSelectedSchool = (school: string) => {
    setSelectedSchoolState(school);
    localStorage.setItem(SCHOOL_STORAGE_KEY, school);
  };

  const addSchool = async (name: string, state: string = '', teletherapy: boolean = false) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    
    try {
      // Check if school already exists
      const existingSchool = await getSchoolByName(trimmedName);
      if (existingSchool) {
        // School already exists, just select it
        setSelectedSchool(trimmedName);
        await refreshAvailableSchools();
        return;
      }
      
      // Create new School object
      const newSchool: School = {
        id: generateId(),
        name: trimmedName,
        state: state.trim(),
        teletherapy,
        dateCreated: new Date().toISOString(),
      };
      
      await addSchoolStorage(newSchool);
      
      // Refresh available schools and select the new school
      await refreshAvailableSchools();
      setSelectedSchool(trimmedName);
    } catch (error) {
      logError('Error adding school', error);
    }
  };

  const getSchoolState = async (schoolName: string): Promise<string | undefined> => {
    const school = await getSchoolByName(schoolName);
    return school?.state;
  };

  return (
    <SchoolContext.Provider
      value={{
        selectedSchool,
        setSelectedSchool,
        availableSchools,
        schools,
        addSchool,
        getSchoolState,
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

