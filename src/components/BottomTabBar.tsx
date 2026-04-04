import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    Table,
    Calendar,
    CalendarDays,
    Bot,
    MoreHorizontal,
    CloudSun,
    Map,
    Wallet,
    StickyNote,
    Backpack,
    Upload,
    Settings,
} from 'lucide-react';
import { useDayNavHref } from '../lib/useDayNavHref';
import './BottomTabBar.css';

const BottomTabBar: React.FC = () => {
    const { dayHref, isDayActive, selectedTripId } = useDayNavHref();
    const [moreOpen, setMoreOpen] = useState(false);

    const moreLinks = [
        { to: 'weather', icon: <CloudSun size={20} />, label: 'Weather' },
        { to: 'transportation', icon: <Map size={20} />, label: 'Transportation' },
        { to: 'budget', icon: <Wallet size={20} />, label: 'Budget' },
        { to: 'notes', icon: <StickyNote size={20} />, label: 'Notes' },
        { to: 'packing', icon: <Backpack size={20} />, label: 'Packing' },
        { to: 'import', icon: <Upload size={20} />, label: 'Import' },
        { to: 'settings', icon: <Settings size={20} />, label: 'Settings' },
    ];

    return (
        <>
            <nav className="bottom-tab-bar" aria-label="Main navigation">
                <NavLink
                    to="spreadsheet"
                    className={({ isActive }) => `bottom-tab-bar__item ${isActive ? 'bottom-tab-bar__item--active' : ''}`}
                >
                    <span className="bottom-tab-bar__icon">
                        <Table size={22} />
                    </span>
                    <span className="bottom-tab-bar__label">Trips</span>
                </NavLink>
                <NavLink
                    to="calendar"
                    className={({ isActive }) => `bottom-tab-bar__item ${isActive ? 'bottom-tab-bar__item--active' : ''}`}
                >
                    <span className="bottom-tab-bar__icon">
                        <Calendar size={22} />
                    </span>
                    <span className="bottom-tab-bar__label">Calendar</span>
                </NavLink>
                <NavLink
                    to={dayHref}
                    title={!selectedTripId ? 'Select a trip on Calendar or Trips, then open Day view' : undefined}
                    className={`bottom-tab-bar__item ${isDayActive ? 'bottom-tab-bar__item--active' : ''}`}
                    style={!selectedTripId ? { opacity: 0.65 } : undefined}
                    aria-current={isDayActive ? 'page' : undefined}
                >
                    <span className="bottom-tab-bar__icon">
                        <CalendarDays size={22} />
                    </span>
                    <span className="bottom-tab-bar__label">Day</span>
                </NavLink>
                <NavLink
                    to="assistant"
                    className={({ isActive }) => `bottom-tab-bar__item ${isActive ? 'bottom-tab-bar__item--active' : ''}`}
                >
                    <span className="bottom-tab-bar__icon">
                        <Bot size={22} />
                    </span>
                    <span className="bottom-tab-bar__label">Assistant</span>
                </NavLink>
                <button
                    type="button"
                    className={`bottom-tab-bar__item bottom-tab-bar__item--more ${moreOpen ? 'bottom-tab-bar__item--active' : ''}`}
                    onClick={() => setMoreOpen((o) => !o)}
                    aria-expanded={moreOpen}
                    aria-haspopup="dialog"
                    aria-label="More destinations"
                >
                    <span className="bottom-tab-bar__icon">
                        <MoreHorizontal size={22} />
                    </span>
                    <span className="bottom-tab-bar__label">More</span>
                </button>
            </nav>

            {moreOpen ? (
                <>
                    <button
                        type="button"
                        className="bottom-tab-bar__backdrop"
                        aria-label="Close menu"
                        onClick={() => setMoreOpen(false)}
                    />
                    <div className="bottom-tab-bar__sheet" role="dialog" aria-label="More navigation">
                        <ul className="bottom-tab-bar__sheet-list">
                            {moreLinks.map((link) => (
                                <li key={link.to}>
                                    <NavLink
                                        to={link.to}
                                        className={({ isActive }) =>
                                            `bottom-tab-bar__sheet-link ${isActive ? 'bottom-tab-bar__sheet-link--active' : ''}`
                                        }
                                        onClick={() => setMoreOpen(false)}
                                    >
                                        <span className="bottom-tab-bar__sheet-icon">{link.icon}</span>
                                        <span>{link.label}</span>
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                    </div>
                </>
            ) : null}
        </>
    );
};

export default BottomTabBar;
