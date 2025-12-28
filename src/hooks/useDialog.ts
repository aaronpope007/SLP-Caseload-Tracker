import { useState, useCallback } from 'react';

/**
 * Hook for managing dialog open/close state
 * 
 * @example
 * const { open, openDialog, closeDialog } = useDialog();
 * 
 * <Dialog open={open} onClose={closeDialog}>
 *   ...
 * </Dialog>
 */
export const useDialog = () => {
  const [open, setOpen] = useState(false);

  const openDialog = useCallback(() => {
    setOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
  }, []);

  return {
    open,
    openDialog,
    closeDialog,
    setOpen, // Allow manual control if needed
  };
};

