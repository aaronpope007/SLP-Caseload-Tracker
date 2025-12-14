export interface Student {
  id: string;
  name: string;
  age: number;
  grade: string;
  concerns: string[];
  status: 'active' | 'discharged';
  dateAdded: string;
  archived?: boolean; // Optional for backward compatibility
  dateArchived?: string;
}

export interface Goal {
  id: string;
  studentId: string;
  description: string;
  baseline: string;
  target: string;
  status: 'in-progress' | 'achieved' | 'modified';
  dateCreated: string;
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
