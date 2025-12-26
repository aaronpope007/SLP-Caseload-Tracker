import type { Goal } from '../types';
import { generateId } from './helpers';

export type ArticulationLevel = 'word' | 'phrase' | 'sentence' | 'conversation';

export interface ArticulationQuickGoalParams {
  phoneme: string; // e.g., "/s/"
  level: ArticulationLevel;
  targetPercentage: number;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * Generates a hierarchical goal tree for articulation goals
 * Based on the selected level, generates all levels from that level down to word level
 */
export function generateArticulationGoalTree(
  studentId: string,
  params: ArticulationQuickGoalParams
): Goal[] {
  const { phoneme, level, targetPercentage, priority = 'medium' } = params;
  const goals: Goal[] = [];
  const now = new Date().toISOString();
  const domain = 'Articulation';

  // Clean phoneme to ensure it has slashes
  const cleanPhoneme = phoneme.startsWith('/') && phoneme.endsWith('/')
    ? phoneme
    : `/${phoneme}/`;

  // Define the hierarchy based on selected level
  // Common practice: conversation > phrase > word (skipping sentence)
  // If user selects sentence, it goes sentence > phrase > word
  let levelsToGenerate: ArticulationLevel[];
  
  if (level === 'conversation') {
    // Skip sentence level - go directly to phrase > word
    levelsToGenerate = ['conversation', 'phrase', 'word'];
  } else if (level === 'sentence') {
    levelsToGenerate = ['sentence', 'phrase', 'word'];
  } else if (level === 'phrase') {
    levelsToGenerate = ['phrase', 'word'];
  } else {
    // word level only
    levelsToGenerate = ['word'];
  }


  let parentGoalId: string | undefined = undefined;
  const goalMap = new Map<string, Goal>();

  // Create goals for each level (top-down: from selected level to word level)
  levelsToGenerate.forEach((currentLevel, index) => {
    const isTopLevel = index === 0; // Top level is the selected level
    const isWordLevel = currentLevel === 'word';

    let description: string;
    let target: string;

    if (isTopLevel) {
      // Top level goal includes target percentage and "independently"
      description = `${cleanPhoneme} at ${currentLevel} level in all positions of words with ${targetPercentage}% accuracy independently`;
      target = targetPercentage.toString();
    } else if (isWordLevel) {
      // Word level sub-goal
      description = `${cleanPhoneme} word level all positions of words`;
      target = targetPercentage.toString();
    } else {
      // Intermediate levels (phrase, sentence when not top level)
      description = `${cleanPhoneme} at ${currentLevel} level all positions of words`;
      target = targetPercentage.toString();
    }

    const goalId = generateId();
    const goal: Goal = {
      id: goalId,
      studentId,
      description,
      baseline: '',
      target,
      status: 'in-progress',
      dateCreated: now,
      domain,
      priority,
      parentGoalId,
      subGoalIds: [],
    };

    goals.push(goal);
    goalMap.set(goalId, goal);

    // Update parent's subGoalIds
    if (parentGoalId) {
      const parent = goalMap.get(parentGoalId);
      if (parent) {
        if (!parent.subGoalIds) {
          parent.subGoalIds = [];
        }
        parent.subGoalIds.push(goalId);
      }
    }

    // If this is the word level and there are multiple levels, add position breakdown sub-goals
    if (isWordLevel && levelsToGenerate.length > 1) {
      const positions = [
        { name: 'initial', label: 'initial position' },
        { name: 'medial', label: 'medial position' },
        { name: 'final', label: 'final position' },
      ];

      positions.forEach((position) => {
        const positionGoalId = generateId();
        const positionGoal: Goal = {
          id: positionGoalId,
          studentId,
          description: `${cleanPhoneme} ${position.label} of words`,
          baseline: '',
          target: targetPercentage.toString(),
          status: 'in-progress',
          dateCreated: now,
          domain,
          priority,
          parentGoalId: goalId,
        };
        goals.push(positionGoal);

        // Add to word level goal's subGoalIds
        if (!goal.subGoalIds) {
          goal.subGoalIds = [];
        }
        goal.subGoalIds.push(positionGoalId);
      });
    }

    parentGoalId = goalId;
  });

  return goals;
}

