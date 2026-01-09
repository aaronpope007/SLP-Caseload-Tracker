/**
 * Authentication Middleware
 * 
 * Protects API routes by requiring a valid JWT token.
 * Token should be sent in the Authorization header as "Bearer <token>".
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken, isAuthEnabled, isAuthSetup } from '../utils/auth';
import { logger } from '../utils/logger';

// Extend Request type to include auth info
declare global {
  namespace Express {
    interface Request {
      isAuthenticated?: boolean;
    }
  }
}

/**
 * Extract token from Authorization header
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }
  
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }
  
  return parts[1];
}

/**
 * Authentication middleware
 * 
 * If auth is enabled and set up, requires a valid JWT token.
 * If auth is disabled or not set up, allows all requests.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for certain paths
  const publicPaths = [
    '/health',
    '/api/auth/login',
    '/api/auth/setup',
    '/api/auth/status',
  ];
  
  if (publicPaths.some(path => req.path === path || req.path.startsWith(path))) {
    next();
    return;
  }
  
  // If auth is not enabled, allow all requests
  if (!isAuthEnabled()) {
    req.isAuthenticated = true;
    next();
    return;
  }
  
  // If auth is not set up yet, allow all requests (first-time setup)
  if (!isAuthSetup()) {
    req.isAuthenticated = false;
    next();
    return;
  }
  
  // Extract and verify token
  const token = extractToken(req);
  
  if (!token) {
    res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please provide a valid authentication token',
    });
    return;
  }
  
  if (!verifyToken(token)) {
    res.status(401).json({ 
      error: 'Invalid token',
      message: 'Your session has expired. Please log in again.',
    });
    return;
  }
  
  req.isAuthenticated = true;
  next();
}

/**
 * Optional auth middleware - doesn't block but sets isAuthenticated
 */
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  
  if (token && verifyToken(token)) {
    req.isAuthenticated = true;
  } else {
    req.isAuthenticated = false;
  }
  
  next();
}

export default authMiddleware;

