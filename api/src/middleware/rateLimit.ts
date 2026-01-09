/**
 * Rate Limiting Middleware
 * 
 * Protects the API from abuse by limiting the number of requests per IP.
 * 
 * Environment Variables:
 * - RATE_LIMIT_WINDOW_MS: Time window in milliseconds (default: 15 minutes)
 * - RATE_LIMIT_MAX_REQUESTS: Max requests per window (default: 100)
 * - RATE_LIMIT_ENABLED: 'true' | 'false' (default: 'true' in production, 'false' in development)
 */

import rateLimit from 'express-rate-limit';

/**
 * Check if rate limiting should be enabled
 */
function isRateLimitEnabled(): boolean {
  const enabled = process.env.RATE_LIMIT_ENABLED;
  
  // If explicitly set, use that value
  if (enabled !== undefined) {
    return enabled === 'true';
  }
  
  // Default: enabled in production, disabled in development
  return process.env.NODE_ENV === 'production';
}

/**
 * Get rate limit configuration from environment
 */
function getRateLimitConfig() {
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes
  const max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
  
  return { windowMs, max };
}

/**
 * General API rate limiter
 * - 100 requests per 15 minutes per IP (default)
 */
export const apiLimiter = rateLimit({
  windowMs: getRateLimitConfig().windowMs,
  max: getRateLimitConfig().max,
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: Math.ceil(getRateLimitConfig().windowMs / 1000),
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: () => !isRateLimitEnabled(), // Skip rate limiting if disabled
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  },
});

/**
 * Stricter rate limiter for sensitive operations (e.g., email sending)
 * - 10 requests per 15 minutes per IP
 */
export const strictLimiter = rateLimit({
  windowMs: getRateLimitConfig().windowMs,
  max: 10, // Much stricter limit
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the rate limit for this operation. Please try again later.',
    retryAfter: Math.ceil(getRateLimitConfig().windowMs / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isRateLimitEnabled(),
  handler: (req, res, next, options) => {
    res.status(429).json(options.message);
  },
});

/**
 * Log rate limiting configuration on startup
 */
export function logRateLimitConfig(): void {
  const enabled = isRateLimitEnabled();
  const config = getRateLimitConfig();
  
  if (enabled) {
    console.log(`🚦 Rate limiting: ENABLED`);
    console.log(`   Window: ${config.windowMs / 1000}s, Max requests: ${config.max}`);
  } else {
    console.log('🚦 Rate limiting: DISABLED (development mode)');
  }
}

