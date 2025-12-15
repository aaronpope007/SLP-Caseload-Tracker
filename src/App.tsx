import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

function App() {
  console.log('App component rendering...');
  
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SchoolProvider>
          <BrowserRouter>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/students" element={<Students />} />
                <Route path="/students/:id" element={<StudentDetail />} />
                <Route path="/sessions" element={<Sessions />} />
                <Route path="/progress" element={<Progress />} />
                <Route path="/ideas" element={<TreatmentIdeas />} />
                <Route path="/documentation" element={<DocumentationTemplates />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </SchoolProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
