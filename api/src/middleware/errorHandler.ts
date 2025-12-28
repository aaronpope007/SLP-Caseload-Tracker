import { Request, Response, NextFunction } from 'express';

/**
 * Global error handler middleware
 * Should be used as the last middleware in the Express app
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error (in production, send to error tracking service)
  console.error('API Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Send error response
  res.status(500).json({
    error: err.message || 'Internal server error',
  });
};

