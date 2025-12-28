import { useCallback } from 'react';
import type { Goal } from '../types';

interface UseGoalSubtreeHandlerParams {
  startCopySubtree: (goal: Goal) => void;
  openDialog: () => void;
}

export const useGoalSubtreeHandler = ({
  startCopySubtree,
  openDialog,
}: UseGoalSubtreeHandlerParams) => {
  const handleCopySubtree = useCallback((goal: Goal) => {
    startCopySubtree(goal);
    openDialog();
  }, [startCopySubtree, openDialog]);

  return { handleCopySubtree };
};

