// Cross-tab synchronization for localStorage
// This allows multiple browser tabs to stay in sync when data changes

type StorageChangeCallback = () => void;

const callbacks: Set<StorageChangeCallback> = new Set();

// Listen for storage changes from other tabs
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    // Only react to changes in our storage keys
    if (
      e.key &&
      (e.key.startsWith('slp_') || e.key === 'gemini_api_key')
    ) {
      // Notify all registered callbacks
      callbacks.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          console.error('Error in storage sync callback:', error);
        }
      });
    }
  });
}

/**
 * Register a callback to be called when storage changes in another tab
 */
export const onStorageChange = (callback: StorageChangeCallback): (() => void) => {
  callbacks.add(callback);
  
  // Return unsubscribe function
  return () => {
    callbacks.delete(callback);
  };
};

/**
 * Trigger a storage event manually (for same-tab notifications if needed)
 */
export const triggerStorageSync = (key: string) => {
  // Create a custom event that mimics the storage event
  // This is useful for notifying other parts of the same tab
  window.dispatchEvent(
    new StorageEvent('storage', {
      key,
      newValue: localStorage.getItem(key),
      oldValue: localStorage.getItem(key),
      storageArea: localStorage,
    })
  );
};

