import React, { useState, useRef, useEffect } from 'react';
import { Plus, MoreVertical } from 'lucide-react';
import type { Activity, TransportRoute, Trip } from '../lib/types';
import {
    createTripScenario,
    deleteTripScenario,
    renameTripScenario,
    selectTripScenario,
    useTripScenarios,
} from '../lib/scenarios';
import './ScenarioSwitcher.css';

interface ScenarioSwitcherProps {
    trip: Trip | null | undefined;
    activities: Activity[];
    routes: TransportRoute[];
}

const ScenarioSwitcher: React.FC<ScenarioSwitcherProps> = ({ trip, activities, routes }) => {
    const { scenarios, activeScenarioId } = useTripScenarios(trip?.id ?? null);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
        };
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [menuOpen]);

    if (!trip) return null;

    const handleCreate = () => {
        const suggestedName = `Draft ${scenarios.length + 1}`;
        const name = window.prompt('Name this draft', suggestedName);
        if (name == null) return;
        createTripScenario({ trip, activities, routes, name });
    };

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        selectTripScenario(trip.id, value || null);
    };

    const handleMenuClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen((prev) => !prev);
    };

    const handleRename = () => {
        if (!activeScenarioId) return;
        const scenario = scenarios.find((s) => s.id === activeScenarioId);
        if (!scenario) return;
        const name = window.prompt('Rename draft', scenario.name);
        if (name == null) { setMenuOpen(false); return; }
        renameTripScenario(trip.id, scenario.id, name);
        setMenuOpen(false);
    };

    const handleDelete = () => {
        if (!activeScenarioId) return;
        const scenario = scenarios.find((s) => s.id === activeScenarioId);
        if (!scenario) { setMenuOpen(false); return; }
        const confirmed = window.confirm(`Delete "${scenario.name}"? This only removes the local draft snapshot.`);
        if (confirmed) deleteTripScenario(trip.id, scenario.id);
        setMenuOpen(false);
    };

    const activeScenario = scenarios.find((s) => s.id === activeScenarioId);
    const showDraftActions = Boolean(activeScenarioId && activeScenario);

    return (
        <div className="scenario-dropdown-wrap">
            <select
                className="scenario-dropdown-select input-field"
                value={activeScenarioId ?? ''}
                onChange={handleSelectChange}
                aria-label="Draft or live trip"
            >
                <option value="">Main</option>
                {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                        {s.name}
                    </option>
                ))}
            </select>
            <button
                type="button"
                className="btn btn-ghost btn-sm scenario-dropdown-add"
                onClick={handleCreate}
                aria-label="New draft"
                title="New draft"
            >
                <Plus size={16} />
            </button>
            {showDraftActions && (
                <div className="scenario-dropdown-menu-wrap" ref={menuRef}>
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm scenario-dropdown-dots"
                        onClick={handleMenuClick}
                        aria-label="Draft options"
                        aria-expanded={menuOpen}
                    >
                        <MoreVertical size={16} />
                    </button>
                    {menuOpen && (
                        <div className="scenario-dropdown-popover">
                            <button type="button" className="scenario-ctx-item" onClick={handleRename}>
                                Rename
                            </button>
                            <button type="button" className="scenario-ctx-item scenario-ctx-item--danger" onClick={handleDelete}>
                                Delete
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ScenarioSwitcher;
