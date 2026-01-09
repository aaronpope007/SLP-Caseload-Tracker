/**
 * Swagger/OpenAPI Configuration
 * 
 * Provides interactive API documentation at /api-docs
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SLP Caseload Tracker API',
      version: '1.0.0',
      description: `
# SLP Caseload Tracker API Documentation

This API provides endpoints for managing Speech-Language Pathology (SLP) caseload data including:

- **Students** - Manage student records and demographics
- **Goals** - Track IEP goals and objectives
- **Sessions** - Document therapy sessions and activities
- **Schools** - Manage school information
- **Teachers** - Track teacher contacts
- **Case Managers** - Manage case manager information
- **Evaluations** - Track student evaluations
- **SOAP Notes** - Generate and store SOAP documentation
- **Progress Reports** - Create and manage progress reports
- **Communications** - Log parent/teacher communications
- **Due Date Items** - Track IEP due dates and deadlines
- **Backup** - Database backup and restore operations
- **Authentication** - User authentication (when enabled)

## Authentication

When authentication is enabled (production mode), include the JWT token in requests:

\`\`\`
Authorization: Bearer <your-token>
\`\`\`

Get a token by calling POST /api/auth/login with your password.
      `,
      contact: {
        name: 'SLP Caseload Tracker',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/auth/login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Error message' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
              description: 'Validation error details',
            },
          },
        },
        Student: {
          type: 'object',
          required: ['name', 'grade', 'status', 'school'],
          properties: {
            id: { type: 'string', format: 'uuid', description: 'Unique identifier' },
            name: { type: 'string', description: 'Student full name' },
            age: { type: 'integer', minimum: 0, maximum: 25, description: 'Student age' },
            grade: { type: 'string', description: 'Grade level (e.g., "K", "1st", "2nd")' },
            status: { type: 'string', enum: ['active', 'inactive', 'discharged'], description: 'Student status' },
            school: { type: 'string', format: 'uuid', description: 'School ID' },
            teacher: { type: 'string', format: 'uuid', nullable: true, description: 'Teacher ID' },
            caseManager: { type: 'string', format: 'uuid', nullable: true, description: 'Case Manager ID' },
            parentEmail: { type: 'string', format: 'email', nullable: true, description: 'Parent email address' },
            iepDueDate: { type: 'string', format: 'date', nullable: true, description: 'IEP due date' },
            reevalDueDate: { type: 'string', format: 'date', nullable: true, description: 'Re-evaluation due date' },
            medicaidEligible: { type: 'boolean', description: 'Medicaid eligibility' },
            archived: { type: 'boolean', description: 'Whether student is archived' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Goal: {
          type: 'object',
          required: ['studentId', 'description', 'status'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            studentId: { type: 'string', format: 'uuid', description: 'Student this goal belongs to' },
            description: { type: 'string', description: 'Goal description' },
            baseline: { type: 'string', nullable: true, description: 'Baseline performance' },
            target: { type: 'string', nullable: true, description: 'Target/objective' },
            status: { type: 'string', enum: ['in-progress', 'met', 'not-met', 'discontinued'], description: 'Goal status' },
            priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Goal priority' },
            domain: { type: 'string', nullable: true, description: 'Speech/language domain' },
            targetDate: { type: 'string', format: 'date', nullable: true, description: 'Target completion date' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Session: {
          type: 'object',
          required: ['studentId', 'date'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            studentId: { type: 'string', format: 'uuid' },
            date: { type: 'string', format: 'date-time', description: 'Session date/time' },
            endTime: { type: 'string', format: 'date-time', nullable: true },
            goalsTargeted: { type: 'array', items: { type: 'string', format: 'uuid' }, description: 'Goals addressed in session' },
            activitiesUsed: { type: 'array', items: { type: 'string' }, description: 'Activities used' },
            performanceData: { type: 'array', items: { type: 'object' }, description: 'Performance tracking data' },
            notes: { type: 'string', nullable: true, description: 'Session notes' },
            isDirectServices: { type: 'boolean', description: 'Whether this is direct service' },
            missedSession: { type: 'boolean', description: 'Whether session was missed' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        School: {
          type: 'object',
          required: ['name'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', description: 'School name' },
            state: { type: 'string', description: 'State abbreviation' },
            teletherapy: { type: 'boolean', description: 'Whether school uses teletherapy' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Teacher: {
          type: 'object',
          required: ['name', 'schoolId'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', description: 'Teacher name' },
            email: { type: 'string', format: 'email', nullable: true },
            schoolId: { type: 'string', format: 'uuid' },
            grade: { type: 'string', nullable: true, description: 'Grade taught' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Backup: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: 'Backup filename' },
            size: { type: 'integer', description: 'File size in bytes' },
            sizeFormatted: { type: 'string', description: 'Human-readable file size' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        AuthStatus: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', description: 'Whether auth is enabled' },
            setup: { type: 'boolean', description: 'Whether a password has been set' },
            requiresLogin: { type: 'boolean', description: 'Whether login is required' },
            requiresSetup: { type: 'boolean', description: 'Whether initial setup is needed' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Students', description: 'Student management' },
      { name: 'Goals', description: 'Goal tracking' },
      { name: 'Sessions', description: 'Session documentation' },
      { name: 'Schools', description: 'School management' },
      { name: 'Teachers', description: 'Teacher contacts' },
      { name: 'Case Managers', description: 'Case manager management' },
      { name: 'Evaluations', description: 'Student evaluations' },
      { name: 'SOAP Notes', description: 'SOAP note generation' },
      { name: 'Progress Reports', description: 'Progress report management' },
      { name: 'Communications', description: 'Communication logs' },
      { name: 'Due Dates', description: 'Due date tracking' },
      { name: 'Backup', description: 'Database backup/restore' },
      { name: 'Auth', description: 'Authentication' },
      { name: 'Health', description: 'System health checks' },
    ],
  },
  apis: ['./src/routes/*.ts', './src/server.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  // Serve Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'SLP Caseload Tracker API',
  }));

  // Serve raw OpenAPI spec as JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

export { swaggerSpec };

