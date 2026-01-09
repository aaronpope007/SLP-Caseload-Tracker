/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the app.
 * Handles login, logout, and auth status checking.
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, setAuthToken } from '../utils/api';
import { logError } from '../utils/logger';

interface AuthStatus {
  enabled: boolean;
  setup: boolean;
  requiresLogin: boolean;
  requiresSetup: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  authStatus: AuthStatus | null;
  login: (password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setup: (password: string) => Promise<{ success: boolean; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);

  // Check authentication status on mount
  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      const status = await api.auth.status();
      setAuthStatus(status);
      
      // If auth is not enabled or not required, consider authenticated
      if (!status.enabled || !status.requiresLogin) {
        setIsAuthenticated(true);
        return;
      }
      
      // Check if we have a valid token
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Try a simple API call to verify token is valid
        try {
          await api.schools.getAll();
          setIsAuthenticated(true);
        } catch (error: any) {
          if (error?.status === 401) {
            // Token is invalid, remove it
            setAuthToken(null);
            setIsAuthenticated(false);
          } else {
            // Other error, might still be authenticated
            setIsAuthenticated(true);
          }
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      logError('Failed to check auth status', error);
      // If we can't check status, assume not authenticated
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.auth.login(password);
      setAuthToken(response.token);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        error: error?.message || 'Login failed' 
      };
    }
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setIsAuthenticated(false);
    // Optionally call the logout endpoint
    api.auth.logout().catch(() => {});
  }, []);

  const setup = useCallback(async (password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.auth.setup(password);
      setAuthToken(response.token);
      setIsAuthenticated(true);
      // Refresh auth status
      await checkAuth();
      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        error: error?.message || 'Setup failed' 
      };
    }
  }, [checkAuth]);

  const changePassword = useCallback(async (
    currentPassword: string, 
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.auth.changePassword(currentPassword, newPassword);
      setAuthToken(response.token);
      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        error: error?.message || 'Failed to change password' 
      };
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        authStatus,
        login,
        logout,
        setup,
        changePassword,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;

