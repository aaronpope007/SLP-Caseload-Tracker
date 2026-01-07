import type { Goal } from '../types';

/**
 * Get the full path to a goal (e.g., "Articulation > R Blends > Initial Position")
 * by traversing up the parent chain
 */
export const getGoalPath = (goal: Goal, allGoals: Goal[]): string => {
  const path: string[] = [goal.description];
  let currentGoal: Goal | undefined = goal;
  
  while (currentGoal?.parentGoalId) {
    const parent = allGoals.find(g => g.id === currentGoal!.parentGoalId);
    if (parent) {
      path.unshift(parent.description);
      currentGoal = parent;
    } else {
      break;
    }
  }
  
  return path.join(' > ');
};

/**
 * Flatten all goals from a hierarchy into a searchable list
 */
export const flattenGoalHierarchy = (
  goals: Goal[],
  allGoals: Goal[],
  studentId: string,
  studentName: string
): Array<{ goal: Goal; path: string; studentId: string; studentName: string }> => {
  return goals.map(goal => ({
    goal,
    path: getGoalPath(goal, allGoals),
    studentId,
    studentName,
  }));
};

