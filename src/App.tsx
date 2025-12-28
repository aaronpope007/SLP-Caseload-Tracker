import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, CircularProgress } from '@mui/material';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { SchoolProvider } from './context/SchoolContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { SessionDialogProvider } from './context/SessionDialogContext';

// Lazy load page components for better initial load performance
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Students = lazy(() => import('./pages/Students').then(m => ({ default: m.Students })));
const StudentDetail = lazy(() => import('./pages/StudentDetail').then(m => ({ default: m.StudentDetail })));
const Teachers = lazy(() => import('./pages/Teachers').then(m => ({ default: m.Teachers })));
const CaseManagers = lazy(() => import('./pages/CaseManagers').then(m => ({ default: m.CaseManagers })));
const Sessions = lazy(() => import('./pages/Sessions').then(m => ({ default: m.Sessions })));
const Progress = lazy(() => import('./pages/Progress').then(m => ({ default: m.Progress })));
const TreatmentIdeas = lazy(() => import('./pages/TreatmentIdeas').then(m => ({ default: m.TreatmentIdeas })));
const DocumentationTemplates = lazy(() => import('./pages/DocumentationTemplates').then(m => ({ default: m.DocumentationTemplates })));
const Evaluations = lazy(() => import('./pages/Evaluations').then(m => ({ default: m.Evaluations })));
const Schools = lazy(() => import('./pages/Schools').then(m => ({ default: m.Schools })));
const TimeTracking = lazy(() => import('./pages/TimeTracking').then(m => ({ default: m.TimeTracking })));
const SOAPNotes = lazy(() => import('./pages/SOAPNotes').then(m => ({ default: m.SOAPNotes })));
const ProgressReports = lazy(() => import('./pages/ProgressReports').then(m => ({ default: m.ProgressReports })));
const DueDateItems = lazy(() => import('./pages/DueDateItems').then(m => ({ default: m.DueDateItems })));
const SessionCalendar = lazy(() => import('./pages/SessionCalendar').then(m => ({ default: m.SessionCalendar })));
const Communications = lazy(() => import('./pages/Communications').then(m => ({ default: m.Communications })));

// Loading fallback component
const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
    <CircularProgress />
  </Box>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Dashboard />
        </Suspense>
      </Layout>
    ),
  },
  {
    path: '/students',
    element: (
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Students />
        </Suspense>
      </Layout>
    ),
  },
  {
    path: '/students/:id',
    element: (
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <StudentDetail />
        </Suspense>
      </Layout>
    ),
  },
  {
    path: '/teachers',
    element: (
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Teachers />
        </Suspense>
      </Layout>
    ),
  },
  {
    path: '/case-managers',
    element: (
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <CaseManagers />
        </Suspense>
      </Layout>
    ),
  },
  {
    path: '/sessions',
    element: (
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Sessions />
        </Suspense>
      </Layout>
    ),
  },
  {
    path: '/progress',
    element: (
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Progress />
        </Suspense>
      </Layout>
    ),
  },
  {
    path: '/ideas',
    element: (
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <TreatmentIdeas />
        </Suspense>
      </Layout>
    ),
  },
  {
    path: '/documentation',
    element: (
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <DocumentationTemplates />
        </Suspense>
      </Layout>
    ),
  },
  {
    path: '/time-tracking',
    element: (
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <TimeTracking />
        </Suspense>
      </Layout>
    ),
  },
  {
    path: '/evaluations',
    element: (
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Evaluations />
        </Suspense>
      </Layout>
    ),
  },
  {
    path: '/schools',
    element: (
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Schools />
        </Suspense>
      </Layout>
    ),
  },
  {
    path: '/soap-notes',
    element: (
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <SOAPNotes />
        </Suspense>
      </Layout>
    ),
  },
  {
    path: '/progress-reports',
    element: (
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <ProgressReports />
        </Suspense>
      </Layout>
    ),
  },
  {
    path: '/due-date-items',
    element: (
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <DueDateItems />
        </Suspense>
      </Layout>
    ),
  },
  {
    path: '/session-calendar',
    element: (
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <SessionCalendar />
        </Suspense>
      </Layout>
    ),
  },
  {
    path: '/communications',
    element: (
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Communications />
        </Suspense>
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
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
