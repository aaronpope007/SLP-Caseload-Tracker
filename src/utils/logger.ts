/**
 * Centralized logging utility
 * Provides consistent logging across the application
 * Only logs in development mode to avoid console clutter in production
 */

const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

/**
 * Log debug information (only in development)
 */
export const logDebug = (...args: any[]): void => {
  if (isDevelopment) {
    console.log('[DEBUG]', ...args);
  }
};

/**
 * Log warnings
 */
export const logWarn = (...args: any[]): void => {
  if (isDevelopment) {
    console.warn('[WARN]', ...args);
  }
};

/**
 * Log errors
 * In production, these should be sent to an error tracking service
 */
export const logError = (...args: any[]): void => {
  console.error('[ERROR]', ...args);
  // TODO: In production, send to error tracking service (e.g., Sentry)
};

/**
 * Log info messages (only in development)
 */
export const logInfo = (...args: any[]): void => {
  if (isDevelopment) {
    console.info('[INFO]', ...args);
  }
};

