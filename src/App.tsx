import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Students } from './pages/Students';
import { StudentDetail } from './pages/StudentDetail';
import { Sessions } from './pages/Sessions';
import { Progress } from './pages/Progress';
import { TreatmentIdeas } from './pages/TreatmentIdeas';
import { DocumentationTemplates } from './pages/DocumentationTemplates';
import { Evaluations } from './pages/Evaluations';
import { Schools } from './pages/Schools';
import { TimeTracking } from './pages/TimeTracking';
import { SOAPNotes } from './pages/SOAPNotes';
import { SchoolProvider } from './context/SchoolContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Layout>
        <Dashboard />
      </Layout>
    ),
  },
  {
    path: '/students',
    element: (
      <Layout>
        <Students />
      </Layout>
    ),
  },
  {
    path: '/students/:id',
    element: (
      <Layout>
        <StudentDetail />
      </Layout>
    ),
  },
  {
    path: '/sessions',
    element: (
      <Layout>
        <Sessions />
      </Layout>
    ),
  },
  {
    path: '/progress',
    element: (
      <Layout>
        <Progress />
      </Layout>
    ),
  },
  {
    path: '/ideas',
    element: (
      <Layout>
        <TreatmentIdeas />
      </Layout>
    ),
  },
  {
    path: '/documentation',
    element: (
      <Layout>
        <DocumentationTemplates />
      </Layout>
    ),
  },
  {
    path: '/time-tracking',
    element: (
      <Layout>
        <TimeTracking />
      </Layout>
    ),
  },
  {
    path: '/evaluations',
    element: (
      <Layout>
        <Evaluations />
      </Layout>
    ),
  },
  {
    path: '/schools',
    element: (
      <Layout>
        <Schools />
      </Layout>
    ),
  },
  {
    path: '/soap-notes',
    element: (
      <Layout>
        <SOAPNotes />
      </Layout>
    ),
  },
]);

function AppContent() {
  const { theme } = useTheme();
  
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <SchoolProvider>
        <RouterProvider router={router} />
      </SchoolProvider>
    </MuiThemeProvider>
  );
}

function App() {
  console.log('App component rendering...');
  
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
