import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Calendar, CalendarDays, CloudSun, Map, Table, Wallet, StickyNote, Upload, Settings, LogOut, User, Bot, Backpack } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useDayNavHref } from '../lib/useDayNavHref';
import './Sidebar.css';

const Sidebar: React.FC = () => {
  const { user, signOut } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const { dayHref, isDayActive, selectedTripId } = useDayNavHref();

  const toggleSidebarFromLogo = () => {
    setIsCollapsed((prev) => !prev);
  };

  const navLinks = [
    { to: 'dashboard', icon: <Home size={20} />, label: 'Home' },
    { to: 'spreadsheet', icon: <Table size={20} />, label: 'Trips' },
    { to: 'calendar', icon: <Calendar size={20} />, label: 'Calendar' },
    { to: '__day__', icon: <CalendarDays size={20} />, label: 'Day' },
    { to: 'weather', icon: <CloudSun size={20} />, label: 'Weather' },
    { to: 'transportation', icon: <Map size={20} />, label: 'Transportation' },
    { to: 'budget', icon: <Wallet size={20} />, label: 'Budget' },
    { to: 'notes', icon: <StickyNote size={20} />, label: 'Notes' },
    { to: 'packing', icon: <Backpack size={20} />, label: 'Packing' },
    { to: 'assistant', icon: <Bot size={20} />, label: 'Assistant' },
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <button
          type="button"
          className="logo-container logo-button"
          onClick={toggleSidebarFromLogo}
          aria-label={isCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
        >
          <span className="logo-icon">✈️</span>
          <span className="logo-text">TravelPlanner</span>
        </button>
      </div>

      <nav className="sidebar-nav">
        {navLinks.map((link) =>
          link.to === '__day__' ? (
            <NavLink
              key="__day__"
              to={dayHref}
              title={!selectedTripId ? 'Select a trip on Calendar or Trips, then open Day view' : undefined}
              className={`nav-item ${isDayActive ? 'active' : ''}`}
              style={!selectedTripId ? { opacity: 0.65 } : undefined}
              aria-current={isDayActive ? 'page' : undefined}
            >
              <span className="nav-icon">{link.icon}</span>
              <span className="nav-label">{link.label}</span>
            </NavLink>
          ) : (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{link.icon}</span>
              <span className="nav-label">{link.label}</span>
            </NavLink>
          ),
        )}
      </nav>

      <div className="sidebar-bottom">
        <NavLink
          to="import"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon"><Upload size={20} /></span>
          <span className="nav-label">Import</span>
        </NavLink>
        <NavLink
          to="settings"
          className={({ isActive }) => `nav-item nav-item-settings ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon"><Settings size={20} /></span>
          <span className="nav-label">Settings</span>
        </NavLink>

        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user-info">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="sidebar-avatar" referrerPolicy="no-referrer" />
              ) : (
                <span className="sidebar-avatar-placeholder"><User size={14} /></span>
              )}
              <span className="nav-label sidebar-user-name">
                {user.isAnonymous ? 'Guest' : (user.displayName || user.email || 'User')}
              </span>
            </div>
            <button type="button" className="btn btn-ghost btn-sm sidebar-signout" onClick={signOut} aria-label="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
