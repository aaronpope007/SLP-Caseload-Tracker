import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export const useConfirm = () => {
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    open: false,
    title: 'Confirm',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: () => {},
  });

  const confirm = useCallback((options: ConfirmOptions) => {
    setConfirmState({
      open: true,
      title: options.title || 'Confirm',
      message: options.message,
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      onConfirm: options.onConfirm,
      onCancel: options.onCancel,
    });
  }, []);

  const handleConfirm = useCallback(() => {
    confirmState.onConfirm();
    setConfirmState((prev) => ({ ...prev, open: false }));
  }, [confirmState]);

  const handleCancel = useCallback(() => {
    if (confirmState.onCancel) {
      confirmState.onCancel();
    }
    setConfirmState((prev) => ({ ...prev, open: false }));
  }, [confirmState]);

  const ConfirmDialog = () => (
    <Dialog open={confirmState.open} onClose={handleCancel}>
      <DialogTitle>{confirmState.title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{confirmState.message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>{confirmState.cancelText}</Button>
        <Button onClick={handleConfirm} variant="contained" color="primary">
          {confirmState.confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return { confirm, ConfirmDialog };
};

