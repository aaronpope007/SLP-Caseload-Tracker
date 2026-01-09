/**
 * Database Backup Utility
 * 
 * Provides functions to create, list, and restore database backups.
 * Backups are stored in the ./data/backups directory.
 */

import fs from 'fs';
import path from 'path';
import { logger } from './logger';

const DATA_DIR = './data';
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'slp-caseload.db');

// Maximum number of backups to keep
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || '10', 10);

/**
 * Ensure the backup directory exists
 */
function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info({ path: BACKUP_DIR }, 'Created backup directory');
  }
}

/**
 * Generate a backup filename with timestamp
 */
function generateBackupFilename(): string {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
  return `backup_${timestamp}.db`;
}

/**
 * Create a backup of the database
 * @returns The path to the backup file, or null if backup failed
 */
export async function createBackup(): Promise<{ path: string; filename: string; size: number } | null> {
  ensureBackupDir();
  
  // Check if database exists
  if (!fs.existsSync(DB_FILE)) {
    logger.warn('Database file does not exist, cannot create backup');
    return null;
  }
  
  try {
    const filename = generateBackupFilename();
    const backupPath = path.join(BACKUP_DIR, filename);
    
    // Copy the database file
    fs.copyFileSync(DB_FILE, backupPath);
    
    const stats = fs.statSync(backupPath);
    
    logger.info({ 
      filename, 
      size: stats.size,
      path: backupPath 
    }, 'Database backup created');
    
    // Cleanup old backups
    await cleanupOldBackups();
    
    return {
      path: backupPath,
      filename,
      size: stats.size,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to create database backup');
    return null;
  }
}

/**
 * List all available backups
 */
export function listBackups(): Array<{
  filename: string;
  path: string;
  size: number;
  createdAt: Date;
}> {
  ensureBackupDir();
  
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db') && f.startsWith('backup_'))
      .map(filename => {
        const filePath = path.join(BACKUP_DIR, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          path: filePath,
          size: stats.size,
          createdAt: stats.mtime,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return files;
  } catch (error) {
    logger.error({ error }, 'Failed to list backups');
    return [];
  }
}

/**
 * Restore a database from a backup
 * @param filename The backup filename to restore
 * @returns true if restoration was successful
 */
export async function restoreBackup(filename: string): Promise<boolean> {
  const backupPath = path.join(BACKUP_DIR, filename);
  
  if (!fs.existsSync(backupPath)) {
    logger.warn({ filename }, 'Backup file not found');
    return false;
  }
  
  try {
    // Create a backup of current database before restoring
    const currentBackup = await createBackup();
    if (currentBackup) {
      logger.info({ 
        currentBackup: currentBackup.filename 
      }, 'Created backup of current database before restore');
    }
    
    // Copy backup to database location
    fs.copyFileSync(backupPath, DB_FILE);
    
    logger.info({ filename }, 'Database restored from backup');
    return true;
  } catch (error) {
    logger.error({ error, filename }, 'Failed to restore database from backup');
    return false;
  }
}

/**
 * Delete a specific backup
 * @param filename The backup filename to delete
 */
export function deleteBackup(filename: string): boolean {
  const backupPath = path.join(BACKUP_DIR, filename);
  
  if (!fs.existsSync(backupPath)) {
    return false;
  }
  
  try {
    fs.unlinkSync(backupPath);
    logger.info({ filename }, 'Backup deleted');
    return true;
  } catch (error) {
    logger.error({ error, filename }, 'Failed to delete backup');
    return false;
  }
}

/**
 * Clean up old backups, keeping only the most recent MAX_BACKUPS
 */
async function cleanupOldBackups(): Promise<void> {
  const backups = listBackups();
  
  if (backups.length <= MAX_BACKUPS) {
    return;
  }
  
  // Delete oldest backups
  const toDelete = backups.slice(MAX_BACKUPS);
  
  for (const backup of toDelete) {
    deleteBackup(backup.filename);
  }
  
  logger.info({ 
    deleted: toDelete.length, 
    remaining: MAX_BACKUPS 
  }, 'Cleaned up old backups');
}

/**
 * Get the path to a backup file
 * @param filename The backup filename
 */
export function getBackupPath(filename: string): string | null {
  const backupPath = path.join(BACKUP_DIR, filename);
  
  if (!fs.existsSync(backupPath)) {
    return null;
  }
  
  return backupPath;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

