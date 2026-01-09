/**
 * Database Backup Routes
 * 
 * Provides API endpoints for managing database backups:
 * - GET /api/backup - List all backups
 * - POST /api/backup - Create a new backup
 * - GET /api/backup/:filename - Download a backup
 * - DELETE /api/backup/:filename - Delete a backup
 * - POST /api/backup/:filename/restore - Restore from a backup
 */

import express from 'express';
import { 
  createBackup, 
  listBackups, 
  restoreBackup, 
  deleteBackup, 
  getBackupPath,
  formatFileSize,
} from '../utils/backup';
import { logger } from '../utils/logger';

export const backupRouter = express.Router();

/**
 * @openapi
 * /api/backup:
 *   get:
 *     tags: [Backup]
 *     summary: List all backups
 *     description: Returns a list of all available database backups
 *     responses:
 *       200:
 *         description: List of backups
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                 backups:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Backup'
 */
backupRouter.get('/', (req, res) => {
  try {
    const backups = listBackups();
    
    res.json({
      count: backups.length,
      backups: backups.map(b => ({
        filename: b.filename,
        size: b.size,
        sizeFormatted: formatFileSize(b.size),
        createdAt: b.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list backups');
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

/**
 * @openapi
 * /api/backup:
 *   post:
 *     tags: [Backup]
 *     summary: Create a new backup
 *     description: Creates a backup of the current database
 *     responses:
 *       201:
 *         description: Backup created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 filename:
 *                   type: string
 *                 size:
 *                   type: integer
 *                 sizeFormatted:
 *                   type: string
 *       500:
 *         description: Failed to create backup
 */
backupRouter.post('/', async (req, res) => {
  try {
    const result = await createBackup();
    
    if (result) {
      res.status(201).json({
        message: 'Backup created successfully',
        filename: result.filename,
        size: result.size,
        sizeFormatted: formatFileSize(result.size),
      });
    } else {
      res.status(500).json({ error: 'Failed to create backup' });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to create backup');
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

/**
 * GET /api/backup/:filename
 * Download a specific backup
 */
backupRouter.get('/:filename', (req, res) => {
  const { filename } = req.params;
  
  // Validate filename to prevent directory traversal
  if (!filename.match(/^backup_[\d-]+_[\d-]+\.db$/)) {
    res.status(400).json({ error: 'Invalid backup filename' });
    return;
  }
  
  const backupPath = getBackupPath(filename);
  
  if (!backupPath) {
    res.status(404).json({ error: 'Backup not found' });
    return;
  }
  
  res.download(backupPath, filename, (err) => {
    if (err) {
      logger.error({ error: err, filename }, 'Failed to download backup');
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download backup' });
      }
    }
  });
});

/**
 * DELETE /api/backup/:filename
 * Delete a specific backup
 */
backupRouter.delete('/:filename', (req, res) => {
  const { filename } = req.params;
  
  // Validate filename to prevent directory traversal
  if (!filename.match(/^backup_[\d-]+_[\d-]+\.db$/)) {
    res.status(400).json({ error: 'Invalid backup filename' });
    return;
  }
  
  const success = deleteBackup(filename);
  
  if (success) {
    res.json({ message: 'Backup deleted successfully' });
  } else {
    res.status(404).json({ error: 'Backup not found' });
  }
});

/**
 * POST /api/backup/:filename/restore
 * Restore the database from a specific backup
 * 
 * WARNING: This will replace the current database!
 * A backup of the current database will be created first.
 */
backupRouter.post('/:filename/restore', async (req, res) => {
  const { filename } = req.params;
  
  // Validate filename to prevent directory traversal
  if (!filename.match(/^backup_[\d-]+_[\d-]+\.db$/)) {
    res.status(400).json({ error: 'Invalid backup filename' });
    return;
  }
  
  try {
    const success = await restoreBackup(filename);
    
    if (success) {
      res.json({ 
        message: 'Database restored successfully. Please restart the server for changes to take effect.',
        warning: 'A backup of the previous database was created before restore.',
      });
    } else {
      res.status(404).json({ error: 'Backup not found or restore failed' });
    }
  } catch (error) {
    logger.error({ error, filename }, 'Failed to restore backup');
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

