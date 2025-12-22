// This MUST execute first - if you don't see this, the file isn't loading
console.log('=== MAIN.TSX FILE LOADING ===');
console.log('Timestamp:', new Date().toISOString());

// Use dynamic imports to catch which one fails
async function initApp() {
  try {
    console.log('=== STARTING DYNAMIC IMPORTS ===');
    
    console.log('Importing react...');
    const react = await import('react');
    console.log('React imported:', !!react);
    
    console.log('Importing react-dom/client...');
    const reactDom = await import('react-dom/client');
    console.log('React DOM imported:', !!reactDom);
    
    console.log('Importing CSS...');
    await import('./index.css');
    console.log('CSS imported');
    
    console.log('Importing App...');
    const appModule = await import('./App.tsx');
    console.log('App imported:', !!appModule.default);
    
    const { StrictMode } = react;
    const { createRoot } = reactDom;
    const App = appModule.default;
    
    console.log('=== ALL IMPORTS COMPLETE ===');
    
    const rootElement = document.getElementById('root');
    
    if (!rootElement) {
      console.error('=== ROOT ELEMENT NOT FOUND ===');
      document.body.innerHTML = '<div style="padding: 20px; color: red; font-size: 24px;">Error: Root element not found!</div>';
      return;
    }
    
    console.log('=== RENDERING APP ===');
    
    try {
      createRoot(rootElement).render(
        StrictMode ? <StrictMode><App /></StrictMode> : <App />
      );
      console.log('=== APP RENDERED SUCCESSFULLY ===');
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
