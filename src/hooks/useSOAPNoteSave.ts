import { useCallback } from 'react';
import type { SOAPNote } from '../types';
import { logError } from '../utils/logger';

interface UseSOAPNoteSaveParams {
  existingSOAPNote: SOAPNote | undefined;
  createSOAPNote: (note: SOAPNote) => Promise<void>;
  updateSOAPNote: (id: string, note: SOAPNote) => Promise<void>;
  closeDialog: () => void;
  setSelectedSessionForSOAP: (session: any) => void;
  setExistingSOAPNote: (note: SOAPNote | undefined) => void;
  showSnackbar: (message: string, severity: 'success' | 'error' | 'info' | 'warning') => void;
}

export const useSOAPNoteSave = ({
  existingSOAPNote,
  createSOAPNote,
  updateSOAPNote,
  closeDialog,
  setSelectedSessionForSOAP,
  setExistingSOAPNote,
  showSnackbar,
}: UseSOAPNoteSaveParams) => {
  const handleSaveSOAPNote = useCallback(async (soapNote: SOAPNote) => {
    try {
      if (existingSOAPNote) {
        await updateSOAPNote(soapNote.id, soapNote);
      } else {
        await createSOAPNote(soapNote);
      }
      closeDialog();
      setSelectedSessionForSOAP(null);
      setExistingSOAPNote(undefined);
      showSnackbar('SOAP note saved successfully', 'success');
    } catch (error) {
      logError('Failed to save SOAP note', error);
      showSnackbar('Failed to save SOAP note. Please try again.', 'error');
    }
  }, [
    existingSOAPNote,
    createSOAPNote,
    updateSOAPNote,
    closeDialog,
    setSelectedSessionForSOAP,
    setExistingSOAPNote,
    showSnackbar,
  ]);

  return { handleSaveSOAPNote };
};

