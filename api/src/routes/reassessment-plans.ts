import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { 
  createReassessmentPlanSchema, 
  updateReassessmentPlanSchema,
  createReassessmentPlanItemSchema,
  updateReassessmentPlanItemSchema,
  createReassessmentPlanTemplateSchema,
  updateReassessmentPlanTemplateSchema
} from '../schemas';
import { parseJsonField, stringifyJsonField } from '../utils/jsonHelpers';

// Database row types
interface ReassessmentPlanRow {
  id: string;
  studentId: string;
  evaluationId: string | null;
  title: string;
  description: string | null;
  dueDate: string;
  status: string;
  templateId: string | null;
  dateCreated: string;
  dateUpdated: string;
}

interface ReassessmentPlanItemRow {
  id: string;
  planId: string;
  description: string;
  dueDate: string;
  completed: number; // SQLite boolean (0 or 1)
  completedDate: string | null;
  order_index: number;
  dateCreated: string;
  dateUpdated: string;
}

interface ReassessmentPlanTemplateRow {
  id: string;
  name: string;
  description: string | null;
  items: string; // JSON string
  dateCreated: string;
  dateUpdated: string;
}

export const reassessmentPlansRouter = Router();

// ============================================================================
// Reassessment Plans Routes
// ============================================================================

// Get all plans (optionally filtered by studentId, evaluationId, or school)
reassessmentPlansRouter.get('/', asyncHandler(async (req, res) => {
  const { studentId, evaluationId, school, status } = req.query;
  
  let query = 'SELECT * FROM reassessment_plans';
  const params: string[] = [];
  const conditions: string[] = [];
  
  if (studentId && typeof studentId === 'string') {
    conditions.push('studentId = ?');
    params.push(studentId);
  }
  
  if (evaluationId && typeof evaluationId === 'string') {
    conditions.push('evaluationId = ?');
    params.push(evaluationId);
  }
  
  if (status && typeof status === 'string') {
    conditions.push('status = ?');
    params.push(status);
  }
  
  if (school && typeof school === 'string') {
    query = `
      SELECT rp.* FROM reassessment_plans rp
      INNER JOIN students s ON rp.studentId = s.id
    `;
    // Use TRIM and UPPER for case-insensitive matching (SQLite is case-sensitive by default)
    conditions.push('TRIM(UPPER(s.school)) = TRIM(UPPER(?))');
    params.push(school);
    
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY dueDate ASC';
  
  const plans = db.prepare(query).all(...params) as ReassessmentPlanRow[];
  res.json(plans);
}));

// Get plan by ID (with items)
reassessmentPlansRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid plan ID' });
  }
  
  const plan = db.prepare('SELECT * FROM reassessment_plans WHERE id = ?').get(id) as ReassessmentPlanRow | undefined;
  
  if (!plan) {
    return res.status(404).json({ error: 'Reassessment plan not found' });
  }
  
  const items = db.prepare('SELECT * FROM reassessment_plan_items WHERE planId = ? ORDER BY order_index ASC')
    .all(id) as ReassessmentPlanItemRow[];
  
  res.json({
    ...plan,
    items: items.map(item => ({
      id: item.id,
      planId: item.planId,
      description: item.description,
      dueDate: item.dueDate,
      completed: item.completed === 1,
      completedDate: item.completedDate,
      order: item.order_index,
      dateCreated: item.dateCreated,
      dateUpdated: item.dateUpdated,
    })),
  });
}));

// Create plan
reassessmentPlansRouter.post('/', validateBody(createReassessmentPlanSchema), asyncHandler(async (req, res) => {
  const plan = req.body;
  
  // Verify student exists
  const student = db.prepare('SELECT id FROM students WHERE id = ?').get(plan.studentId);
  if (!student) {
    return res.status(400).json({ error: 'Student not found', details: [{ field: 'studentId', message: 'Student does not exist' }] });
  }
  
  // Verify evaluation exists if provided
  if (plan.evaluationId) {
    const evaluation = db.prepare('SELECT id FROM evaluations WHERE id = ?').get(plan.evaluationId);
    if (!evaluation) {
      return res.status(400).json({ error: 'Evaluation not found', details: [{ field: 'evaluationId', message: 'Evaluation does not exist' }] });
    }
  }
  
  const planId = plan.id || `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO reassessment_plans (id, studentId, evaluationId, title, description, dueDate, status, templateId, dateCreated, dateUpdated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    planId,
    plan.studentId,
    plan.evaluationId || null,
    plan.title,
    plan.description || null,
    plan.dueDate,
    plan.status || 'pending',
    plan.templateId || null,
    now,
    now
  );
  
  res.status(201).json({ id: planId, message: 'Reassessment plan created' });
}));

// Update plan
reassessmentPlansRouter.put('/:id', validateBody(updateReassessmentPlanSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid plan ID' });
  }
  
  const existing = db.prepare('SELECT * FROM reassessment_plans WHERE id = ?').get(id) as ReassessmentPlanRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Reassessment plan not found' });
  }
  
  // Verify student exists if being updated
  if (updates.studentId && updates.studentId !== existing.studentId) {
    const student = db.prepare('SELECT id FROM students WHERE id = ?').get(updates.studentId);
    if (!student) {
      return res.status(400).json({ error: 'Student not found', details: [{ field: 'studentId', message: 'Student does not exist' }] });
    }
  }
  
  // Verify evaluation exists if being updated
  if (updates.evaluationId !== undefined && updates.evaluationId !== existing.evaluationId) {
    if (updates.evaluationId) {
      const evaluation = db.prepare('SELECT id FROM evaluations WHERE id = ?').get(updates.evaluationId);
      if (!evaluation) {
        return res.status(400).json({ error: 'Evaluation not found', details: [{ field: 'evaluationId', message: 'Evaluation does not exist' }] });
      }
    }
  }
  
  const updatedPlan = { ...existing, ...updates, dateUpdated: new Date().toISOString() };
  
  db.prepare(`
    UPDATE reassessment_plans 
    SET studentId = ?, evaluationId = ?, title = ?, description = ?, dueDate = ?, status = ?, templateId = ?, dateUpdated = ?
    WHERE id = ?
  `).run(
    updatedPlan.studentId,
    updatedPlan.evaluationId || null,
    updatedPlan.title,
    updatedPlan.description || null,
    updatedPlan.dueDate,
    updatedPlan.status,
    updatedPlan.templateId || null,
    updatedPlan.dateUpdated,
    id
  );
  
  res.json({ message: 'Reassessment plan updated' });
}));

// Delete plan (cascades to items)
reassessmentPlansRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid plan ID' });
  }
  
  const result = db.prepare('DELETE FROM reassessment_plans WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Reassessment plan not found' });
  }
  
  res.json({ message: 'Reassessment plan deleted' });
}));

// ============================================================================
// Reassessment Plan Items Routes
// ============================================================================

// Get items for a plan
reassessmentPlansRouter.get('/:planId/items', asyncHandler(async (req, res) => {
  const { planId } = req.params;
  
  if (!planId || typeof planId !== 'string') {
    return res.status(400).json({ error: 'Invalid plan ID' });
  }
  
  const items = db.prepare('SELECT * FROM reassessment_plan_items WHERE planId = ? ORDER BY order_index ASC')
    .all(planId) as ReassessmentPlanItemRow[];
  
  res.json(items.map(item => ({
    id: item.id,
    planId: item.planId,
    description: item.description,
    dueDate: item.dueDate,
    completed: item.completed === 1,
    completedDate: item.completedDate,
    order: item.order_index,
    dateCreated: item.dateCreated,
    dateUpdated: item.dateUpdated,
  })));
}));

// Get incomplete items for a student
reassessmentPlansRouter.get('/student/:studentId/incomplete-items', asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  
  if (!studentId || typeof studentId !== 'string') {
    return res.status(400).json({ error: 'Invalid student ID' });
  }
  
  const items = db.prepare(`
    SELECT rpi.*, rp.title as planTitle, rp.dueDate as planDueDate
    FROM reassessment_plan_items rpi
    INNER JOIN reassessment_plans rp ON rpi.planId = rp.id
    WHERE rp.studentId = ? AND rpi.completed = 0
    ORDER BY rpi.dueDate ASC, rpi.order_index ASC
  `).all(studentId) as (ReassessmentPlanItemRow & { planTitle: string; planDueDate: string })[];
  
  res.json(items.map(item => ({
    id: item.id,
    planId: item.planId,
    planTitle: item.planTitle,
    planDueDate: item.planDueDate,
    description: item.description,
    dueDate: item.dueDate,
    completed: false,
    completedDate: item.completedDate,
    order: item.order_index,
    dateCreated: item.dateCreated,
    dateUpdated: item.dateUpdated,
  })));
}));

// Create item
reassessmentPlansRouter.post('/:planId/items', validateBody(createReassessmentPlanItemSchema.omit({ planId: true })), asyncHandler(async (req, res) => {
  const { planId } = req.params;
  const item = req.body;
  
  if (!planId || typeof planId !== 'string') {
    return res.status(400).json({ error: 'Invalid plan ID' });
  }
  
  // Verify plan exists
  const plan = db.prepare('SELECT id FROM reassessment_plans WHERE id = ?').get(planId);
  if (!plan) {
    return res.status(404).json({ error: 'Reassessment plan not found' });
  }
  
  const itemId = item.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO reassessment_plan_items (id, planId, description, dueDate, completed, completedDate, order_index, dateCreated, dateUpdated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    itemId,
    planId,
    item.description,
    item.dueDate,
    item.completed ? 1 : 0,
    item.completedDate || null,
    item.order ?? 0,
    now,
    now
  );
  
  res.status(201).json({ id: itemId, message: 'Reassessment plan item created' });
}));

// Update item
reassessmentPlansRouter.put('/items/:id', validateBody(updateReassessmentPlanItemSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid item ID' });
  }
  
  const existing = db.prepare('SELECT * FROM reassessment_plan_items WHERE id = ?').get(id) as ReassessmentPlanItemRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Reassessment plan item not found' });
  }
  
  const updatedItem = { 
    ...existing, 
    ...updates, 
    dateUpdated: new Date().toISOString(),
    completed: updates.completed !== undefined ? (updates.completed ? 1 : 0) : existing.completed,
    completedDate: updates.completed === true ? (updates.completedDate || new Date().toISOString()) : (updates.completed === false ? null : existing.completedDate),
  };
  
  db.prepare(`
    UPDATE reassessment_plan_items 
    SET planId = ?, description = ?, dueDate = ?, completed = ?, completedDate = ?, order_index = ?, dateUpdated = ?
    WHERE id = ?
  `).run(
    updatedItem.planId,
    updatedItem.description,
    updatedItem.dueDate,
    updatedItem.completed,
    updatedItem.completedDate,
    updatedItem.order_index,
    updatedItem.dateUpdated,
    id
  );
  
  // Update plan status if all items are completed
  const allItems = db.prepare('SELECT completed FROM reassessment_plan_items WHERE planId = ?')
    .all(updatedItem.planId) as { completed: number }[];
  const allCompleted = allItems.length > 0 && allItems.every(item => item.completed === 1);
  
  if (allCompleted) {
    db.prepare('UPDATE reassessment_plans SET status = ?, dateUpdated = ? WHERE id = ?')
      .run('completed', new Date().toISOString(), updatedItem.planId);
  } else {
    // Check if plan should be in-progress (has at least one completed item)
    const hasCompleted = allItems.some(item => item.completed === 1);
    if (hasCompleted) {
      db.prepare('UPDATE reassessment_plans SET status = ?, dateUpdated = ? WHERE id = ?')
        .run('in-progress', new Date().toISOString(), updatedItem.planId);
    }
  }
  
  res.json({ message: 'Reassessment plan item updated' });
}));

// Delete item
reassessmentPlansRouter.delete('/items/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid item ID' });
  }
  
  const result = db.prepare('DELETE FROM reassessment_plan_items WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Reassessment plan item not found' });
  }
  
  res.json({ message: 'Reassessment plan item deleted' });
}));

// ============================================================================
// Reassessment Plan Templates Routes
// ============================================================================

// Get all templates
reassessmentPlansRouter.get('/templates/all', asyncHandler(async (req, res) => {
  const templates = db.prepare('SELECT * FROM reassessment_plan_templates ORDER BY name ASC')
    .all() as ReassessmentPlanTemplateRow[];
  
  res.json(templates.map(template => ({
    id: template.id,
    name: template.name,
    description: template.description,
    items: parseJsonField(template.items, []),
    dateCreated: template.dateCreated,
    dateUpdated: template.dateUpdated,
  })));
}));

// Get template by ID
reassessmentPlansRouter.get('/templates/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid template ID' });
  }
  
  const template = db.prepare('SELECT * FROM reassessment_plan_templates WHERE id = ?')
    .get(id) as ReassessmentPlanTemplateRow | undefined;
  
  if (!template) {
    return res.status(404).json({ error: 'Reassessment plan template not found' });
  }
  
  res.json({
    id: template.id,
    name: template.name,
    description: template.description,
    items: parseJsonField(template.items, []),
    dateCreated: template.dateCreated,
    dateUpdated: template.dateUpdated,
  });
}));

// Create template
reassessmentPlansRouter.post('/templates', validateBody(createReassessmentPlanTemplateSchema), asyncHandler(async (req, res) => {
  const template = req.body;
  
  const templateId = template.id || `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO reassessment_plan_templates (id, name, description, items, dateCreated, dateUpdated)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    templateId,
    template.name,
    template.description || null,
    stringifyJsonField(template.items),
    now,
    now
  );
  
  res.status(201).json({ id: templateId, message: 'Reassessment plan template created' });
}));

// Update template
reassessmentPlansRouter.put('/templates/:id', validateBody(updateReassessmentPlanTemplateSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid template ID' });
  }
  
  const existing = db.prepare('SELECT * FROM reassessment_plan_templates WHERE id = ?')
    .get(id) as ReassessmentPlanTemplateRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Reassessment plan template not found' });
  }
  
  const updatedTemplate = { ...existing, ...updates, dateUpdated: new Date().toISOString() };
  
  db.prepare(`
    UPDATE reassessment_plan_templates 
    SET name = ?, description = ?, items = ?, dateUpdated = ?
    WHERE id = ?
  `).run(
    updatedTemplate.name,
    updatedTemplate.description || null,
    updates.items ? stringifyJsonField(updates.items) : existing.items,
    updatedTemplate.dateUpdated,
    id
  );
  
  res.json({ message: 'Reassessment plan template updated' });
}));

// Delete template
reassessmentPlansRouter.delete('/templates/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid template ID' });
  }
  
  const result = db.prepare('DELETE FROM reassessment_plan_templates WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Reassessment plan template not found' });
  }
  
  res.json({ message: 'Reassessment plan template deleted' });
}));
