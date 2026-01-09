import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { createTheme } from '@mui/material/styles';

type ThemeMode = 'light' | 'dark';
type Theme = ReturnType<typeof createTheme>;

const THEME_STORAGE_KEY = 'slp_theme_mode';

interface ThemeContextType {
  mode: ThemeMode;
  toggleMode: () => void;
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    // Check localStorage first
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    // Default to light mode
    return 'light';
  });

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, [mode]);

  const toggleMode = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const theme: Theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: '#1976d2',
          },
          secondary: {
            main: '#dc004e',
          },
        },
        // Theme-level override for AccordionSummary to use div instead of Typography (p tag)
        // This is part of the fix for Material-UI v6 hydration warnings (see StudentAccordionCard.tsx for details)
        components: {
          MuiAccordionSummary: {
            defaultProps: {
              slotProps: {
                content: {
                  component: 'div',
                },
              },
            },
          },
          // Mobile-responsive dialog defaults
          MuiDialog: {
            styleOverrides: {
              paper: {
                '@media (max-width: 600px)': {
                  margin: 16,
                  width: 'calc(100% - 32px)',
                  maxHeight: 'calc(100% - 32px)',
                },
              },
            },
          },
          // Better touch targets on mobile
          MuiIconButton: {
            styleOverrides: {
              root: {
                '@media (max-width: 600px)': {
                  padding: 12,
                },
              },
            },
          },
          // Larger touch targets for list items
          MuiListItemButton: {
            styleOverrides: {
              root: {
                '@media (max-width: 600px)': {
                  minHeight: 56,
                },
              },
            },
          },
          // Better button sizing on mobile
          MuiButton: {
            styleOverrides: {
              root: {
                '@media (max-width: 600px)': {
                  minHeight: 44, // Apple's recommended minimum touch target
                },
              },
            },
          },
          // Responsive text fields
          MuiTextField: {
            styleOverrides: {
              root: {
                '@media (max-width: 600px)': {
                  '& .MuiInputBase-root': {
                    minHeight: 48,
                  },
                },
              },
            },
          },
        },
      }),
    [mode]
  );

  return (
    <ThemeContext.Provider value={{ mode, toggleMode, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

