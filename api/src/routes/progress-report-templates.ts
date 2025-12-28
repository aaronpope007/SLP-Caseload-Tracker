import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { parseJsonField, stringifyJsonField } from '../utils/jsonHelpers';

// Database row types
interface ProgressReportTemplateRow {
  id: string;
  name: string;
  reportType: string;
  sections: string; // JSON string
  isDefault: number;
  dateCreated: string;
  dateUpdated: string;
}

export const progressReportTemplatesRouter = Router();

// Get all templates (filterable by reportType)
progressReportTemplatesRouter.get('/', asyncHandler(async (req, res) => {
  const { reportType } = req.query;
  
  let query = 'SELECT * FROM progress_report_templates';
  const params: string[] = [];
  
  if (reportType) {
    query += ' WHERE reportType = ?';
    params.push(reportType as string);
  }
  
  query += ' ORDER BY name ASC';
  
  const templates = db.prepare(query).all(...params) as ProgressReportTemplateRow[];
  
  // Parse sections JSON and isDefault
  const parsed = templates.map((t) => ({
    ...t,
    sections: parseJsonField<any[]>(t.sections, []),
    isDefault: t.isDefault === 1,
  }));
  
  res.json(parsed);
}));

// Get template by ID
progressReportTemplatesRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const template = db.prepare('SELECT * FROM progress_report_templates WHERE id = ?').get(id) as ProgressReportTemplateRow | undefined;
  
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }
  
  res.json({
    ...template,
    sections: parseJsonField<any[]>(template.sections, []),
    isDefault: template.isDefault === 1,
  });
}));

// Create template
progressReportTemplatesRouter.post('/', asyncHandler(async (req, res) => {
  const template = req.body;
  
  // If this is set as default, unset other defaults of the same type
  if (template.isDefault) {
    db.prepare(`
      UPDATE progress_report_templates 
      SET isDefault = 0 
      WHERE reportType = ? AND isDefault = 1
    `).run(template.reportType);
  }
  
  db.prepare(`
    INSERT INTO progress_report_templates (id, name, reportType, sections, isDefault, dateCreated, dateUpdated)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    template.id,
    template.name,
    template.reportType,
    stringifyJsonField(template.sections || []),
    template.isDefault ? 1 : 0,
    template.dateCreated,
    template.dateUpdated
  );
  
  res.status(201).json({ id: template.id, message: 'Template created' });
}));

// Update template
progressReportTemplatesRouter.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const existing = db.prepare('SELECT * FROM progress_report_templates WHERE id = ?').get(id) as ProgressReportTemplateRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Template not found' });
  }
  
  const template = { ...existing, ...updates, dateUpdated: new Date().toISOString() };
  
  // If this is set as default, unset other defaults of the same type
  if (template.isDefault) {
    db.prepare(`
      UPDATE progress_report_templates 
      SET isDefault = 0 
      WHERE reportType = ? AND isDefault = 1 AND id != ?
    `).run(template.reportType, id);
  }
  
  db.prepare(`
    UPDATE progress_report_templates 
    SET name = ?, reportType = ?, sections = ?, isDefault = ?, dateUpdated = ?
    WHERE id = ?
  `).run(
    template.name,
    template.reportType,
    stringifyJsonField(template.sections || []),
    template.isDefault ? 1 : 0,
    template.dateUpdated,
    id
  );
  
  res.json({ message: 'Template updated' });
}));

// Set template as default
progressReportTemplatesRouter.post('/:id/set-default', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM progress_report_templates WHERE id = ?').get(id) as ProgressReportTemplateRow | undefined;
  
  if (!existing) {
    return res.status(404).json({ error: 'Template not found' });
  }
  
  // Unset other defaults of the same type
  db.prepare(`
    UPDATE progress_report_templates 
    SET isDefault = 0 
    WHERE reportType = ? AND isDefault = 1
  `).run(existing.reportType);
  
  // Set this one as default
  db.prepare(`
    UPDATE progress_report_templates 
    SET isDefault = 1, dateUpdated = ?
    WHERE id = ?
  `).run(new Date().toISOString(), id);
  
  res.json({ message: 'Template set as default' });
}));

// Delete template
progressReportTemplatesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM progress_report_templates WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Template not found' });
  }
  
  res.json({ message: 'Template deleted' });
}));

