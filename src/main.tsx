import { logError } from './utils/logger';

/**
 * Suppress Material-UI v6 AccordionSummary hydration warnings that are false positives.
 * 
 * These warnings occur even when the content wrapper is correctly set to a div.
 * The actual HTML structure is valid, but Material-UI v6.1.1 logs warnings during
 * development. See StudentAccordionCard.tsx for full details on the workaround.
 */
if (process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    // Filter out known false positive hydration warnings from Material-UI AccordionSummary
    const message = args[0];
    if (
      typeof message === 'string' &&
      (message.includes('cannot be a descendant of') || message.includes('cannot contain a nested')) &&
      message.includes('hydration error')
    ) {
      // Check if this is related to AccordionSummary by looking at the stack trace
      const stackTrace = args.join(' ');
      if (stackTrace.includes('AccordionSummary') || stackTrace.includes('MuiAccordionSummary')) {
        // Suppress this specific warning as it's a false positive in Material-UI v6
        return;
      }
    }
    originalError.apply(console, args);
  };
}

// Use dynamic imports to catch which one fails
async function initApp() {
  try {
    const react = await import('react');
    const reactDom = await import('react-dom/client');
    await import('./index.css');
    const appModule = await import('./App.tsx');
    
    const { StrictMode } = react;
    const { createRoot } = reactDom;
    const App = appModule.default;
    
    const rootElement = document.getElementById('root');
    
    if (!rootElement) {
      logError('=== ROOT ELEMENT NOT FOUND ===', new Error('Root element not found'));
      document.body.innerHTML = '<div style="padding: 20px; color: red; font-size: 24px;">Error: Root element not found!</div>';
      return;
    }
    
    try {
      createRoot(rootElement).render(
        StrictMode ? <StrictMode><App /></StrictMode> : <App />
      );
    } catch (error: unknown) {
      logError('=== ERROR RENDERING APP ===', error as Error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';
      rootElement.innerHTML = `
        <div style="padding: 20px; font-family: monospace; color: red;">
          <h1>Error Rendering App</h1>
          <pre>${errorMessage}\n${errorStack}</pre>
        </div>
      `;
    }
  } catch (error: unknown) {
    logError('=== ERROR IN INIT APP ===', error as Error);
    const root = document.getElementById('root');
    if (root) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';
      root.innerHTML = `
        <div style="padding: 20px; font-family: monospace; color: red;">
          <h1>Import Error</h1>
          <p><strong>Error:</strong> ${errorMessage}</p>
          <pre>${errorStack}</pre>
        </div>
      `;
    }
  }
}

// Start the app
initApp();
