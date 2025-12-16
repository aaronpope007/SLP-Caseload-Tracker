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
  date: string;
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
