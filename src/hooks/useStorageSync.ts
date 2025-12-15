import { useEffect, useCallback } from 'react';
import { onStorageChange } from '../utils/storageSync';

/**
 * Hook to sync data across browser tabs
 * When data changes in another tab, the provided callback will be called
 */
export const useStorageSync = (callback: () => void, dependencies: React.DependencyList = []) => {
  useEffect(() => {
    const unsubscribe = onStorageChange(callback);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
};

