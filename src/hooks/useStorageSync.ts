import { useEffect, useRef } from 'react';
import { onStorageChange } from '../utils/storageSync';

/**
 * Hook to sync data across browser tabs
 * When data changes in another tab, the provided callback will be called
 * 
 * Note: The callback should be memoized with useCallback to prevent unnecessary re-subscriptions
 */
export const useStorageSync = (callback: () => void, dependencies: React.DependencyList = []) => {
  // Use ref to store the latest callback without re-subscribing
  const callbackRef = useRef(callback);
  
  // Update ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  useEffect(() => {
    // Create a stable wrapper that always calls the latest callback
    const stableCallback = () => {
      callbackRef.current();
    };
    
    const unsubscribe = onStorageChange(stableCallback);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
};

