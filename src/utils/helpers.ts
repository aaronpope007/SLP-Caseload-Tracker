export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

export const formatDateTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

export const calculateProgress = (baseline: string, current: number, target: string): number => {
  // Simple progress calculation - can be enhanced based on specific metrics
  // For now, return a percentage based on current vs target
  const targetNum = parseFloat(target) || 100;
  const baselineNum = parseFloat(baseline) || 0;
  const range = targetNum - baselineNum;
  
  if (range === 0) return 0;
  
  const progress = ((current - baselineNum) / range) * 100;
  return Math.max(0, Math.min(100, Math.round(progress)));
};

/**
 * Determines the chip color for goal progress based on current performance vs target
 * @param current - Current performance percentage (or null if not started)
 * @param target - Target percentage as string
 * @returns Object with color and variant for Material-UI Chip component
 */
export const getGoalProgressChipProps = (
  current: number | null,
  target: string
): { color: 'success' | 'warning' | 'error' | 'primary' | 'default'; variant: 'filled' | 'outlined' } => {
  if (current === null) {
    // Not started: blue with outlined variant
    return { color: 'primary', variant: 'outlined' };
  }
  
  const targetNum = parseFloat(target) || 100;
  const progressPercentOfGoal = (current / targetNum) * 100;
  
  if (progressPercentOfGoal >= 100) {
    // Met or exceeded goal: green
    return { color: 'success', variant: 'filled' };
  } else if (progressPercentOfGoal >= 60) {
    // 60-100% of goal: yellow
    return { color: 'warning', variant: 'filled' };
  } else {
    // 0-60% of goal: red
    return { color: 'error', variant: 'filled' };
  }
};

/**
 * Converts a Date object to local datetime string in format YYYY-MM-DDTHH:mm
 * for use with datetime-local input fields (preserves local time, not UTC)
 */
export const toLocalDateTimeString = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Converts a datetime-local string (YYYY-MM-DDTHH:mm) to ISO string
 * treating it as local time (not UTC)
 */
export const fromLocalDateTimeString = (dateString: string): string => {
  // Create date from local datetime string
  const date = new Date(dateString);
  // Return ISO string - this will preserve the local time interpretation
  return date.toISOString();
};

