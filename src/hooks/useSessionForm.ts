import { useState, useCallback, useRef } from 'react';
import type { Session } from '../types';
import { toLocalDateTimeString } from '../utils/helpers';

interface SessionFormData {
  studentIds: string[];
  date: string;
  endTime: string;
  goalsTargeted: string[];
  activitiesUsed: string[];
  performanceData: Array<{
    goalId: string;
    studentId: string;
    accuracy?: string;
    correctTrials?: number;
    incorrectTrials?: number;
    notes?: string;
    cuingLevels?: ('independent' | 'verbal' | 'visual' | 'tactile' | 'physical')[];
  }>;
  notes: string;
  isDirectServices: boolean;
  indirectServicesNotes: string;
  missedSession: boolean;
  selectedSubjectiveStatements: string[];
  customSubjective: string;
  plan: string;
}

const initialFormData: SessionFormData = {
  studentIds: [],
  date: toLocalDateTimeString(new Date()),
  endTime: '',
  goalsTargeted: [],
  activitiesUsed: [],
  performanceData: [],
  notes: '',
  isDirectServices: true,
  indirectServicesNotes: '',
  missedSession: false,
  selectedSubjectiveStatements: [],
  customSubjective: '',
  plan: '',
};

export const useSessionForm = () => {
  const [formData, setFormData] = useState<SessionFormData>(initialFormData);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editingGroupSessionId, setEditingGroupSessionId] = useState<string | null>(null);
  const initialFormDataRef = useRef<SessionFormData | null>(null);

  const initializeForm = useCallback((session?: Session, groupSessionId?: string | null) => {
    if (session) {
      const newFormData: SessionFormData = {
        studentIds: [session.studentId],
        date: toLocalDateTimeString(new Date(session.date)),
        endTime: session.endTime ? toLocalDateTimeString(new Date(session.endTime)) : '',
        goalsTargeted: session.goalsTargeted || [],
        activitiesUsed: session.activitiesUsed || [],
        performanceData: session.performanceData || [],
        notes: session.notes || '',
        isDirectServices: session.isDirectServices ?? true,
        indirectServicesNotes: session.indirectServicesNotes || '',
        missedSession: session.missedSession || false,
        selectedSubjectiveStatements: session.selectedSubjectiveStatements || [],
        customSubjective: session.customSubjective || '',
        plan: session.plan || '',
      };
      setFormData(newFormData);
      initialFormDataRef.current = { ...newFormData };
      setEditingSession(session);
      setEditingGroupSessionId(groupSessionId || null);
    } else {
      setFormData(initialFormData);
      initialFormDataRef.current = { ...initialFormData };
      setEditingSession(null);
      setEditingGroupSessionId(null);
    }
  }, []);

  const updateFormField = useCallback(<K extends keyof SessionFormData>(
    field: K,
    value: SessionFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    initialFormDataRef.current = null;
    setEditingSession(null);
    setEditingGroupSessionId(null);
  }, []);

  // Helper function to compare arrays efficiently
  const arraysEqual = (a: any[], b: any[]): boolean => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  };

  // Helper function to compare performance data arrays efficiently
  const performanceDataEqual = (a: SessionFormData['performanceData'], b: SessionFormData['performanceData']): boolean => {
    if (a.length !== b.length) return false;
    // Create a map for faster lookup
    const bMap = new Map(b.map(item => [`${item.goalId}-${item.studentId}`, item]));
    for (const aItem of a) {
      const key = `${aItem.goalId}-${aItem.studentId}`;
      const bItem = bMap.get(key);
      if (!bItem) return false;
      // Compare relevant fields
      if (aItem.accuracy !== bItem.accuracy ||
          aItem.correctTrials !== bItem.correctTrials ||
          aItem.incorrectTrials !== bItem.incorrectTrials ||
          aItem.notes !== bItem.notes ||
          !arraysEqual(aItem.cuingLevels || [], bItem.cuingLevels || [])) {
        return false;
      }
    }
    return true;
  };

  const isDirty = useCallback(() => {
    if (!initialFormDataRef.current) return false;
    const initial = initialFormDataRef.current;
    return (
      !arraysEqual(formData.studentIds, initial.studentIds) ||
      formData.date !== initial.date ||
      formData.endTime !== initial.endTime ||
      !arraysEqual(formData.goalsTargeted, initial.goalsTargeted) ||
      !arraysEqual(formData.activitiesUsed, initial.activitiesUsed) ||
      !performanceDataEqual(formData.performanceData, initial.performanceData) ||
      formData.notes !== initial.notes ||
      formData.isDirectServices !== initial.isDirectServices ||
      formData.indirectServicesNotes !== initial.indirectServicesNotes ||
      formData.missedSession !== initial.missedSession ||
      !arraysEqual(formData.selectedSubjectiveStatements, initial.selectedSubjectiveStatements) ||
      formData.customSubjective !== initial.customSubjective ||
      formData.plan !== initial.plan
    );
  }, [formData]);

  return {
    formData,
    editingSession,
    editingGroupSessionId,
    isDirty,
    initializeForm,
    updateFormField,
    resetForm,
    setFormData, // Allow direct updates if needed
    setEditingGroupSessionId,
  };
};

