import { Request, Response, NextFunction } from 'express';

/**
 * Async error handler middleware
 * Wraps async route handlers to automatically catch and forward errors
 * 
 * Usage:
 *   router.get('/', asyncHandler(async (req, res) => {
 *     // route logic without try-catch
 *   }));
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

