import React, { Suspense, useEffect, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { AuthProvider, useAuth } from './lib/AuthContext';
import AnalyticsProvider from './lib/amplitude';
import { ToastProvider } from './components/Toast';
import { loadThemeConfig, getResolvedTokens, getDarkTokens, applyTheme } from './design-system/themes';
import { getSettingsSnapshot } from './lib/settings';
import OnlineStatus from './components/OnlineStatus';
import GeminiUsageHeader from './components/GeminiUsageHeader';
import { Loader2 } from 'lucide-react';
import './theme.css';

const Login = lazy(() => import('./pages/Login'));
const CalendarView = lazy(() => import('./pages/CalendarView'));
const Weather = lazy(() => import('./pages/Weather'));
const Transportation = lazy(() => import('./pages/Transportation'));
const SpreadsheetView = lazy(() => import('./pages/SpreadsheetView'));
const Budget = lazy(() => import('./pages/Budget'));
const Notes = lazy(() => import('./pages/Notes'));
const Settings = lazy(() => import('./pages/Settings'));
const ImportItinerary = lazy(() => import('./pages/ImportItinerary'));
const Assistant = lazy(() => import('./pages/Assistant'));

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Loader2 size={32} className="spin" style={{ color: 'var(--primary-color)' }} />
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={null}>
        <Login />
      </Suspense>
    );
  }

  return <>{children}</>;
}

const App: React.FC = () => {
  useEffect(() => {
    const config = loadThemeConfig();
    let tokens = getResolvedTokens(config);

    const s = getSettingsSnapshot();
    if (s.textSize) document.documentElement.style.setProperty('--text-size', `${s.textSize}%`);
    if (s.compactLayout) document.body.classList.add('compact-layout');
    if (s.darkMode) {
      tokens = getDarkTokens(tokens);
      document.body.classList.add('dark-mode');
      document.documentElement.style.setProperty('color-scheme', 'dark');
    }

    applyTheme(tokens);
  }, []);

  return (
    <Router basename="/travelplanner/">
      <AuthProvider>
        <AnalyticsProvider />
        <ToastProvider>
          <AuthGate>
            <OnlineStatus />
            <div className="app-container">
              <Sidebar />
              <main className="main-content">
                <GeminiUsageHeader />
                <Suspense fallback={null}>
                  <Routes>
                    <Route path="/" element={<Navigate to="/spreadsheet" replace />} />
                    <Route path="/calendar" element={<CalendarView />} />
                    <Route path="/weather" element={<Weather />} />
                    <Route path="/transportation" element={<Transportation />} />
                    <Route path="/spreadsheet" element={<SpreadsheetView />} />
                    <Route path="/budget" element={<Budget />} />
                    <Route path="/notes" element={<Notes />} />
                    <Route path="/import" element={<ImportItinerary />} />
                    <Route path="/assistant" element={<Assistant />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<Navigate to="/spreadsheet" replace />} />
                  </Routes>
                </Suspense>
              </main>
            </div>
          </AuthGate>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
