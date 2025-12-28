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

  const isDirty = useCallback(() => {
    if (!initialFormDataRef.current) return false;
    const initial = initialFormDataRef.current;
    return (
      JSON.stringify(formData.studentIds) !== JSON.stringify(initial.studentIds) ||
      formData.date !== initial.date ||
      formData.endTime !== initial.endTime ||
      JSON.stringify(formData.goalsTargeted) !== JSON.stringify(initial.goalsTargeted) ||
      JSON.stringify(formData.activitiesUsed) !== JSON.stringify(initial.activitiesUsed) ||
      JSON.stringify(formData.performanceData) !== JSON.stringify(initial.performanceData) ||
      formData.notes !== initial.notes ||
      formData.isDirectServices !== initial.isDirectServices ||
      formData.indirectServicesNotes !== initial.indirectServicesNotes ||
      formData.missedSession !== initial.missedSession ||
      JSON.stringify(formData.selectedSubjectiveStatements) !== JSON.stringify(initial.selectedSubjectiveStatements) ||
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

