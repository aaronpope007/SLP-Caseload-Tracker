/** Include MA-logged sessions (by logged date) on timesheet / Stepping Stones notes. */
export const MA_SESSION_BILLING_DOC_KEY = 'timesheet_include_ma_session_billing_documentation';

/** Include MA-logged evaluations + documentation time (by logged date) on timesheet notes. */
export const MA_EVAL_BILLING_DOC_KEY = 'timesheet_include_ma_eval_billing_documentation';

function readBool(key: string, defaultValue: boolean): boolean {
  if (typeof localStorage === 'undefined') return defaultValue;
  const v = localStorage.getItem(key);
  if (v === null) return defaultValue;
  return v === 'true';
}

export function getIncludeMaSessionBillingDocumentation(): boolean {
  return readBool(MA_SESSION_BILLING_DOC_KEY, true);
}

export function getIncludeMaEvalBillingDocumentation(): boolean {
  return readBool(MA_EVAL_BILLING_DOC_KEY, true);
}

export function setIncludeMaSessionBillingDocumentation(enabled: boolean): void {
  localStorage.setItem(MA_SESSION_BILLING_DOC_KEY, enabled ? 'true' : 'false');
}

export function setIncludeMaEvalBillingDocumentation(enabled: boolean): void {
  localStorage.setItem(MA_EVAL_BILLING_DOC_KEY, enabled ? 'true' : 'false');
}
