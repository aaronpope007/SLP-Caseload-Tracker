/**
 * Test Application Setup
 * 
 * Creates a configured Express app for testing without starting the server.
 */

import express from 'express';
import cors from 'cors';
import { studentsRouter } from '../routes/students';
import { goalsRouter } from '../routes/goals';
import { schoolsRouter } from '../routes/schools';
import { errorHandler } from '../middleware/errorHandler';

/**
 * Create a test Express application
 */
export function createTestApp() {
  const app = express();
  
  // Middleware
  app.use(cors());
  app.use(express.json());
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // Routes
  app.use('/api/students', studentsRouter);
  app.use('/api/goals', goalsRouter);
  app.use('/api/schools', schoolsRouter);
  
  // Error handler
  app.use(errorHandler);
  
  return app;
}

export default createTestApp;

