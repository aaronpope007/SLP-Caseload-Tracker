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
      console.error('=== ROOT ELEMENT NOT FOUND ===');
      document.body.innerHTML = '<div style="padding: 20px; color: red; font-size: 24px;">Error: Root element not found!</div>';
      return;
    }
    
    try {
      createRoot(rootElement).render(
        StrictMode ? <StrictMode><App /></StrictMode> : <App />
      );
    } catch (error: unknown) {
      console.error('=== ERROR RENDERING APP ===', error);
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
    console.error('=== ERROR IN INIT APP ===', error);
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
