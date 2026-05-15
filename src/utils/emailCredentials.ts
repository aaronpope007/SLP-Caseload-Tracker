const EMAIL_ADDRESS_KEY = 'email_address';
const EMAIL_PASSWORD_KEY = 'email_password';

export interface EmailCredentials {
  address: string;
  password: string;
}

/** Read Gmail SMTP credentials from localStorage (trimmed). */
export function getEmailCredentials(): EmailCredentials | null {
  const address = localStorage.getItem(EMAIL_ADDRESS_KEY)?.trim() ?? '';
  const password = localStorage.getItem(EMAIL_PASSWORD_KEY)?.trim() ?? '';
  if (!address || !password) return null;
  return { address, password };
}

export function hasEmailCredentials(): boolean {
  return getEmailCredentials() !== null;
}

/** Persist Gmail credentials immediately (used by Settings and on field change). */
export function persistEmailCredentials(address: string, password: string): void {
  const trimmedAddress = address.trim();
  const trimmedPassword = password.trim();
  if (trimmedAddress) {
    localStorage.setItem(EMAIL_ADDRESS_KEY, trimmedAddress);
  } else {
    localStorage.removeItem(EMAIL_ADDRESS_KEY);
  }
  if (trimmedPassword) {
    localStorage.setItem(EMAIL_PASSWORD_KEY, trimmedPassword);
  } else {
    localStorage.removeItem(EMAIL_PASSWORD_KEY);
  }
}

export const EMAIL_CREDENTIALS_MISSING_MESSAGE =
  'Gmail credentials are not saved. Open Settings, enter your Gmail address and App Password, then click Save. For Gmail, use an App Password—not your regular account password.';
