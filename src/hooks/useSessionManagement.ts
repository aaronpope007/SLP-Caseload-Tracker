import { useState, useCallback } from 'react';
import type { Session } from '../types';
import { getSessions, addSession, updateSession, deleteSession } from '../utils/storage-api';
import { logError } from '../utils/logger';

interface UseSessionManagementOptions {
  school?: string;
  onSessionAdded?: (session: Session) => void;
  onSessionUpdated?: (session: Session) => void;
  onSessionDeleted?: (sessionId: string) => void;
}

export const useSessionManagement = ({
  school,
  onSessionAdded,
  onSessionUpdated,
  onSessionDeleted,
}: UseSessionManagementOptions) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const loadedSessions = await getSessions(undefined, school);
      setSessions(loadedSessions);
    } catch (err) {
      logError('Failed to load sessions', err);
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [school]);

  const createSession = useCallback(async (sessionData: Partial<Session>): Promise<Session | null> => {
    try {
      const fullSession = {
        ...sessionData,
        school,
      } as Session;
      
      await addSession(fullSession);
      
      setSessions((prev) => [...prev, fullSession]);
      onSessionAdded?.(fullSession);
      return fullSession;
    } catch (err) {
      logError('Failed to create session', err);
      setError('Failed to create session');
      throw err;
    }
  }, [school, onSessionAdded]);

  const updateSessionById = useCallback(async (sessionId: string, updates: Partial<Session>): Promise<Session | null> => {
    try {
      const updatedSession = await updateSession(sessionId, updates);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updatedSession : s)));
      onSessionUpdated?.(updatedSession);
      return updatedSession;
    } catch (err) {
      logError('Failed to update session', err);
      setError('Failed to update session');
      throw err;
    }
  }, [onSessionUpdated]);

  const removeSession = useCallback(async (sessionId: string): Promise<void> => {
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      onSessionDeleted?.(sessionId);
    } catch (err) {
      logError('Failed to delete session', err);
      setError('Failed to delete session');
      throw err;
    }
  }, [onSessionDeleted]);

  return {
    sessions,
    loading,
    error,
    loadSessions,
    createSession,
    updateSession: updateSessionById,
    deleteSession: removeSession,
    setSessions, // Allow manual updates if needed
  };
};

