import { useCallback } from 'react';
import { useSnackbar } from './useSnackbar';

const GEMINI_API_KEY_STORAGE_KEY = 'gemini_api_key';

/**
 * Hook for managing AI generation features with Gemini API
 * Provides consistent API key management and error handling
 * 
 * @example
 * const { getApiKey, requireApiKey } = useAIGeneration();
 * 
 * const handleGenerate = async () => {
 *   const apiKey = requireApiKey(); // Shows error if missing
 *   if (!apiKey) return; // Early return if no key
 *   
 *   // Use apiKey for generation...
 * };
 */
export const useAIGeneration = () => {
  const { showSnackbar } = useSnackbar();

  /**
   * Gets the Gemini API key from localStorage
   * @returns The API key string or null if not set
   */
  const getApiKey = useCallback((): string | null => {
    return localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
  }, []);

  /**
   * Checks if an API key is set
   * @returns true if API key exists, false otherwise
   */
  const hasApiKey = useCallback((): boolean => {
    return !!getApiKey();
  }, [getApiKey]);

  /**
   * Gets the API key, showing an error snackbar if it's missing
   * @returns The API key string or null if not set (after showing error)
   */
  const requireApiKey = useCallback((): string | null => {
    const apiKey = getApiKey();
    if (!apiKey) {
      showSnackbar('Please set your Gemini API key in Settings', 'error');
      return null;
    }
    return apiKey;
  }, [getApiKey, showSnackbar]);

  return {
    getApiKey,
    hasApiKey,
    requireApiKey,
  };
};

