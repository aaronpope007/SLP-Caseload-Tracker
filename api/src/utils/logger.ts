import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

/**
 * Structured logger using Pino
 * 
 * In development: Pretty-printed output with timestamps
 * In production: JSON format for log aggregation services
 */
export const logger = pino({
  level: logLevel,
  transport: !isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined, // Use default JSON transport in production
  base: {
    env: process.env.NODE_ENV || 'development',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
});

/**
 * Create a child logger with additional context
 */
export const createLogger = (context: string) => {
  return logger.child({ context });
};

/**
 * Log an error with optional additional context
 */
export const logError = (message: string, error?: unknown, context?: Record<string, unknown>) => {
  const errorObj = error instanceof Error 
    ? { 
        errorMessage: error.message, 
        errorStack: error.stack,
        errorName: error.name,
      }
    : { error };
  
  logger.error({ ...errorObj, ...context }, message);
};

/**
 * Log a warning with optional context
 */
export const logWarn = (message: string, context?: Record<string, unknown>) => {
  logger.warn(context, message);
};

/**
 * Log an info message with optional context
 */
export const logInfo = (message: string, context?: Record<string, unknown>) => {
  logger.info(context, message);
};

/**
 * Log a debug message with optional context
 */
export const logDebug = (message: string, context?: Record<string, unknown>) => {
  logger.debug(context, message);
};

export default logger;

