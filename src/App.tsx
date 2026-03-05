import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ItineraryList from './pages/ItineraryList';
import CalendarView from './pages/CalendarView';
import Transportation from './pages/Transportation';
import SpreadsheetView from './pages/SpreadsheetView';
import Settings from './pages/Settings';
import AnalyticsProvider from './lib/amplitude';
import { loadThemeConfig, getResolvedTokens, applyTheme } from './design-system/themes';
import './theme.css';

const App: React.FC = () => {
  useEffect(() => {
    const config = loadThemeConfig();
    const tokens = getResolvedTokens(config);
    applyTheme(tokens);

    try {
      const raw = localStorage.getItem('travelplanner_settings');
      if (raw) {
        const s = JSON.parse(raw) as { textSize?: number; compactLayout?: boolean };
        if (s.textSize) document.documentElement.style.setProperty('--text-size', `${s.textSize}%`);
        if (s.compactLayout) document.body.classList.add('compact-layout');
      }
    } catch { /* ignore */ }
  }, []);

  return (
    <Router basename="/travelplanner/">
      <AnalyticsProvider />
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<ItineraryList />} />
            <Route path="/calendar" element={<CalendarView />} />
            <Route path="/transportation" element={<Transportation />} />
            <Route path="/spreadsheet" element={<SpreadsheetView />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
