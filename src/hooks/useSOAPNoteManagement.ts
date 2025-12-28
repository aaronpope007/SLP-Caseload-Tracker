import { useState, useCallback } from 'react';
import type { SOAPNote, Session } from '../types';
import { getSOAPNotesBySession, addSOAPNote, updateSOAPNote } from '../utils/storage-api';
import { logError } from '../utils/logger';

interface UseSOAPNoteManagementOptions {
  onNoteAdded?: (note: SOAPNote) => void;
  onNoteUpdated?: (note: SOAPNote) => void;
}

export const useSOAPNoteManagement = ({
  onNoteAdded,
  onNoteUpdated,
}: UseSOAPNoteManagementOptions = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const loadSOAPNotes = useCallback(async (sessionId: string): Promise<SOAPNote[]> => {
    setLoading(true);
    setError(undefined);
    try {
      const notes = await getSOAPNotesBySession(sessionId);
      return notes;
    } catch (err) {
      logError('Failed to load SOAP notes', err);
      setError('Failed to load SOAP notes');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createSOAPNote = useCallback(async (noteData: Partial<SOAPNote>): Promise<SOAPNote | null> => {
    try {
      const newNote = await addSOAPNote(noteData as SOAPNote);
      onNoteAdded?.(newNote);
      return newNote;
    } catch (err) {
      logError('Failed to create SOAP note', err);
      setError('Failed to create SOAP note');
      throw err;
    }
  }, [onNoteAdded]);

  const updateSOAPNoteById = useCallback(async (noteId: string, updates: Partial<SOAPNote>): Promise<SOAPNote | null> => {
    try {
      const updatedNote = await updateSOAPNote(noteId, updates);
      onNoteUpdated?.(updatedNote);
      return updatedNote;
    } catch (err) {
      logError('Failed to update SOAP note', err);
      setError('Failed to update SOAP note');
      throw err;
    }
  }, [onNoteUpdated]);

  return {
    loading,
    error,
    loadSOAPNotes,
    createSOAPNote,
    updateSOAPNote: updateSOAPNoteById,
  };
};

