/**
 * Jest Test Setup
 * 
 * This file runs before each test file.
 * Sets up test environment and database.
 */

import { jest, afterAll } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent'; // Suppress logs during tests

// Use in-memory database for tests (if supported) or a test database file
process.env.DATABASE_PATH = ':memory:';

// Increase timeout for integration tests
jest.setTimeout(10000);

// Global cleanup after all tests
afterAll(async () => {
  // Add any global cleanup here
});

