export interface School {
  id: string;
  name: string;
  state: string; // US state abbreviation (e.g., 'NC', 'NY', 'CA')
  teletherapy: boolean; // Teletherapy role
  dateCreated: string;
}

export interface Student {
  id: string;
  name: string;
  age: number;
  grade: string;
  concerns: string[];
  exceptionality?: string[]; // Optional for backward compatibility
  status: 'active' | 'discharged';
  dateAdded: string;
  archived?: boolean; // Optional for backward compatibility
  dateArchived?: string;
  school: string; // School name the student belongs to
}

export interface Goal {
  id: string;
  studentId: string;
  description: string;
  baseline: string;
  target: string;
  status: 'in-progress' | 'achieved' | 'modified';
  dateCreated: string;
  // Goal management enhancements
  parentGoalId?: string; // For sub-goals
  subGoalIds?: string[]; // IDs of sub-goals
  domain?: string; // e.g., 'Articulation', 'Language', 'Pragmatics', 'Fluency'
  priority?: 'high' | 'medium' | 'low';
  templateId?: string; // Reference to goal template used
}

export interface GoalTemplate {
  id: string;
  title: string;
  description: string;
  domain: string;
  suggestedBaseline?: string;
  suggestedTarget?: string;
  ageRange?: string;
  keywords?: string[]; // For matching concerns
}

export interface Session {
  id: string;
  studentId: string;
  date: string; // Start time
  endTime?: string; // End time
  goalsTargeted: string[]; // Goal IDs
  activitiesUsed: string[];
  performanceData: {
    goalId: string;
    accuracy?: number;
    correctTrials?: number;
    incorrectTrials?: number;
    notes?: string;
  }[];
  notes: string;
  isDirectServices?: boolean; // true for Direct Services, false for Indirect Services
  indirectServicesNotes?: string; // Notes for indirect services
  groupSessionId?: string; // ID to link related sessions (for group sessions)
  missedSession?: boolean; // true if this was a missed session (only for Direct Services)
}

export interface Activity {
  id: string;
  description: string;
  goalArea: string;
  ageRange: string;
  materials: string[];
  isFavorite: boolean;
  source: 'AI' | 'manual';
  dateCreated: string;
}

export interface Evaluation {
  id: string;
  studentId: string;
  grade: string;
  evaluationType: string; // e.g., "Initial", "3-year", "Adding Academic"
  areasOfConcern: string; // Comma-separated or single value
  teacher?: string;
  resultsOfScreening?: string;
  dueDate?: string;
  assessments?: string;
  qualify?: string; // e.g., "qualified", "did not qualify"
  reportCompleted?: string; // e.g., "yes", "no"
  iepCompleted?: string; // e.g., "yes", "no", "n/a"
  meetingDate?: string;
  dateCreated: string;
  dateUpdated: string;
}
