import { useState, useCallback } from 'react';
import type { Goal } from '../types';

interface GoalFormData {
  description: string;
  baseline: string;
  target: string;
  status: 'in-progress' | 'achieved' | 'modified';
  domain: string;
  priority: 'high' | 'medium' | 'low';
  parentGoalId: string;
}

const initialFormData: GoalFormData = {
  description: '',
  baseline: '',
  target: '',
  status: 'in-progress',
  domain: '',
  priority: 'medium',
  parentGoalId: '',
};

export const useGoalForm = () => {
  const [formData, setFormData] = useState<GoalFormData>(initialFormData);
  const [initialFormDataState, setInitialFormDataState] = useState<GoalFormData>(initialFormData);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const initializeForm = useCallback((goal?: Goal, parentGoal?: Goal) => {
    if (goal) {
      const newFormData: GoalFormData = {
        description: goal.description,
        baseline: goal.baseline,
        target: goal.target,
        status: goal.status,
        domain: goal.domain || '',
        priority: goal.priority || 'medium',
        parentGoalId: goal.parentGoalId || '',
      };
      setFormData(newFormData);
      setInitialFormDataState(newFormData);
      setEditingGoal(goal);
    } else {
      // If creating a sub-goal, inherit domain, priority, and target from parent
      const inheritedDomain = parentGoal?.domain || '';
      const inheritedPriority = parentGoal?.priority || 'medium';
      const inheritedTarget = parentGoal?.target || '';
      
      const newFormData: GoalFormData = {
        description: '',
        baseline: '',
        target: inheritedTarget,
        status: 'in-progress',
        domain: inheritedDomain,
        priority: inheritedPriority,
        parentGoalId: parentGoal?.id || '',
      };
      setFormData(newFormData);
      setInitialFormDataState(newFormData);
      setEditingGoal(null);
    }
  }, []);

  const updateFormField = useCallback(<K extends keyof GoalFormData>(
    field: K,
    value: GoalFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setInitialFormDataState(initialFormData);
    setEditingGoal(null);
  }, []);

  const isDirty = useCallback(() => {
    return (
      formData.description !== initialFormDataState.description ||
      formData.baseline !== initialFormDataState.baseline ||
      formData.target !== initialFormDataState.target ||
      formData.status !== initialFormDataState.status ||
      formData.domain !== initialFormDataState.domain ||
      formData.priority !== initialFormDataState.priority ||
      formData.parentGoalId !== initialFormDataState.parentGoalId
    );
  }, [formData, initialFormDataState]);

  return {
    formData,
    editingGoal,
    isDirty,
    initializeForm,
    updateFormField,
    resetForm,
    setFormData, // Allow direct updates if needed
  };
};

