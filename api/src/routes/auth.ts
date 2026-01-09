/**
 * Authentication Routes
 * 
 * Provides API endpoints for authentication:
 * - GET /api/auth/status - Check if auth is set up and enabled
 * - POST /api/auth/setup - Set up authentication with initial password
 * - POST /api/auth/login - Login with password
 * - POST /api/auth/change-password - Change password
 * - POST /api/auth/logout - Logout (client-side token removal)
 */

import express from 'express';
import { 
  isAuthSetup, 
  isAuthEnabled, 
  setupAuth, 
  verifyPassword, 
  generateToken,
  changePassword,
} from '../utils/auth';
import { logger } from '../utils/logger';

export const authRouter = express.Router();

/**
 * GET /api/auth/status
 * Check authentication status
 */
authRouter.get('/status', (req, res) => {
  const enabled = isAuthEnabled();
  const setup = isAuthSetup();
  
  res.json({
    enabled,
    setup,
    requiresLogin: enabled && setup,
    requiresSetup: enabled && !setup,
  });
});

/**
 * POST /api/auth/setup
 * Set up authentication with initial password
 * Only works if auth is not already set up
 */
authRouter.post('/setup', async (req, res) => {
  const { password } = req.body;
  
  if (!password) {
    res.status(400).json({ error: 'Password is required' });
    return;
  }
  
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }
  
  if (isAuthSetup()) {
    res.status(400).json({ error: 'Authentication is already set up' });
    return;
  }
  
  try {
    const success = await setupAuth(password);
    
    if (success) {
      const token = generateToken();
      logger.info('Authentication set up successfully');
      res.status(201).json({ 
        message: 'Authentication set up successfully',
        token,
      });
    } else {
      res.status(500).json({ error: 'Failed to set up authentication' });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to set up authentication');
    res.status(500).json({ error: 'Failed to set up authentication' });
  }
});

/**
 * POST /api/auth/login
 * Login with password
 */
authRouter.post('/login', async (req, res) => {
  const { password } = req.body;
  
  if (!password) {
    res.status(400).json({ error: 'Password is required' });
    return;
  }
  
  if (!isAuthSetup()) {
    res.status(400).json({ error: 'Authentication is not set up' });
    return;
  }
  
  try {
    const isValid = await verifyPassword(password);
    
    if (isValid) {
      const token = generateToken();
      logger.info('User logged in successfully');
      res.json({ 
        message: 'Login successful',
        token,
      });
    } else {
      logger.warn('Failed login attempt');
      res.status(401).json({ error: 'Invalid password' });
    }
  } catch (error) {
    logger.error({ error }, 'Login error');
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/change-password
 * Change password (requires current password)
 */
authRouter.post('/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current password and new password are required' });
    return;
  }
  
  if (newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters' });
    return;
  }
  
  try {
    const success = await changePassword(currentPassword, newPassword);
    
    if (success) {
      const token = generateToken(); // Generate new token after password change
      logger.info('Password changed successfully');
      res.json({ 
        message: 'Password changed successfully',
        token,
      });
    } else {
      res.status(401).json({ error: 'Current password is incorrect' });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to change password');
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * POST /api/auth/logout
 * Logout (informational - actual logout is client-side token removal)
 */
authRouter.post('/logout', (req, res) => {
  logger.info('User logged out');
  res.json({ message: 'Logged out successfully' });
});

