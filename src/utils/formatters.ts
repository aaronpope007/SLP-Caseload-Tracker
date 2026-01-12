/**
 * Formatting Utilities
 * 
 * Common formatting functions used throughout the application.
 */

/**
 * Format phone number as user types: (XXX) XXX-XXXX
 * Handles partial input gracefully
 */
export function formatPhoneNumber(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Limit to 10 digits
  const trimmed = digits.slice(0, 10);
  
  // Format based on length
  if (trimmed.length === 0) return '';
  if (trimmed.length <= 3) return `(${trimmed}`;
  if (trimmed.length <= 6) return `(${trimmed.slice(0, 3)}) ${trimmed.slice(3)}`;
  return `(${trimmed.slice(0, 3)}) ${trimmed.slice(3, 6)}-${trimmed.slice(6)}`;
}

/**
 * Format phone number for display: (XXX) XXX-XXXX
 * Handles undefined/null values and already formatted numbers
 */
export function formatPhoneForDisplay(phoneNumber: string | undefined | null): string {
  if (!phoneNumber) return '';
  
  // If already formatted, return as-is
  if (phoneNumber.match(/^\(\d{3}\) \d{3}-\d{4}$/)) {
    return phoneNumber;
  }
  
  // Otherwise format it
  return formatPhoneNumber(phoneNumber);
}

/**
 * Extract raw digits from a formatted phone number
 */
export function extractPhoneDigits(formattedPhone: string): string {
  return formattedPhone.replace(/\D/g, '');
}

/**
 * Strip phone formatting (alias for extractPhoneDigits for backward compatibility)
 */
export const stripPhoneFormatting = extractPhoneDigits;

/**
 * Validate phone number (10 digits)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const digits = extractPhoneDigits(phone);
  return digits.length === 10;
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

