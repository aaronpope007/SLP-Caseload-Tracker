import pinoHttp from 'pino-http';
import { logger } from '../utils/logger';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * HTTP request logging middleware using pino-http
 * 
 * Logs:
 * - Request method and URL
 * - Response status code and time
 * - Request ID for tracing
 * - Error details on failures
 */
export const requestLogger = pinoHttp({
  logger,
  // Don't log health check requests in production
  autoLogging: {
    ignore: (req) => {
      if (isProduction && req.url === '/health') {
        return true;
      }
      return false;
    },
  },
  // Custom log level based on response status
  customLogLevel: (req, res, error) => {
    if (res.statusCode >= 500 || error) {
      return 'error';
    }
    if (res.statusCode >= 400) {
      return 'warn';
    }
    return 'info';
  },
  // Custom success message
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} - ${res.statusCode}`;
  },
  // Custom error message
  customErrorMessage: (req, res, error) => {
    return `${req.method} ${req.url} - ${res.statusCode} - ${error?.message || 'Error'}`;
  },
  // Serializers to control what gets logged
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      query: req.query,
      // Don't log full body to avoid sensitive data exposure
      // Log body size instead
      bodySize: req.raw?.headers?.['content-length'] || 0,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

export default requestLogger;

