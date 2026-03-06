import React, { Suspense, useEffect, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import AnalyticsProvider from './lib/amplitude';
import { ToastProvider } from './components/Toast';
import { loadThemeConfig, getResolvedTokens, getDarkTokens, applyTheme } from './design-system/themes';
import './theme.css';

const CalendarView = lazy(() => import('./pages/CalendarView'));
const Transportation = lazy(() => import('./pages/Transportation'));
const SpreadsheetView = lazy(() => import('./pages/SpreadsheetView'));
const Budget = lazy(() => import('./pages/Budget'));
const Settings = lazy(() => import('./pages/Settings'));
const ImportItinerary = lazy(() => import('./pages/ImportItinerary'));

const App: React.FC = () => {
  useEffect(() => {
    const config = loadThemeConfig();
    let tokens = getResolvedTokens(config);

    try {
      const raw = localStorage.getItem('travelplanner_settings');
      if (raw) {
        const s = JSON.parse(raw) as { textSize?: number; compactLayout?: boolean; darkMode?: boolean };
        if (s.textSize) document.documentElement.style.setProperty('--text-size', `${s.textSize}%`);
        if (s.compactLayout) document.body.classList.add('compact-layout');
        if (s.darkMode) {
          tokens = getDarkTokens(tokens);
          document.body.classList.add('dark-mode');
          document.documentElement.style.setProperty('color-scheme', 'dark');
        }
      }
    } catch { /* ignore */ }

    applyTheme(tokens);
  }, []);

  return (
    <Router basename="/travelplanner/">
      <AnalyticsProvider />
      <ToastProvider>
        <div className="app-container">
          <Sidebar />
          <main className="main-content">
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<Navigate to="/spreadsheet" replace />} />
                <Route path="/calendar" element={<CalendarView />} />
                <Route path="/transportation" element={<Transportation />} />
                <Route path="/spreadsheet" element={<SpreadsheetView />} />
                <Route path="/budget" element={<Budget />} />
                <Route path="/import" element={<ImportItinerary />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/spreadsheet" replace />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </ToastProvider>
    </Router>
  );
};

export default App;
