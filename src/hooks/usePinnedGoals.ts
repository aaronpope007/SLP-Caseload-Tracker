import { useState, useEffect, useCallback } from 'react';
import { logError } from '../utils/logger';

const PINNED_GOALS_KEY = 'slp-pinned-goals';

export const usePinnedGoals = () => {
  const [pinnedGoalIds, setPinnedGoalIds] = useState<Set<string>>(new Set());

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PINNED_GOALS_KEY);
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        setPinnedGoalIds(new Set(ids));
      }
    } catch (error) {
      logError('Failed to load pinned goals', error);
    }
  }, []);

  // Save to localStorage whenever it changes
  useEffect(() => {
    try {
      const ids = Array.from(pinnedGoalIds);
      localStorage.setItem(PINNED_GOALS_KEY, JSON.stringify(ids));
    } catch (error) {
      logError('Failed to save pinned goals', error);
    }
  }, [pinnedGoalIds]);

  const togglePin = useCallback((goalId: string) => {
    setPinnedGoalIds(prev => {
      const next = new Set(prev);
      if (next.has(goalId)) {
        next.delete(goalId);
      } else {
        next.add(goalId);
      }
      return next;
    });
  }, []);

  const clearPinned = useCallback(() => {
    setPinnedGoalIds(new Set());
  }, []);

  return {
    pinnedGoalIds,
    togglePin,
    clearPinned,
  };
};

