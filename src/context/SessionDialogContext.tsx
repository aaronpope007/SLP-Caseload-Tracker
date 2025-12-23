import { createContext, useContext, useRef, ReactNode } from 'react';

interface SessionDialogContextType {
  openAddSession: () => boolean;
  registerHandler: (handler: () => void) => void;
}

const SessionDialogContext = createContext<SessionDialogContextType | undefined>(undefined);

export const SessionDialogProvider = ({ children }: { children: ReactNode }) => {
  const handlerRef = useRef<(() => void) | null>(null);

  const openAddSession = (): boolean => {
    if (handlerRef.current) {
      handlerRef.current();
      return true;
    }
    return false;
  };

  const registerHandler = (newHandler: () => void) => {
    handlerRef.current = newHandler;
  };

  return (
    <SessionDialogContext.Provider value={{ openAddSession, registerHandler }}>
      {children}
    </SessionDialogContext.Provider>
  );
};

export const useSessionDialog = () => {
  const context = useContext(SessionDialogContext);
  if (context === undefined) {
    throw new Error('useSessionDialog must be used within a SessionDialogProvider');
  }
  return context;
};

