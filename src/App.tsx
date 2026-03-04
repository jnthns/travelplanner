import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ItineraryList from './pages/ItineraryList';
import CalendarView from './pages/CalendarView';
import Transportation from './pages/Transportation';
import Settings from './pages/Settings';
import './theme.css'; // Global beautiful theme

const THEME_STORAGE_KEY = 'tripplanner_theme';
function loadAndApplyTheme() {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return;
    const theme = JSON.parse(raw) as Record<string, string>;
    const root = document.documentElement;
    Object.entries(theme).forEach(([key, value]) => {
      if (key === 'primary') root.style.setProperty('--primary-color', value);
      else if (key === 'primaryHover') root.style.setProperty('--primary-hover', value);
      else if (key === 'secondary') root.style.setProperty('--secondary-color', value);
      else if (key === 'secondaryHover') root.style.setProperty('--secondary-hover', value);
      else if (key === 'accent') root.style.setProperty('--accent-color', value);
      else if (key === 'accentHover') root.style.setProperty('--accent-hover', value);
    });
  } catch { /* ignore */ }
}

const App: React.FC = () => {
  useEffect(() => {
    loadAndApplyTheme();
  }, []);

  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<ItineraryList />} />
            <Route path="/calendar" element={<CalendarView />} />
            <Route path="/transportation" element={<Transportation />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
