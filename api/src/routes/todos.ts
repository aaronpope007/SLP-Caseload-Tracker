import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { createTodoSchema, updateTodoSchema } from '../schemas';

// Database row types
interface TodoRow {
  id: string;
  text: string;
  completed: number; // SQLite stores boolean as INTEGER (0 or 1)
  dateCreated: string;
  dateUpdated: string;
  completedDate: string | null;
}

export const todosRouter = Router();

// Helper to convert database row to API response
function parseTodoRow(row: TodoRow) {
  return {
    id: row.id,
    text: row.text,
    completed: row.completed === 1,
    dateCreated: row.dateCreated,
    dateUpdated: row.dateUpdated,
    completedDate: row.completedDate || undefined,
  };
}

// Get all todos
todosRouter.get('/', asyncHandler(async (_req, res) => {
  const todos = db.prepare('SELECT * FROM todos ORDER BY dateCreated DESC').all() as TodoRow[];
  res.json(todos.map(parseTodoRow));
}));

// Get todo by ID
todosRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid todo ID' });
  }
  
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow | undefined;
  
  if (!todo) {
    return res.status(404).json({ error: 'Todo not found' });
  }
  
  res.json(parseTodoRow(todo));
}));

// Create todo - with validation
todosRouter.post('/', validateBody(createTodoSchema), asyncHandler(async (req, res) => {
  const todo = req.body;
  
  // Generate ID if not provided
  const todoId = todo.id || `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  // Set completedDate if completed
  const completedDate = todo.completed ? now : null;
  
  db.prepare(`
    INSERT INTO todos (id, text, completed, dateCreated, dateUpdated, completedDate)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    todoId,
    todo.text,
    todo.completed ? 1 : 0,
    now,
    now,
    completedDate
  );
  
  res.status(201).json({ id: todoId, message: 'Todo created' });
}));

// Update todo - with validation
todosRouter.put('/:id', validateBody(updateTodoSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid todo ID' });
  }
  
  const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Todo not found' });
  }
  
  const now = new Date().toISOString();
  
  // Handle completion status
  let completed = existing.completed;
  let completedDate = existing.completedDate;
  
  if (updates.completed !== undefined) {
    completed = updates.completed ? 1 : 0;
    if (updates.completed && !existing.completedDate) {
      // Marking as completed
      completedDate = now;
    } else if (!updates.completed) {
      // Marking as not completed
      completedDate = null;
    }
  }
  
  const text = updates.text !== undefined ? updates.text : existing.text;
  
  db.prepare(`
    UPDATE todos 
    SET text = ?, completed = ?, dateUpdated = ?, completedDate = ?
    WHERE id = ?
  `).run(
    text,
    completed,
    now,
    completedDate,
    id
  );
  
  res.json({ message: 'Todo updated' });
}));

// Toggle todo completion
todosRouter.post('/:id/toggle', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid todo ID' });
  }
  
  const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow | undefined;
  
  if (!existing) {
    return res.status(404).json({ error: 'Todo not found' });
  }
  
  const now = new Date().toISOString();
  const newCompleted = existing.completed === 0 ? 1 : 0;
  const completedDate = newCompleted === 1 ? now : null;
  
  db.prepare(`
    UPDATE todos 
    SET completed = ?, completedDate = ?, dateUpdated = ?
    WHERE id = ?
  `).run(newCompleted, completedDate, now, id);
  
  res.json({ message: 'Todo toggled' });
}));

// Delete todo
todosRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid todo ID' });
  }
  
  const result = db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Todo not found' });
  }
  
  res.json({ message: 'Todo deleted' });
}));

