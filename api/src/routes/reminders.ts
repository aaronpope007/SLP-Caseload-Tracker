import { Router } from 'express';
import { getAllReminders } from '../utils/reminders';

export const remindersRouter = Router();

// Get all reminders (optionally filtered by school)
remindersRouter.get('/', (req, res) => {
  try {
    const { school } = req.query;
    const reminders = getAllReminders(school as string | undefined);
    res.json(reminders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

