import { Router } from 'express';
import { getAllReminders } from '../utils/reminders';
import { asyncHandler } from '../middleware/asyncHandler';

export const remindersRouter = Router();

// Get all reminders (optionally filtered by school)
remindersRouter.get('/', asyncHandler(async (req, res) => {
  const { school } = req.query;
  const reminders = getAllReminders(school as string | undefined);
  res.json(reminders);
}));

