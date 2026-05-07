import React, { memo } from 'react';
import { Chip } from '@mui/material';
import { formatDateOnly, getGoalProgressChipProps } from '../../utils/helpers';

interface GoalProgressChipProps {
  average: number | null;
  target: string;
  evidenceCount?: number;
  lastTargetedDate?: string | null;
  size?: 'small' | 'medium';
}

export const GoalProgressChip: React.FC<GoalProgressChipProps> = memo(({
  average,
  target,
  evidenceCount,
  lastTargetedDate,
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

  const baseLabel = (() => {
    if (!isValidAverage || rounded === null) return 'Not started 0%';
    if (isAtOrAboveTarget && typeof hasEnoughEvidence === 'boolean') {
      return hasEnoughEvidence ? `Goal met ${rounded}%` : `Progressing ${rounded}%`;
    }
    if (isProgressingZone) {
      return `Progressing ${rounded}%`;
    }
    return `${rounded}%`;
  })();

  const dateSuffix = lastTargetedDate ? ` ${formatDateOnly(lastTargetedDate)}` : '';
  const label = `${baseLabel}${dateSuffix}`;

  return (
    <Chip
      label={label}
      size={size}
      color={chipProps.color}
      variant={chipProps.variant}
    />
  );
});

