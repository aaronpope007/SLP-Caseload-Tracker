import express from 'express';
import cors from 'cors';
import { initDatabase } from './db';
import { studentsRouter } from './routes/students';
import { goalsRouter } from './routes/goals';
import { sessionsRouter } from './routes/sessions';
import { activitiesRouter } from './routes/activities';
import { evaluationsRouter } from './routes/evaluations';
import { schoolsRouter } from './routes/schools';
import { lunchesRouter } from './routes/lunches';
import { exportRouter } from './routes/export';
import { soapNotesRouter } from './routes/soap-notes';

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
app.use('/api/lunches', lunchesRouter);
app.use('/api/soap-notes', soapNotesRouter);
app.use('/api/export', exportRouter);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Database location: ./data/slp-caseload.db`);
});

