import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Plane, Calendar, Map, Table, Wallet, Upload, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import './Sidebar.css';

const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );

  const toggleCollapse = () => setIsCollapsed((prev) => !prev);

  const navLinks = [
    { to: '/', icon: <Plane size={20} />, label: 'Itinerary' },
    { to: '/calendar', icon: <Calendar size={20} />, label: 'Calendar' },
    { to: '/transportation', icon: <Map size={20} />, label: 'Transportation' },
    { to: '/spreadsheet', icon: <Table size={20} />, label: 'Spreadsheet' },
    { to: '/budget', icon: <Wallet size={20} />, label: 'Budget' },
    { to: '/import', icon: <Upload size={20} />, label: 'Import' },
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="logo-container">
          <span className="logo-icon">✈️</span>
          <span className="logo-text">TravelPlanner</span>
        </div>
        <button
          type="button"
          className="btn btn-ghost collapse-toggle"
          onClick={toggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
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
          to="/settings"
          className={({ isActive }) => `nav-item nav-item-settings ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon"><Settings size={20} /></span>
          <span className="nav-label">Settings</span>
        </NavLink>
      </div>
    </aside>
  );
};

export default Sidebar;
