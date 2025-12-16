import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';

interface UseDirtyOptions {
  isDirty: boolean;
  message?: string;
  onBeforeUnload?: boolean; // Warn on browser refresh/close
}

/**
 * Hook to track form dirty state and warn users when navigating away
 * @param options Configuration options
 * @returns Object with isDirty state and reset function
 */
export const useDirty = (options: UseDirtyOptions) => {
  const { isDirty, message = 'You have unsaved changes. Are you sure you want to leave?', onBeforeUnload = true } = options;
  const [shouldBlock, setShouldBlock] = useState(false);
  const isDirtyRef = useRef(isDirty);

  // Keep ref in sync
  useEffect(() => {
    isDirtyRef.current = isDirty;
    setShouldBlock(isDirty);
  }, [isDirty]);

  // Block navigation when dirty
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirtyRef.current && currentLocation.pathname !== nextLocation.pathname
  );

  // Handle browser refresh/close warning
  useEffect(() => {
    if (!onBeforeUnload) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [message, onBeforeUnload]);

  const reset = () => {
    isDirtyRef.current = false;
    setShouldBlock(false);
  };

  return {
    isDirty: shouldBlock,
    blocker,
    reset,
  };
};

