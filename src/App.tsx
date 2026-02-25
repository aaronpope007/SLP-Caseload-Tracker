import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
const IEPNotes = lazy(() => import('./pages/IEPNotes').then(m => ({ default: m.IEPNotes })));
const ProgressReports = lazy(() => import('./pages/ProgressReports').then(m => ({ default: m.ProgressReports })));
const Reports = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
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

// Protected layout route: auth + SchoolProvider + Layout + Outlet so useSchool() has context.
const ProtectedLayoutRoute = () => (
  <ProtectedRoute>
    <SchoolProvider>
      <SessionDialogProvider>
        <Layout>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </Layout>
      </SessionDialogProvider>
    </SchoolProvider>
  </ProtectedRoute>
);

const router = createBrowserRouter([
  {
    element: <ProtectedLayoutRoute />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: '/',
        element: <Dashboard />,
      },
      {
        path: '/students',
        element: <Students />,
      },
      {
        path: '/students/:id',
        element: <StudentDetail />,
      },
      {
        path: '/teachers',
        element: <Teachers />,
      },
      {
        path: '/case-managers',
        element: <CaseManagers />,
      },
      {
        path: '/sessions',
        element: <Sessions />,
      },
      {
        path: '/progress',
        element: <Progress />,
      },
      {
        path: '/ideas',
        element: <TreatmentIdeas />,
      },
      {
        path: '/documentation',
        element: <DocumentationTemplates />,
      },
      {
        path: '/time-tracking',
        element: <TimeTracking />,
      },
      {
        path: '/evaluations',
        element: <Evaluations />,
      },
      {
        path: '/schools',
        element: <Schools />,
      },
      {
        path: '/soap-notes',
        element: <SOAPNotes />,
      },
      {
        path: '/iep-notes',
        element: <IEPNotes />,
      },
      {
        path: '/progress-reports',
        element: <ProgressReports />,
      },
      {
        path: '/reports',
        element: <Reports />,
      },
      {
        path: '/due-date-items',
        element: <DueDateItems />,
      },
      {
        path: '/session-calendar',
        element: <SessionCalendar />,
      },
      {
        path: '/communications',
        element: <Communications />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
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
]);

// Create a QueryClient instance with sensible defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes - cache garbage collection (formerly cacheTime)
      retry: 3, // Retry failed requests 3 times
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      refetchOnWindowFocus: true, // Refetch when window regains focus
      refetchOnReconnect: true, // Refetch when network reconnects
    },
  },
});

function AppContent() {
  const { theme } = useTheme();
  
  return (
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </QueryClientProvider>
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
