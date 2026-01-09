/**
 * CORS Configuration
 * 
 * Provides environment-aware CORS settings:
 * - Development: Allow all origins for easy local development
 * - Production: Restrict to specified origins for security
 * 
 * Environment Variables:
 * - NODE_ENV: 'development' | 'production' (default: 'development')
 * - CORS_ORIGIN: Comma-separated list of allowed origins (required in production)
 * - CORS_CREDENTIALS: 'true' | 'false' (default: 'true')
 */

import { CorsOptions } from 'cors';

/**
 * Get allowed origins from environment
 * Returns array of origins or true (allow all) for development
 */
function getAllowedOrigins(): string[] | true {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const corsOrigin = process.env.CORS_ORIGIN;
  
  // In development, allow all origins if CORS_ORIGIN is not set
  if (nodeEnv === 'development' && !corsOrigin) {
    return true;
  }
  
  // If CORS_ORIGIN is set, parse it as comma-separated list
  if (corsOrigin) {
    return corsOrigin
      .split(',')
      .map(origin => origin.trim())
      .filter(origin => origin.length > 0);
  }
  
  // In production without CORS_ORIGIN, only allow localhost (restrictive default)
  console.warn('⚠️  CORS_ORIGIN not set in production. Only localhost origins allowed.');
  return ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];
}

/**
 * Generate CORS options based on environment configuration
 */
export function getCorsOptions(): CorsOptions {
  const origins = getAllowedOrigins();
  const credentials = process.env.CORS_CREDENTIALS !== 'false';
  
  return {
    origin: origins === true ? true : (requestOrigin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!requestOrigin) {
        callback(null, true);
        return;
      }
      
      if (origins.includes(requestOrigin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${requestOrigin} not allowed by CORS`));
      }
    },
    credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    maxAge: 86400, // 24 hours - cache preflight requests
  };
}

/**
 * Log CORS configuration on startup (for debugging)
 */
export function logCorsConfig(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const origins = getAllowedOrigins();
  
  if (origins === true) {
    console.log('🔓 CORS: All origins allowed (development mode)');
  } else {
    console.log(`🔐 CORS: Allowed origins: ${origins.join(', ')}`);
  }
  console.log(`   Environment: ${nodeEnv}`);
}

