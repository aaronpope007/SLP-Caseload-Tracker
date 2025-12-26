// Cross-tab synchronization for localStorage
// This allows multiple browser tabs to stay in sync when data changes

type StorageChangeCallback = () => void;

const callbacks: Set<StorageChangeCallback> = new Set();
let debounceTimer: number | null = null;
let pendingCallbacks: Set<StorageChangeCallback> = new Set();
let isProcessing = false;

// Debounce callback execution to prevent excessive calls
const executeCallbacks = () => {
  if (isProcessing || pendingCallbacks.size === 0) return;
  
  isProcessing = true;
  const callbacksToExecute = new Set(pendingCallbacks);
  pendingCallbacks.clear();
  
  // Use requestIdleCallback if available to avoid blocking the main thread
  const execute = () => {
    callbacksToExecute.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error('Error in storage sync callback:', error);
      }
    });
    isProcessing = false;
    
    // If more callbacks were added while processing, schedule another batch
    if (pendingCallbacks.size > 0) {
      scheduleCallbacks();
    }
  };
  
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    requestIdleCallback(execute, { timeout: 100 });
  } else {
    // Fallback to setTimeout for browsers without requestIdleCallback
    setTimeout(execute, 0);
  }
};

const scheduleCallbacks = () => {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    executeCallbacks();
  }, 100); // Debounce for 100ms
};

// Listen for storage changes from other tabs
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    // Only react to changes in our storage keys
    if (
      e.key &&
      (e.key.startsWith('slp_') || e.key === 'gemini_api_key')
    ) {
      // Add all callbacks to pending set
      callbacks.forEach((callback) => {
        pendingCallbacks.add(callback);
      });
      
      // Schedule execution with debouncing
      scheduleCallbacks();
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
    pendingCallbacks.delete(callback);
  };
};

/**
 * Trigger a storage event manually (for same-tab notifications if needed)
 * Note: This will NOT trigger the storage event listener (which only fires for cross-tab changes)
 * Instead, it directly schedules callbacks to prevent infinite loops
 */
export const triggerStorageSync = (key: string) => {
  // Only trigger if it's one of our keys
  if (!key || (!key.startsWith('slp_') && key !== 'gemini_api_key')) {
    return;
  }
  
  // Directly schedule callbacks instead of dispatching a fake storage event
  // This prevents infinite loops and unnecessary event processing
  callbacks.forEach((callback) => {
    pendingCallbacks.add(callback);
  });
  
  scheduleCallbacks();
};

