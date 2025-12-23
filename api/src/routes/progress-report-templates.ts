import { Router } from 'express';
import { db } from '../db';

export const progressReportTemplatesRouter = Router();

// Get all templates (filterable by reportType)
progressReportTemplatesRouter.get('/', (req, res) => {
  try {
    const { reportType } = req.query;
    
    let query = 'SELECT * FROM progress_report_templates';
    const params: any[] = [];
    
    if (reportType) {
      query += ' WHERE reportType = ?';
      params.push(reportType as string);
    }
    
    query += ' ORDER BY name ASC';
    
    const templates = db.prepare(query).all(...params);
    
    // Parse sections JSON and isDefault
    const parsed = templates.map((t: any) => ({
      ...t,
      sections: t.sections ? JSON.parse(t.sections) : [],
      isDefault: t.isDefault === 1,
    }));
    
    res.json(parsed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get template by ID
progressReportTemplatesRouter.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const template = db.prepare('SELECT * FROM progress_report_templates WHERE id = ?').get(id) as any;
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({
      ...template,
      sections: template.sections ? JSON.parse(template.sections) : [],
      isDefault: template.isDefault === 1,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create template
progressReportTemplatesRouter.post('/', (req, res) => {
  try {
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
      JSON.stringify(template.sections || []),
      template.isDefault ? 1 : 0,
      template.dateCreated,
      template.dateUpdated
    );
    
    res.status(201).json({ id: template.id, message: 'Template created' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update template
progressReportTemplatesRouter.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = db.prepare('SELECT * FROM progress_report_templates WHERE id = ?').get(id) as any;
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
      JSON.stringify(template.sections || []),
      template.isDefault ? 1 : 0,
      template.dateUpdated,
      id
    );
    
    res.json({ message: 'Template updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Set template as default
progressReportTemplatesRouter.post('/:id/set-default', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM progress_report_templates WHERE id = ?').get(id) as any;
    
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete template
progressReportTemplatesRouter.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM progress_report_templates WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({ message: 'Template deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

