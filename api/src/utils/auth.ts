/**
 * Authentication Utilities
 * 
 * Provides password hashing and JWT token management.
 * Uses bcrypt for secure password hashing and JWT for stateless auth.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'slp-caseload-tracker-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const SALT_ROUNDS = 10;
const AUTH_FILE = path.join('./data', 'auth.json');

interface AuthData {
  passwordHash: string;
  createdAt: string;
  lastLogin?: string;
}

/**
 * Ensure the data directory exists
 */
function ensureDataDir(): void {
  const dataDir = './data';
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * Check if authentication is set up (password has been created)
 */
export function isAuthSetup(): boolean {
  return fs.existsSync(AUTH_FILE);
}

/**
 * Get auth data from file
 */
function getAuthData(): AuthData | null {
  if (!fs.existsSync(AUTH_FILE)) {
    return null;
  }
  
  try {
    const data = fs.readFileSync(AUTH_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    logger.error({ error }, 'Failed to read auth data');
    return null;
  }
}

/**
 * Save auth data to file
 */
function saveAuthData(data: AuthData): void {
  ensureDataDir();
  fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2));
}

/**
 * Set up authentication with a new password
 * Only works if auth is not already set up
 */
export async function setupAuth(password: string): Promise<boolean> {
  if (isAuthSetup()) {
    logger.warn('Auth already set up, cannot create new password');
    return false;
  }
  
  if (!password || password.length < 6) {
    logger.warn('Password too short (minimum 6 characters)');
    return false;
  }
  
  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    saveAuthData({
      passwordHash,
      createdAt: new Date().toISOString(),
    });
    
    logger.info('Authentication set up successfully');
    return true;
  } catch (error) {
    logger.error({ error }, 'Failed to set up authentication');
    return false;
  }
}

/**
 * Change the password
 * Requires the current password for verification
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
  if (!isAuthSetup()) {
    return false;
  }
  
  if (!await verifyPassword(currentPassword)) {
    return false;
  }
  
  if (!newPassword || newPassword.length < 6) {
    return false;
  }
  
  try {
    const authData = getAuthData();
    if (!authData) return false;
    
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    saveAuthData({
      ...authData,
      passwordHash,
    });
    
    logger.info('Password changed successfully');
    return true;
  } catch (error) {
    logger.error({ error }, 'Failed to change password');
    return false;
  }
}

/**
 * Verify a password against the stored hash
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const authData = getAuthData();
  
  if (!authData) {
    return false;
  }
  
  try {
    const isValid = await bcrypt.compare(password, authData.passwordHash);
    
    if (isValid) {
      // Update last login time
      saveAuthData({
        ...authData,
        lastLogin: new Date().toISOString(),
      });
    }
    
    return isValid;
  } catch (error) {
    logger.error({ error }, 'Failed to verify password');
    return false;
  }
}

/**
 * Generate a JWT token
 */
export function generateToken(): string {
  return jwt.sign(
    { 
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify a JWT token
 */
export function verifyToken(token: string): boolean {
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if authentication is enabled
 * Can be disabled via environment variable for development
 */
export function isAuthEnabled(): boolean {
  // Disabled by default in development, enabled in production
  if (process.env.AUTH_ENABLED !== undefined) {
    return process.env.AUTH_ENABLED === 'true';
  }
  return process.env.NODE_ENV === 'production';
}

