import { useCallback } from 'react';
import type { Session, SOAPNote } from '../types';
import { api } from '../utils/api';
import { getSOAPNotesBySession } from '../utils/storage-api';
import { logError } from '../utils/logger';

interface UseSOAPNoteGenerationParams {
  sessions: Session[];
  setSelectedSessionForSOAP: (session: Session) => void;
  setExistingSOAPNote: (note: SOAPNote | undefined) => void;
  openDialog: () => void;
}

export const useSOAPNoteGeneration = ({
  sessions,
  setSelectedSessionForSOAP,
  setExistingSOAPNote,
  openDialog,
}: UseSOAPNoteGenerationParams) => {
  const handleGenerateSOAP = useCallback(async (session: Session) => {
    try {
      // Fetch the latest session from the API to ensure we have the most recent data including customSubjective
      const latestSession = await api.sessions.getById(session.id);
      setSelectedSessionForSOAP(latestSession);
      // Check if SOAP note already exists for this session
      const existingNotes = await getSOAPNotesBySession(latestSession.id);
      if (existingNotes.length > 0) {
        setExistingSOAPNote(existingNotes[0]); // Use the first one if multiple exist
      } else {
        setExistingSOAPNote(undefined);
      }
      openDialog();
    } catch (error) {
      logError('Failed to fetch latest session', error);
      // Fallback to using the session from state or parameter
      const latestSession = sessions.find(s => s.id === session.id) || session;
      setSelectedSessionForSOAP(latestSession);
      try {
        const existingNotes = await getSOAPNotesBySession(latestSession.id);
        if (existingNotes.length > 0) {
          setExistingSOAPNote(existingNotes[0]);
        } else {
          setExistingSOAPNote(undefined);
        }
      } catch (err) {
        logError('Failed to fetch existing SOAP notes', err);
        setExistingSOAPNote(undefined);
      }
      openDialog();
    }
  }, [sessions, setSelectedSessionForSOAP, setExistingSOAPNote, openDialog]);

  return { handleGenerateSOAP };
};

