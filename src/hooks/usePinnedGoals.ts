import { useState, useEffect } from 'react';

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
      console.error('Failed to load pinned goals:', error);
    }
  }, []);

  // Save to localStorage whenever it changes
  useEffect(() => {
    try {
      const ids = Array.from(pinnedGoalIds);
      localStorage.setItem(PINNED_GOALS_KEY, JSON.stringify(ids));
    } catch (error) {
      console.error('Failed to save pinned goals:', error);
    }
  }, [pinnedGoalIds]);

  const togglePin = (goalId: string) => {
    setPinnedGoalIds(prev => {
      const next = new Set(prev);
      if (next.has(goalId)) {
        next.delete(goalId);
      } else {
        next.add(goalId);
      }
      return next;
    });
  };

  const clearPinned = () => {
    setPinnedGoalIds(new Set());
  };

  return {
    pinnedGoalIds,
    togglePin,
    clearPinned,
  };
};

