import { Router } from 'express';
import { getAllReminders, dismissReminder } from '../utils/reminders';
import { asyncHandler } from '../middleware/asyncHandler';

export const remindersRouter = Router();

// Get all reminders (optionally filtered by school)
remindersRouter.get('/', asyncHandler(async (req, res) => {
  const { school } = req.query;
  const reminders = getAllReminders(school as string | undefined);
  res.json(reminders);
}));

// Dismiss a reminder
remindersRouter.post('/:id/dismiss', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type, studentId, relatedId, dismissedState } = req.body;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid reminder ID' });
  }
  
  if (!type || !studentId) {
    return res.status(400).json({ error: 'Missing required fields: type and studentId' });
  }
  
  dismissReminder(id, type, studentId, relatedId, dismissedState);
  
  res.json({ message: 'Reminder dismissed' });
}));

