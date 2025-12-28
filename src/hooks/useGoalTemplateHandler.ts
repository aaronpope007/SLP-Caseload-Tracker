import { useCallback } from 'react';
import type { GoalTemplate } from '../types';

interface UseGoalTemplateHandlerParams {
  useTemplate: (template: GoalTemplate) => void;
  closeDialog: () => void;
}

export const useGoalTemplateHandler = ({
  useTemplate,
  closeDialog,
}: UseGoalTemplateHandlerParams) => {
  const handleUseTemplate = useCallback((template: GoalTemplate) => {
    useTemplate(template);
    closeDialog();
  }, [useTemplate, closeDialog]);

  return { handleUseTemplate };
};

