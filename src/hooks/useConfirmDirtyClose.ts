import { useCallback } from 'react';

export type ConfirmFn = (options: {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
}) => void;

export interface UseConfirmDirtyCloseOptions {
  confirm: ConfirmFn;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
}

const DEFAULT_TITLE = 'Unsaved Changes';
const DEFAULT_MESSAGE = 'You have unsaved changes. Are you sure you want to close without saving?';
const DEFAULT_CONFIRM_TEXT = 'Discard Changes';
const DEFAULT_CANCEL_TEXT = 'Cancel';

/**
 * Returns confirmIfDirty — call on cancel/backdrop close when a form may have unsaved edits.
 */
export const useConfirmDirtyClose = ({
  confirm,
  title = DEFAULT_TITLE,
  message = DEFAULT_MESSAGE,
  confirmText = DEFAULT_CONFIRM_TEXT,
  cancelText = DEFAULT_CANCEL_TEXT,
}: UseConfirmDirtyCloseOptions) => {
  const confirmIfDirty = useCallback(
    (isDirty: boolean | (() => boolean), onClose: () => void, forceClose = false) => {
      if (forceClose) {
        onClose();
        return;
      }
      const dirty = typeof isDirty === 'function' ? isDirty() : isDirty;
      if (dirty) {
        confirm({
          title,
          message,
          confirmText,
          cancelText,
          onConfirm: onClose,
        });
      } else {
        onClose();
      }
    },
    [confirm, title, message, confirmText, cancelText]
  );

  return { confirmIfDirty };
};
