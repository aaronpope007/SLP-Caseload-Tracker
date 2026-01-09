/**
 * Environment Variable Validation
 * 
 * Validates and logs environment configuration on startup.
 * Warns about missing or potentially problematic settings.
 */

import { logger } from './logger';

interface EnvConfig {
  name: string;
  required: boolean;
  defaultValue?: string;
  description: string;
  sensitive?: boolean;
}

const ENV_CONFIG: EnvConfig[] = [
  {
    name: 'NODE_ENV',
    required: false,
    defaultValue: 'development',
    description: 'Application environment (development/production)',
  },
  {
    name: 'PORT',
    required: false,
    defaultValue: '3001',
    description: 'API server port',
  },
  {
    name: 'CORS_ORIGIN',
    required: false,
    defaultValue: '*',
    description: 'Allowed CORS origins (comma-separated for multiple)',
  },
  {
    name: 'JWT_SECRET',
    required: false,
    defaultValue: 'default-secret',
    description: 'Secret key for JWT token signing',
    sensitive: true,
  },
  {
    name: 'JWT_EXPIRES_IN',
    required: false,
    defaultValue: '7d',
    description: 'JWT token expiration time',
  },
  {
    name: 'AUTH_ENABLED',
    required: false,
    defaultValue: 'false',
    description: 'Enable authentication (true/false)',
  },
  {
    name: 'RATE_LIMIT_ENABLED',
    required: false,
    defaultValue: 'true',
    description: 'Enable rate limiting (true/false)',
  },
  {
    name: 'RATE_LIMIT_WINDOW_MS',
    required: false,
    defaultValue: '900000',
    description: 'Rate limit window in milliseconds',
  },
  {
    name: 'RATE_LIMIT_MAX_REQUESTS',
    required: false,
    defaultValue: '100',
    description: 'Maximum requests per rate limit window',
  },
  {
    name: 'MAX_BACKUPS',
    required: false,
    defaultValue: '10',
    description: 'Maximum number of database backups to keep',
  },
  {
    name: 'LOG_LEVEL',
    required: false,
    defaultValue: 'info',
    description: 'Logging level (debug/info/warn/error)',
  },
];

interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Validate environment variables and log warnings/errors
 */
export function validateEnv(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
  };

  const isProduction = process.env.NODE_ENV === 'production';

  for (const config of ENV_CONFIG) {
    const value = process.env[config.name];

    if (!value) {
      if (config.required) {
        result.errors.push(`Missing required environment variable: ${config.name}`);
        result.valid = false;
      }
    }
  }

  // Production-specific warnings
  if (isProduction) {
    // Warn about default JWT secret in production
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'slp-caseload-tracker-secret-change-in-production') {
      result.warnings.push('JWT_SECRET is using default value - this is insecure for production!');
    }

    // Warn about CORS allowing all origins
    if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*') {
      result.warnings.push('CORS_ORIGIN is set to allow all origins - consider restricting for production');
    }

    // Warn about auth not being enabled
    if (process.env.AUTH_ENABLED !== 'true') {
      result.warnings.push('AUTH_ENABLED is not set to true - authentication is disabled in production');
    }
  }

  return result;
}

/**
 * Log environment configuration (without sensitive values)
 */
export function logEnvConfig(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  logger.info('📋 Environment Configuration:');
  
  const configSummary: Record<string, string> = {};
  
  for (const config of ENV_CONFIG) {
    const value = process.env[config.name];
    
    if (config.sensitive && value) {
      configSummary[config.name] = '[SET]';
    } else {
      configSummary[config.name] = value || `(default: ${config.defaultValue})`;
    }
  }
  
  logger.info({ config: configSummary }, 'Environment variables');
}

/**
 * Validate environment and log results
 * Call this on server startup
 */
export function validateAndLogEnv(): void {
  const result = validateEnv();
  
  // Log configuration
  logEnvConfig();
  
  // Log warnings
  for (const warning of result.warnings) {
    logger.warn(`⚠️  ${warning}`);
  }
  
  // Log errors
  for (const error of result.errors) {
    logger.error(`❌ ${error}`);
  }
  
  if (!result.valid) {
    logger.error('Environment validation failed. Please check your .env file.');
    // In production, you might want to exit the process
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  } else if (result.warnings.length === 0) {
    logger.info('✅ Environment validation passed');
  }
}

