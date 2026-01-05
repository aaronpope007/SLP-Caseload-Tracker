import type { Goal } from '../types';

export interface GoalHierarchy {
  parentGoals: Goal[];
  subGoalsByParent: Map<string, Goal[]>;
  orphanGoals: Goal[];
}

/**
 * Organizes goals into parent/child hierarchy (supports multiple levels)
 * This function builds a flat map of sub-goals by parent, which can include
 * sub-sub goals nested under sub-goals
 */
export const organizeGoalsHierarchy = (goalsList: Goal[]): GoalHierarchy => {
  // Filter out any undefined/null goals first
  const validGoals = goalsList.filter(g => g != null);
  const parentGoals: Goal[] = [];
  const subGoalsByParent = new Map<string, Goal[]>();
  const orphanGoals: Goal[] = [];
  const goalIdsSet = new Set(validGoals.map(g => g.id));

  // First pass: identify all subgoals (at any level) and group them by parent
  validGoals.forEach(goal => {
    if (goal.parentGoalId) {
      // This is a subgoal (could be level 2 or level 3) - check if parent exists
      if (goalIdsSet.has(goal.parentGoalId)) {
        if (!subGoalsByParent.has(goal.parentGoalId)) {
          subGoalsByParent.set(goal.parentGoalId, []);
        }
        subGoalsByParent.get(goal.parentGoalId)!.push(goal);
      }
    }
  });

  // Second pass: identify top-level parent goals and orphan goals
  validGoals.forEach(goal => {
    if (goal.parentGoalId) {
      // This is a subgoal at some level, skip it (already handled)
      return;
    }
    
    // Check if this goal has subgoals in the current list
    const hasSubGoals = subGoalsByParent.has(goal.id) && subGoalsByParent.get(goal.id)!.length > 0;
    
    if (hasSubGoals) {
      // This is a top-level parent goal with active subgoals
      parentGoals.push(goal);
    } else {
      // This is a standalone goal (no parent, no subgoals)
      orphanGoals.push(goal);
    }
  });

  return {
    parentGoals,
    subGoalsByParent,
    orphanGoals,
  };
};

/**
 * Gets the depth level of a goal in the hierarchy
 * Returns 0 for top-level goals, 1 for sub-goals, 2 for sub-sub-goals, etc.
 */
export const getGoalDepth = (goal: Goal, goalsList: Goal[]): number => {
  if (!goal.parentGoalId) {
    return 0;
  }
  
  // Filter out undefined/null goals before searching
  const validGoals = goalsList.filter(g => g != null);
  const parent = validGoals.find(g => g.id === goal.parentGoalId);
  if (!parent) {
    return 0;
  }
  
  return 1 + getGoalDepth(parent, validGoals);
};

/**
 * Gets the full path of a goal in the hierarchy (for display purposes)
 * Returns an array of goal descriptions from top-level to the goal itself
 */
export const getGoalPath = (goal: Goal, goalsList: Goal[]): string[] => {
  const path: string[] = [goal.description];
  
  if (goal.parentGoalId) {
    // Filter out undefined/null goals before searching
    const validGoals = goalsList.filter(g => g != null);
    const parent = validGoals.find(g => g.id === goal.parentGoalId);
    if (parent) {
      return [...getGoalPath(parent, validGoals), ...path];
    }
  }
  
  return path;
};

