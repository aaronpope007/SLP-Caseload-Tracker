import type { Goal } from '../types';

/** Labels goals in session logging UI; archived goals stay visible on historic sessions. */
export function sessionGoalDisplayLabel(goal: Pick<Goal, 'description' | 'archived'>): string {
  const base = (goal.description ?? '').trim();
  const archivedTag = goal.archived === true ? ' (archived)' : '';
  if (!base) return goal.archived === true ? '(Archived goal)' : '(Untitled goal)';
  return `${base}${archivedTag}`;
}
