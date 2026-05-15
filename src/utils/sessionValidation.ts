import type { SessionLogEntry, SessionLogPerformanceSummaryEntry } from '../types';

function isGroupSessionRow(session: SessionLogEntry): boolean {
  const gid = session.groupSessionId;
  if (gid != null && String(gid).trim() !== '') return true;
  if (session.resolvedCptCode?.trim() === '92508') return true;
  return session.isGroup === true;
}

/** True when every row has zero trials and accuracy is null or zero. */
function performanceRowsEffectivelyEmpty(perf: SessionLogPerformanceSummaryEntry[]): boolean {
  if (perf.length === 0) return true;
  return perf.every((p) => {
    const trials =
      typeof p.totalTrials === 'number' && !Number.isNaN(p.totalTrials)
        ? p.totalTrials
        : (p.correctTrials ?? 0) + (p.incorrectTrials ?? 0);
    const accNum = p.accuracy == null || Number.isNaN(Number(p.accuracy)) ? null : Number(p.accuracy);
    return trials === 0 && (accNum == null || accNum === 0);
  });
}

/**
 * Group session rows where this student may have been left selected by mistake: no stored goals
 * addressed, no performance rows, or only zero-trial / zero-accuracy performance rows.
 */
export function groupSessionHasInsufficientData(session: SessionLogEntry): boolean {
  if (!isGroupSessionRow(session)) return false;

  const perf = session.performanceSummary ?? [];
  const hasPerfRows = perf.length > 0;
  const weakTrialsOnly = hasPerfRows && performanceRowsEffectivelyEmpty(perf);

  if (session.hasStoredGoalsAddressed !== undefined) {
    return !session.hasStoredGoalsAddressed || !hasPerfRows || weakTrialsOnly;
  }

  // Older log payloads without `hasStoredGoalsAddressed`: infer missing goals from empty goal labels.
  const hasGoalLabels = (session.goalsAddressedText ?? []).some((g) => String(g).trim().length > 0);
  return !hasGoalLabels || !hasPerfRows || weakTrialsOnly;
}
