import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
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
import { SchoolProvider } from './context/SchoolContext';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

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
]);

function App() {
  console.log('App component rendering...');
  
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SchoolProvider>
          <RouterProvider router={router} />
        </SchoolProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
