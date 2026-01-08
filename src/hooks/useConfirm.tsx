import React, { useState, useCallback } from 'react';
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
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  onConfirm: () => void;
  onCancel?: () => void;
}

export const useConfirm = () => {
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string | React.ReactNode;
    confirmText: string;
    cancelText: string;
    confirmColor?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
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
      confirmColor: options.confirmColor,
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

  const ConfirmDialog = () => {
    const isDeleteAction = confirmState.title.toLowerCase().includes('delete');
    const buttonColor = confirmState.confirmColor || (isDeleteAction ? 'error' : 'primary');
    const messageContent = typeof confirmState.message === 'string' 
      ? <DialogContentText>{confirmState.message}</DialogContentText>
      : confirmState.message;
    
    return (
      <Dialog open={confirmState.open} onClose={handleCancel}>
        <DialogTitle>{confirmState.title}</DialogTitle>
        <DialogContent>
          {messageContent}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel}>{confirmState.cancelText}</Button>
          <Button 
            onClick={handleConfirm} 
            variant="contained" 
            color={buttonColor}
          >
            {confirmState.confirmText}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return { confirm, ConfirmDialog };
};

