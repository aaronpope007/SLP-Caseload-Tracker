import type { Goal } from '../types';

export interface GoalHierarchy {
  parentGoals: Goal[];
  subGoalsByParent: Map<string, Goal[]>;
  orphanGoals: Goal[];
}

/**
 * Organizes goals into parent/child hierarchy
 */
export const organizeGoalsHierarchy = (goalsList: Goal[]): GoalHierarchy => {
  const parentGoals: Goal[] = [];
  const subGoalsByParent = new Map<string, Goal[]>();
  const orphanGoals: Goal[] = [];
  const goalIdsSet = new Set(goalsList.map(g => g.id));

  // First pass: identify all subgoals and group them by parent
  goalsList.forEach(goal => {
    if (goal.parentGoalId) {
      // This is a subgoal - check if parent exists in the goals list
      if (goalIdsSet.has(goal.parentGoalId)) {
        if (!subGoalsByParent.has(goal.parentGoalId)) {
          subGoalsByParent.set(goal.parentGoalId, []);
        }
        subGoalsByParent.get(goal.parentGoalId)!.push(goal);
      }
    }
  });

  // Second pass: identify parent goals and orphan goals
  goalsList.forEach(goal => {
    if (goal.parentGoalId) {
      // This is a subgoal, skip it (already handled)
      return;
    }
    
    // Check if this goal has subgoals in the current list
    const hasSubGoals = subGoalsByParent.has(goal.id) && subGoalsByParent.get(goal.id)!.length > 0;
    
    if (hasSubGoals) {
      // This is a parent goal with active subgoals
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

