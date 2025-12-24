import type { Goal } from '../types';
import { generateId } from './helpers';
import { organizeGoalsHierarchy } from './goalHierarchy';

/**
 * Recursively collects all goals in a subtree (a goal and all its descendants)
 */
export function collectSubtree(goalId: string, allGoals: Goal[]): Goal[] {
  const hierarchy = organizeGoalsHierarchy(allGoals);
  const result: Goal[] = [];
  const visited = new Set<string>();

  function collect(goalId: string) {
    if (visited.has(goalId)) return;
    visited.add(goalId);

    const goal = allGoals.find(g => g.id === goalId);
    if (!goal) return;

    result.push(goal);

    const subGoals = hierarchy.subGoalsByParent.get(goalId) || [];
    for (const subGoal of subGoals) {
      collect(subGoal.id);
    }
  }

  collect(goalId);
  return result;
}

/**
 * Applies text replacements to a string
 */
function applyReplacements(text: string, replacements: Array<{ from: string; to: string }>): string {
  let result = text;
  for (const { from, to } of replacements) {
    if (from) {
      // Use global replace to replace all occurrences
      result = result.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
    }
  }
  return result;
}

/**
 * Copies a goal subtree with optional text replacements
 * Returns a map of old goal ID to new goal ID for maintaining parent relationships
 */
export async function copyGoalSubtree(
  rootGoal: Goal,
  allGoals: Goal[],
  replacements: Array<{ from: string; to: string }> = [],
  newParentGoalId?: string
): Promise<{ newGoals: Goal[]; idMap: Map<string, string> }> {
  // Collect all goals in the subtree
  const subtreeGoals = collectSubtree(rootGoal.id, allGoals);
  
  if (subtreeGoals.length === 0) {
    // Still return at least the root goal
    const newId = generateId();
    const idMap = new Map<string, string>();
    idMap.set(rootGoal.id, newId);
    
    const newGoal: Goal = {
      ...rootGoal,
      id: newId,
      description: applyReplacements(rootGoal.description, replacements),
      baseline: applyReplacements(rootGoal.baseline, replacements),
      target: applyReplacements(rootGoal.target, replacements),
      dateCreated: new Date().toISOString(),
      dateAchieved: undefined,
      parentGoalId: newParentGoalId || undefined,
      subGoalIds: undefined,
    };
    
    return { newGoals: [newGoal], idMap };
  }
  
  // Sort by depth (root first, then children)
  const hierarchy = organizeGoalsHierarchy(allGoals);
  const sortedGoals: Goal[] = [];
  const visited = new Set<string>();

  function sortByDepth(goalId: string) {
    if (visited.has(goalId)) return;
    visited.add(goalId);

    const goal = subtreeGoals.find(g => g.id === goalId);
    if (!goal) return;

    sortedGoals.push(goal);

    const subGoals = hierarchy.subGoalsByParent.get(goalId) || [];
    for (const subGoal of subGoals) {
      sortByDepth(subGoal.id);
    }
  }

  sortByDepth(rootGoal.id);

  // Create new goals with replacements
  const idMap = new Map<string, string>();
  const newGoals: Goal[] = [];

  for (const oldGoal of sortedGoals) {
    const newId = generateId();
    idMap.set(oldGoal.id, newId);

    const newGoal: Goal = {
      ...oldGoal,
      id: newId,
      description: applyReplacements(oldGoal.description, replacements),
      baseline: applyReplacements(oldGoal.baseline, replacements),
      target: applyReplacements(oldGoal.target, replacements),
      dateCreated: new Date().toISOString(),
      dateAchieved: undefined, // Reset achievement date for copied goals
      // Update parentGoalId: if this is the root goal, use newParentGoalId if provided,
      // otherwise map the old parentGoalId to the new one
      parentGoalId: oldGoal.id === rootGoal.id
        ? (newParentGoalId || undefined)
        : (oldGoal.parentGoalId ? idMap.get(oldGoal.parentGoalId) : undefined),
      subGoalIds: undefined, // Will be updated after all goals are created
    };

    newGoals.push(newGoal);
  }

  // Update subGoalIds for all new goals
  for (const newGoal of newGoals) {
    // Find the old goal that corresponds to this new goal
    const oldGoalId = Array.from(idMap.entries()).find(([_, newId]) => newId === newGoal.id)?.[0];
    if (oldGoalId) {
      const oldGoal = sortedGoals.find(g => g.id === oldGoalId);
      if (oldGoal && oldGoal.subGoalIds) {
        // Ensure subGoalIds is an array (it might be a string if not parsed correctly)
        let subGoalIdsArray: string[];
        if (Array.isArray(oldGoal.subGoalIds)) {
          subGoalIdsArray = oldGoal.subGoalIds;
        } else if (typeof oldGoal.subGoalIds === 'string') {
          try {
            subGoalIdsArray = JSON.parse(oldGoal.subGoalIds);
          } catch {
            console.warn(`Failed to parse subGoalIds for goal ${oldGoal.id}, using empty array`);
            subGoalIdsArray = [];
          }
        } else {
          subGoalIdsArray = [];
        }
        
        newGoal.subGoalIds = subGoalIdsArray
          .map(oldSubId => idMap.get(oldSubId))
          .filter((id): id is string => id !== undefined);
      }
    }
  }

  return { newGoals, idMap };
}

