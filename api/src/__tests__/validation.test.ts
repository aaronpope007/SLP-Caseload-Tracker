/**
 * API Validation Integration Tests
 * 
 * Tests the Zod validation middleware on API endpoints.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from './testApp';
import { initDatabase } from '../db';

const app = createTestApp();

// Initialize database before tests
beforeAll(async () => {
  await initDatabase();
});

describe('Student Validation', () => {
  describe('POST /api/students', () => {
    it('should reject empty request body', async () => {
      const response = await request(app)
        .post('/api/students')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    it('should reject student with empty name', async () => {
      const response = await request(app)
        .post('/api/students')
        .send({
          name: '',
          age: 10,
          grade: '5th',
          school: 'Test School',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.some((d: { field: string }) => d.field === 'name')).toBe(true);
    });

    it('should reject student with negative age', async () => {
      const response = await request(app)
        .post('/api/students')
        .send({
          name: 'Test Student',
          age: -5,
          grade: '5th',
          school: 'Test School',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.some((d: { field: string }) => d.field === 'age')).toBe(true);
    });

    it('should reject student with empty school', async () => {
      const response = await request(app)
        .post('/api/students')
        .send({
          name: 'Test Student',
          age: 10,
          grade: '5th',
          school: '',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.some((d: { field: string }) => d.field === 'school')).toBe(true);
    });

    it('should accept valid student data', async () => {
      const response = await request(app)
        .post('/api/students')
        .send({
          name: 'Valid Student',
          age: 10,
          grade: '5th Grade',
          school: 'Test School',
          concerns: ['Articulation'],
          status: 'active',
        });
      
      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.message).toContain('created');
    });
  });
});

describe('School Validation', () => {
  describe('POST /api/schools', () => {
    it('should reject school with empty name', async () => {
      const response = await request(app)
        .post('/api/schools')
        .send({
          name: '',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should accept valid school data', async () => {
      const response = await request(app)
        .post('/api/schools')
        .send({
          name: 'Test Elementary School',
          state: 'CA',
          teletherapy: false,
        });
      
      // Schools API returns 200 on success
      expect([200, 201]).toContain(response.status);
      expect(response.body.id).toBeDefined();
    });
  });
});

describe('Goal Validation', () => {
  let studentId: string;
  
  beforeAll(async () => {
    // Create a student for goal tests
    const response = await request(app)
      .post('/api/students')
      .send({
        name: 'Goal Test Student',
        age: 8,
        grade: '3rd',
        school: 'Test School',
      });
    studentId = response.body.id;
  });

  describe('POST /api/goals', () => {
    it('should reject goal with empty description', async () => {
      const response = await request(app)
        .post('/api/goals')
        .send({
          studentId,
          description: '',
          baseline: '0%',
          target: '80%',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject goal for non-existent student', async () => {
      const response = await request(app)
        .post('/api/goals')
        .send({
          studentId: 'non-existent-id',
          description: 'Test goal',
          baseline: '0%',
          target: '80%',
        });
      
      // API returns 400 with validation error for non-existent student
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Student');
    });

    it('should accept valid goal data', async () => {
      const response = await request(app)
        .post('/api/goals')
        .send({
          studentId,
          description: 'Student will produce /r/ in all positions',
          baseline: '20% accuracy',
          target: '80% accuracy',
          status: 'in-progress',
          priority: 'high',
        });
      
      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
    });
  });
});

describe('Health Check', () => {
  it('should return ok status', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
  });
});

