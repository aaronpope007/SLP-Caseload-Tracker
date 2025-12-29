/**
 * Migration utility to move timesheet notes from localStorage to API backend
 * This should be run once when migrating from localStorage to API storage
 */

import type { TimesheetNote } from '../types';
import { api } from './api';
import { logError, logInfo } from './logger';

const TIMESHEET_NOTES_STORAGE_KEY = 'slp_timesheet_notes';

/**
 * Migrates timesheet notes from localStorage to API backend
 * @returns Number of notes migrated
 */
export const migrateTimesheetNotes = async (): Promise<number> => {
  try {
    // Check if localStorage has data
    const data = localStorage.getItem(TIMESHEET_NOTES_STORAGE_KEY);
    if (!data) {
      logInfo('No timesheet notes in localStorage to migrate');
      return 0;
    }

    const notes: TimesheetNote[] = JSON.parse(data);
    if (notes.length === 0) {
      logInfo('No timesheet notes to migrate');
      return 0;
    }

    logInfo(`Migrating ${notes.length} timesheet notes from localStorage to API...`);

    let migratedCount = 0;
    let errorCount = 0;

    // Migrate each note to the API
    for (const note of notes) {
      try {
        // Check if note already exists in API (by ID)
        try {
          await api.timesheetNotes.getById(note.id);
          // Note exists, skip it
          logInfo(`Note ${note.id} already exists in API, skipping`);
          continue;
        } catch {
          // Note doesn't exist, create it
        }

        // Create the note in the API
        await api.timesheetNotes.create(note);
        migratedCount++;
        logInfo(`Migrated note ${note.id} (${migratedCount}/${notes.length})`);
      } catch (error) {
        errorCount++;
        logError(`Failed to migrate note ${note.id}`, error);
      }
    }

    // If all notes were successfully migrated, clear localStorage
    if (migratedCount === notes.length && errorCount === 0) {
      localStorage.removeItem(TIMESHEET_NOTES_STORAGE_KEY);
      logInfo(`✅ Successfully migrated ${migratedCount} timesheet notes and cleared localStorage`);
    } else {
      logInfo(`⚠️ Migrated ${migratedCount}/${notes.length} notes. ${errorCount} errors. localStorage not cleared.`);
    }

    return migratedCount;
  } catch (error) {
    logError('Failed to migrate timesheet notes', error);
    return 0;
  }
};

