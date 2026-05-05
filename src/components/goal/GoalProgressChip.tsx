import React, { memo } from 'react';
import { Chip } from '@mui/material';
import { getGoalProgressChipProps } from '../../utils/helpers';

interface GoalProgressChipProps {
  average: number | null;
  target: string;
  evidenceCount?: number;
  size?: 'small' | 'medium';
}

export const GoalProgressChip: React.FC<GoalProgressChipProps> = memo(({
  average,
  target,
  evidenceCount,
  size = 'small',
}) => {
  const chipProps = getGoalProgressChipProps(average, target, evidenceCount);
  const isValidAverage = average !== null && !isNaN(average) && isFinite(average);

  const rounded = isValidAverage ? Math.round(average as number) : null;
  const targetNum = parseFloat(target) || 100;
  const progressPercentOfGoal = rounded !== null && targetNum > 0 ? (rounded / targetNum) * 100 : null;
  const isAtOrAboveTarget = rounded !== null && rounded >= targetNum;
  const isProgressingZone = progressPercentOfGoal !== null && progressPercentOfGoal >= 60 && progressPercentOfGoal < 100;
  const hasEnoughEvidence = typeof evidenceCount === 'number' ? evidenceCount >= 3 : undefined;

  const label = (() => {
    if (!isValidAverage || rounded === null) return 'not started 0%';
    if (isAtOrAboveTarget && typeof hasEnoughEvidence === 'boolean') {
      return hasEnoughEvidence ? `goal met: ${rounded}%` : `progressing: ${rounded}%`;
    }
    if (isProgressingZone) {
      return `progressing: ${rounded}%`;
    }
    return `${rounded}%`;
  })();

  return (
    <Chip
      label={label}
      size={size}
      color={chipProps.color}
      variant={chipProps.variant}
    />
  );
});

