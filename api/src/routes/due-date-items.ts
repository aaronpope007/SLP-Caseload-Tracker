import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { createDueDateItemSchema, updateDueDateItemSchema } from '../schemas';

// Database row types
interface DueDateItemRow {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  studentId: string | null;
  status: string;
  completedDate: string | null;
  category: string | null;
  priority: string | null;
  dateCreated: string;
  dateUpdated: string;
}

export const dueDateItemsRouter = Router();

// Helper to update item status based on due date
function updateItemStatus(item: DueDateItemRow): string {
  if (item.status === 'completed') {
    return 'completed';
  }
  
  const dueDate = new Date(item.dueDate);
  const now = new Date();
  
  if (dueDate < now) {
    return 'overdue';
  }
  
  return 'pending';
}

// Update statuses before handling requests
dueDateItemsRouter.use((_req, _res, next) => {
  try {
    // Update overdue items
    const now = new Date().toISOString().split('T')[0];
    db.prepare(`
      UPDATE due_date_items 
      SET status = 'overdue', dateUpdated = ?
      WHERE status = 'pending' AND dueDate < ? AND (completedDate IS NULL OR completedDate = '')
    `).run(new Date().toISOString(), now);
  } catch (e) {
    // Ignore errors in middleware
  }
  next();
});

// Get all due date items (filterable by studentId, status, category, date range)
dueDateItemsRouter.get('/', asyncHandler(async (req, res) => {
  const { studentId, status, category, startDate, endDate, school } = req.query;
  
  let query = 'SELECT * FROM due_date_items';
  const params: string[] = [];
  const conditions: string[] = [];

  if (studentId && typeof studentId === 'string') {
    conditions.push('studentId = ?');
    params.push(studentId);
  }

  if (status && typeof status === 'string') {
    conditions.push('status = ?');
    params.push(status);
  }

  if (category && typeof category === 'string') {
    conditions.push('category = ?');
    params.push(category);
  }

  if (startDate && typeof startDate === 'string') {
    conditions.push('dueDate >= ?');
    params.push(startDate);
  }

  if (endDate && typeof endDate === 'string') {
    conditions.push('dueDate <= ?');
    params.push(endDate);
  }

  if (school && typeof school === 'string') {
    query = `
      SELECT ddi.* FROM due_date_items ddi
      INNER JOIN students s ON ddi.studentId = s.id
    `;
    conditions.push('s.school = ?');
    params.push(school);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY dueDate ASC, priority DESC';

  const items = db.prepare(query).all(...params) as DueDateItemRow[];
  
  // Update status based on due date
  const parsed = items.map((item) => {
    const updatedStatus = updateItemStatus(item);
    if (updatedStatus !== item.status) {
      // Update in database
      db.prepare('UPDATE due_date_items SET status = ?, dateUpdated = ? WHERE id = ?')
        .run(updatedStatus, new Date().toISOString(), item.id);
    }
    return {
      ...item,
      status: updatedStatus,
    };
  });

  res.json(parsed);
}));

// Get upcoming/overdue items
dueDateItemsRouter.get('/upcoming', asyncHandler(async (req, res) => {
  const { days = '30', school } = req.query;
  const daysNum = parseInt(days as string, 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + daysNum);
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];

  let query = `
    SELECT * FROM due_date_items
    WHERE status != 'completed' AND dueDate <= ? AND dueDate >= ?
  `;
  const params: string[] = [cutoffDateStr, todayStr];

  if (school && typeof school === 'string') {
    query = `
      SELECT ddi.* FROM due_date_items ddi
      INNER JOIN students s ON ddi.studentId = s.id
      WHERE ddi.status != 'completed' AND ddi.dueDate <= ? AND ddi.dueDate >= ? AND s.school = ?
    `;
    params.push(school);
  }

  query += ' ORDER BY dueDate ASC, priority DESC';

  const items = db.prepare(query).all(...params) as DueDateItemRow[];
  
  const parsed = items.map((item) => {
    const updatedStatus = updateItemStatus(item);
    return {
      ...item,
      status: updatedStatus,
    };
  });

  res.json(parsed);
}));

// Get due date item by ID
dueDateItemsRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid due date item ID' });
  }
  
  const item = db.prepare('SELECT * FROM due_date_items WHERE id = ?').get(id) as DueDateItemRow | undefined;
  
  if (!item) {
    return res.status(404).json({ error: 'Due date item not found' });
  }
  
  const updatedStatus = updateItemStatus(item);
  res.json({
    ...item,
    status: updatedStatus,
  });
}));

// Create due date item - with validation
dueDateItemsRouter.post('/', validateBody(createDueDateItemSchema), asyncHandler(async (req, res) => {
  const item = req.body;
  
  // Generate ID if not provided
  const itemId = item.id || `ddi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  // Determine initial status
  const dueDate = new Date(item.dueDate);
  const today = new Date();
  const initialStatus = dueDate < today ? 'overdue' : 'pending';
  
  db.prepare(`
    INSERT INTO due_date_items (
      id, title, description, dueDate, studentId, status, completedDate,
      category, priority, dateCreated, dateUpdated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    itemId,
    item.title,
    item.description || null,
    item.dueDate,
    item.studentId || null,
    initialStatus,
    item.completedDate || null,
    item.category || null,
    item.priority || null,
    now,
    now
  );
  
  res.status(201).json({ id: itemId, message: 'Due date item created' });
}));

// Update due date item - with validation
dueDateItemsRouter.put('/:id', validateBody(updateDueDateItemSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid due date item ID' });
  }
  
  const existing = db.prepare('SELECT * FROM due_date_items WHERE id = ?').get(id) as DueDateItemRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Due date item not found' });
  }
  
  const item = { ...existing, ...updates, dateUpdated: new Date().toISOString() };
  
  // Update status if completed
  if (updates.status === 'completed' && !item.completedDate) {
    item.completedDate = new Date().toISOString();
    item.status = 'completed';
  } else if (updates.status !== 'completed' && item.completedDate) {
    // If uncompleting, clear completed date and recalculate status
    item.completedDate = null;
    item.status = updateItemStatus({ ...item, completedDate: null } as DueDateItemRow);
  } else if (!item.completedDate) {
    // Recalculate status based on due date
    item.status = updateItemStatus(item as DueDateItemRow);
  }
  
  db.prepare(`
    UPDATE due_date_items 
    SET title = ?, description = ?, dueDate = ?, studentId = ?, status = ?,
        completedDate = ?, category = ?, priority = ?, dateUpdated = ?
    WHERE id = ?
  `).run(
    item.title,
    item.description || null,
    item.dueDate,
    item.studentId || null,
    item.status,
    item.completedDate || null,
    item.category || null,
    item.priority || null,
    item.dateUpdated,
    id
  );
  
  res.json({ message: 'Due date item updated' });
}));

// Mark item as completed
dueDateItemsRouter.post('/:id/complete', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid due date item ID' });
  }
  
  const existing = db.prepare('SELECT * FROM due_date_items WHERE id = ?').get(id) as DueDateItemRow | undefined;
  
  if (!existing) {
    return res.status(404).json({ error: 'Due date item not found' });
  }
  
  db.prepare(`
    UPDATE due_date_items 
    SET status = 'completed', completedDate = ?, dateUpdated = ?
    WHERE id = ?
  `).run(new Date().toISOString(), new Date().toISOString(), id);
  
  res.json({ message: 'Due date item marked as completed' });
}));

// Delete due date item
dueDateItemsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid due date item ID' });
  }
  
  const result = db.prepare('DELETE FROM due_date_items WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Due date item not found' });
  }
  
  res.json({ message: 'Due date item deleted' });
}));
