import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Students } from './pages/Students';
import { StudentDetail } from './pages/StudentDetail';
import { Teachers } from './pages/Teachers';
import { Sessions } from './pages/Sessions';
import { Progress } from './pages/Progress';
import { TreatmentIdeas } from './pages/TreatmentIdeas';
import { DocumentationTemplates } from './pages/DocumentationTemplates';
import { Evaluations } from './pages/Evaluations';
import { Schools } from './pages/Schools';
import { TimeTracking } from './pages/TimeTracking';
import { SOAPNotes } from './pages/SOAPNotes';
import { ProgressReports } from './pages/ProgressReports';
import { DueDateItems } from './pages/DueDateItems';
import { SessionCalendar } from './pages/SessionCalendar';
import { SchoolProvider } from './context/SchoolContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { SessionDialogProvider } from './context/SessionDialogContext';

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
    path: '/teachers',
    element: (
      <Layout>
        <Teachers />
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
  {
    path: '/progress-reports',
    element: (
      <Layout>
        <ProgressReports />
      </Layout>
    ),
  },
  {
    path: '/due-date-items',
    element: (
      <Layout>
        <DueDateItems />
      </Layout>
    ),
  },
  {
    path: '/session-calendar',
    element: (
      <Layout>
        <SessionCalendar />
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
          <SessionDialogProvider>
            <RouterProvider router={router} />
          </SessionDialogProvider>
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
