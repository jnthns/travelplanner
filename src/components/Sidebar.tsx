import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Calendar, CloudSun, Map, Table, Wallet, StickyNote, Upload, Settings, LogOut, User, Bot } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import './Sidebar.css';

const Sidebar: React.FC = () => {
  const { user, signOut } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(true);

  const toggleSidebarFromLogo = () => {
    setIsCollapsed((prev) => !prev);
  };

  const navLinks = [
    { to: 'spreadsheet', icon: <Table size={20} />, label: 'Trips' },
    { to: 'calendar', icon: <Calendar size={20} />, label: 'Calendar' },
    { to: 'weather', icon: <CloudSun size={20} />, label: 'Weather' },
    { to: 'transportation', icon: <Map size={20} />, label: 'Transportation' },
    { to: 'budget', icon: <Wallet size={20} />, label: 'Budget' },
    { to: 'notes', icon: <StickyNote size={20} />, label: 'Notes' },
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
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{link.icon}</span>
            <span className="nav-label">{link.label}</span>
          </NavLink>
        ))}
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
