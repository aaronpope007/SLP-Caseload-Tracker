import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, CircularProgress } from '@mui/material';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { RouteErrorBoundary } from './components/common/RouteErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { SchoolProvider } from './context/SchoolContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { SessionDialogProvider } from './context/SessionDialogContext';
import { AuthProvider } from './context/AuthContext';

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
const NotFound = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));

// Loading fallback component
const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
    <CircularProgress />
  </Box>
);

// Protected Layout wrapper - combines Layout with authentication check
const ProtectedLayout = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <Layout>
      {children}
    </Layout>
  </ProtectedRoute>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedLayout>
        <Suspense fallback={<PageLoader />}>
          <Dashboard />
        </Suspense>
      </ProtectedLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/students',
    element: (
      <ProtectedLayout>
        <Suspense fallback={<PageLoader />}>
          <Students />
        </Suspense>
      </ProtectedLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/students/:id',
    element: (
      <ProtectedLayout>
        <Suspense fallback={<PageLoader />}>
          <StudentDetail />
        </Suspense>
      </ProtectedLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/teachers',
    element: (
      <ProtectedLayout>
        <Suspense fallback={<PageLoader />}>
          <Teachers />
        </Suspense>
      </ProtectedLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/case-managers',
    element: (
      <ProtectedLayout>
        <Suspense fallback={<PageLoader />}>
          <CaseManagers />
        </Suspense>
      </ProtectedLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/sessions',
    element: (
      <ProtectedLayout>
        <Suspense fallback={<PageLoader />}>
          <Sessions />
        </Suspense>
      </ProtectedLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/progress',
    element: (
      <ProtectedLayout>
        <Suspense fallback={<PageLoader />}>
          <Progress />
        </Suspense>
      </ProtectedLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/ideas',
    element: (
      <ProtectedLayout>
        <Suspense fallback={<PageLoader />}>
          <TreatmentIdeas />
        </Suspense>
      </ProtectedLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/documentation',
    element: (
      <ProtectedLayout>
        <Suspense fallback={<PageLoader />}>
          <DocumentationTemplates />
        </Suspense>
      </ProtectedLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/time-tracking',
    element: (
      <ProtectedLayout>
        <Suspense fallback={<PageLoader />}>
          <TimeTracking />
        </Suspense>
      </ProtectedLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/evaluations',
    element: (
      <ProtectedLayout>
        <Suspense fallback={<PageLoader />}>
          <Evaluations />
        </Suspense>
      </ProtectedLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/schools',
    element: (
      <ProtectedLayout>
        <Suspense fallback={<PageLoader />}>
          <Schools />
        </Suspense>
      </ProtectedLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/soap-notes',
    element: (
      <ProtectedLayout>
        <Suspense fallback={<PageLoader />}>
          <SOAPNotes />
        </Suspense>
      </ProtectedLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/progress-reports',
    element: (
      <ProtectedLayout>
        <Suspense fallback={<PageLoader />}>
          <ProgressReports />
        </Suspense>
      </ProtectedLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/due-date-items',
    element: (
      <ProtectedLayout>
        <Suspense fallback={<PageLoader />}>
          <DueDateItems />
        </Suspense>
      </ProtectedLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/session-calendar',
    element: (
      <ProtectedLayout>
        <Suspense fallback={<PageLoader />}>
          <SessionCalendar />
        </Suspense>
      </ProtectedLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/communications',
    element: (
      <ProtectedLayout>
        <Suspense fallback={<PageLoader />}>
          <Communications />
        </Suspense>
      </ProtectedLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  // Login route (public, no Layout wrapper)
  {
    path: '/login',
    element: (
      <Suspense fallback={<PageLoader />}>
        <Login />
      </Suspense>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  // 404 catch-all route - must be last
  {
    path: '*',
    element: (
      <ProtectedLayout>
        <Suspense fallback={<PageLoader />}>
          <NotFound />
        </Suspense>
      </ProtectedLayout>
    ),
  },
]);

function AppContent() {
  const { theme } = useTheme();
  
  return (
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <SchoolProvider>
            <SessionDialogProvider>
              <RouterProvider router={router} />
            </SessionDialogProvider>
          </SchoolProvider>
        </AuthProvider>
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
