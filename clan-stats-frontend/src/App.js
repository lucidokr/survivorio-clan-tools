import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClanRegistration from './pages/ClanRegistration';
import MyClan from './pages/MyClan';
import MemberManagement from './pages/MemberManagement';
import ResultUpload from './pages/ResultUpload';
import Statistics from './pages/Statistics';
import Communities from './pages/Communities';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<Login />} />

            {/* Protected routes */}
            <Route path="/*" element={
              <ProtectedRoute>
                <Navbar />
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/register-clan" element={<ClanRegistration />} />
                  <Route path="/my-clan" element={<MyClan />} />
                  <Route path="/communities" element={<Communities />} />
                  <Route path="/members" element={<MemberManagement />} />
                  <Route path="/upload-results" element={<ResultUpload />} />
                  <Route path="/statistics" element={<Statistics />} />
                </Routes>
              </ProtectedRoute>
            } />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
