import { Router } from 'express';
import { db } from '../db';

export const dueDateItemsRouter = Router();

// Helper to update item status based on due date
function updateItemStatus(item: any): string {
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
dueDateItemsRouter.get('/', (req, res) => {
  try {
    const { studentId, status, category, startDate, endDate, school } = req.query;
    
    let query = 'SELECT * FROM due_date_items';
    const params: any[] = [];
    const conditions: string[] = [];

    if (studentId) {
      conditions.push('studentId = ?');
      params.push(studentId as string);
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status as string);
    }

    if (category) {
      conditions.push('category = ?');
      params.push(category as string);
    }

    if (startDate) {
      conditions.push('dueDate >= ?');
      params.push(startDate as string);
    }

    if (endDate) {
      conditions.push('dueDate <= ?');
      params.push(endDate as string);
    }

    if (school) {
      query = `
        SELECT ddi.* FROM due_date_items ddi
        INNER JOIN students s ON ddi.studentId = s.id
      `;
      conditions.push('s.school = ?');
      params.push(school as string);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY dueDate ASC, priority DESC';

    const items = db.prepare(query).all(...params);
    
    // Update status based on due date
    const parsed = items.map((item: any) => {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get upcoming/overdue items
dueDateItemsRouter.get('/upcoming', (req, res) => {
  try {
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
    const params: any[] = [cutoffDateStr, todayStr];

    if (school) {
      query = `
        SELECT ddi.* FROM due_date_items ddi
        INNER JOIN students s ON ddi.studentId = s.id
        WHERE ddi.status != 'completed' AND ddi.dueDate <= ? AND ddi.dueDate >= ? AND s.school = ?
      `;
      params.push(school as string);
    }

    query += ' ORDER BY dueDate ASC, priority DESC';

    const items = db.prepare(query).all(...params);
    
    const parsed = items.map((item: any) => {
      const updatedStatus = updateItemStatus(item);
      return {
        ...item,
        status: updatedStatus,
      };
    });

    res.json(parsed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get due date item by ID
dueDateItemsRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const item = db.prepare('SELECT * FROM due_date_items WHERE id = ?').get(id) as any;
    
    if (!item) {
      return res.status(404).json({ error: 'Due date item not found' });
    }
    
    const updatedStatus = updateItemStatus(item);
    res.json({
      ...item,
      status: updatedStatus,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create due date item
dueDateItemsRouter.post('/', (req, res) => {
  try {
    const item = req.body;
    
    // Determine initial status
    const dueDate = new Date(item.dueDate);
    const now = new Date();
    const initialStatus = dueDate < now ? 'overdue' : 'pending';
    
    db.prepare(`
      INSERT INTO due_date_items (
        id, title, description, dueDate, studentId, status, completedDate,
        category, priority, dateCreated, dateUpdated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id,
      item.title,
      item.description || null,
      item.dueDate,
      item.studentId || null,
      initialStatus,
      item.completedDate || null,
      item.category || null,
      item.priority || null,
      item.dateCreated,
      item.dateUpdated
    );
    
    res.status(201).json({ id: item.id, message: 'Due date item created' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update due date item
dueDateItemsRouter.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = db.prepare('SELECT * FROM due_date_items WHERE id = ?').get(id) as any;
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
      item.status = updateItemStatus({ ...item, completedDate: null });
    } else if (!item.completedDate) {
      // Recalculate status based on due date
      item.status = updateItemStatus(item);
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark item as completed
dueDateItemsRouter.post('/:id/complete', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM due_date_items WHERE id = ?').get(id) as any;
    
    if (!existing) {
      return res.status(404).json({ error: 'Due date item not found' });
    }
    
    db.prepare(`
      UPDATE due_date_items 
      SET status = 'completed', completedDate = ?, dateUpdated = ?
      WHERE id = ?
    `).run(new Date().toISOString(), new Date().toISOString(), id);
    
    res.json({ message: 'Due date item marked as completed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete due date item
dueDateItemsRouter.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM due_date_items WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Due date item not found' });
    }
    
    res.json({ message: 'Due date item deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

