/**
 * Request validation middleware using Zod schemas
 * Validates request body, query params, or route params against a Zod schema
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Format Zod errors into user-friendly messages
 */
function formatZodErrors(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'unknown',
    message: issue.message,
  }));
}

/**
 * Middleware to validate request body against a Zod schema
 * 
 * @example
 * router.post('/', validateBody(createStudentSchema), asyncHandler(async (req, res) => {
 *   const student = req.body; // Type-safe and validated
 *   // ...
 * }));
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    
    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: formatZodErrors(result.error),
      });
      return;
    }
    
    // Replace body with parsed/transformed data
    req.body = result.data;
    next();
  };
}

/**
 * Middleware to validate query parameters against a Zod schema
 * 
 * @example
 * router.get('/', validateQuery(filterSchema), asyncHandler(async (req, res) => {
 *   const { school, studentId } = req.query; // Type-safe and validated
 *   // ...
 * }));
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid query parameters',
        details: formatZodErrors(result.error),
      });
      return;
    }
    
    // Replace query with parsed/transformed data
    // Note: Express query is typed as any, so we cast here
    (req as any).validatedQuery = result.data;
    next();
  };
}

/**
 * Middleware to validate route parameters against a Zod schema
 * 
 * @example
 * router.get('/:id', validateParams(idParamSchema), asyncHandler(async (req, res) => {
 *   const { id } = req.params; // Type-safe and validated
 *   // ...
 * }));
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid route parameters',
        details: formatZodErrors(result.error),
      });
      return;
    }
    
    // Replace params with parsed/transformed data
    req.params = result.data as any;
    next();
  };
}

/**
 * Common param schemas
 */
export const idParamSchema = {
  id: (req: Request): string => {
    const id = req.params.id;
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new Error('ID is required');
    }
    return id.trim();
  },
};

