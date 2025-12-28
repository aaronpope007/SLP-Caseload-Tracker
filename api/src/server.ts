import express from 'express';
import cors from 'cors';
import { initDatabase } from './db';
import { studentsRouter } from './routes/students';
import { goalsRouter } from './routes/goals';
import { sessionsRouter } from './routes/sessions';
import { activitiesRouter } from './routes/activities';
import { evaluationsRouter } from './routes/evaluations';
import { schoolsRouter } from './routes/schools';
import { teachersRouter } from './routes/teachers';
import { caseManagersRouter } from './routes/case-managers';
import { exportRouter } from './routes/export';
import { soapNotesRouter } from './routes/soap-notes';
import { progressReportsRouter } from './routes/progress-reports';
import { progressReportTemplatesRouter } from './routes/progress-report-templates';
import { dueDateItemsRouter } from './routes/due-date-items';
import { remindersRouter } from './routes/reminders';
import { emailRouter } from './routes/email';
import { communicationsRouter } from './routes/communications';
import { scheduledSessionsRouter } from './routes/scheduled-sessions';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initDatabase();

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/students', studentsRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/evaluations', evaluationsRouter);
app.use('/api/schools', schoolsRouter);
app.use('/api/teachers', teachersRouter);
app.use('/api/case-managers', caseManagersRouter);
app.use('/api/soap-notes', soapNotesRouter);
app.use('/api/export', exportRouter);
app.use('/api/progress-reports', progressReportsRouter);
app.use('/api/progress-report-templates', progressReportTemplatesRouter);
app.use('/api/due-date-items', dueDateItemsRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/email', emailRouter);
app.use('/api/communications', communicationsRouter);
app.use('/api/scheduled-sessions', scheduledSessionsRouter);

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Database location: ./data/slp-caseload.db`);
});

