import { useCallback } from 'react';
import { logError } from '../utils/logger';

interface UseSessionDeleteParams {
  removeSession: (id: string) => Promise<void>;
  loadData: () => Promise<void>;
  showSnackbar: (message: string, severity: 'success' | 'error' | 'info' | 'warning') => void;
  confirm: (options: {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
  }) => void;
}

export const useSessionDelete = ({
  removeSession,
  loadData,
  showSnackbar,
  confirm,
}: UseSessionDeleteParams) => {
  const handleDelete = useCallback((id: string) => {
    confirm({
      title: 'Delete Session',
      message: 'Are you sure you want to delete this session? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await removeSession(id);
          await loadData();
          showSnackbar('Session deleted successfully', 'success');
        } catch (error) {
          logError('Failed to delete session', error);
          showSnackbar('Failed to delete session. Please try again.', 'error');
        }
      },
    });
  }, [removeSession, loadData, showSnackbar, confirm]);

  return { handleDelete };
};

