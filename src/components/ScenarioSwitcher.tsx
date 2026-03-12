import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import type { Activity, TransportRoute, Trip } from '../lib/types';
import {
    createTripScenario,
    deleteTripScenario,
    renameTripScenario,
    selectTripScenario,
    useTripScenarios,
} from '../lib/scenarios';
import './ScenarioSwitcher.css';

interface ScenarioTabBarProps {
    trip: Trip | null | undefined;
    activities: Activity[];
    routes: TransportRoute[];
}

interface ContextMenuState {
    scenarioId: string;
    x: number;
    y: number;
}

const ScenarioTabBar: React.FC<ScenarioTabBarProps> = ({ trip, activities, routes }) => {
    const { scenarios, activeScenarioId } = useTripScenarios(trip?.id ?? null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const closeMenu = useCallback(() => setContextMenu(null), []);

    useEffect(() => {
        if (!contextMenu) return;
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeMenu();
        };
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu(); };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [contextMenu, closeMenu]);

    if (!trip) return null;

    const handleCreate = () => {
        const suggestedName = `Draft ${scenarios.length + 1}`;
        const name = window.prompt('Name this draft', suggestedName);
        if (name == null) return;
        createTripScenario({ trip, activities, routes, name });
    };

    const handleContextMenu = (e: React.MouseEvent, scenarioId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ scenarioId, x: e.clientX, y: e.clientY });
    };

    const handleRename = () => {
        if (!contextMenu) return;
        const scenario = scenarios.find(s => s.id === contextMenu.scenarioId);
        if (!scenario) return;
        const name = window.prompt('Rename draft', scenario.name);
        if (name == null) { closeMenu(); return; }
        renameTripScenario(trip.id, scenario.id, name);
        closeMenu();
    };

    const handleDelete = () => {
        if (!contextMenu) return;
        const scenario = scenarios.find(s => s.id === contextMenu.scenarioId);
        if (!scenario) { closeMenu(); return; }
        const confirmed = window.confirm(`Delete "${scenario.name}"? This only removes the local draft snapshot.`);
        if (confirmed) deleteTripScenario(trip.id, scenario.id);
        closeMenu();
    };

    return (
        <div className="scenario-tab-bar">
            <div className="scenario-tab-bar__tabs">
                <button
                    type="button"
                    className={`scenario-tab ${!activeScenarioId ? 'scenario-tab--active' : ''}`}
                    onClick={() => selectTripScenario(trip.id, null)}
                >
                    Live Trip
                </button>
                {scenarios.map(s => (
                    <button
                        key={s.id}
                        type="button"
                        className={`scenario-tab ${activeScenarioId === s.id ? 'scenario-tab--active' : ''}`}
                        onClick={() => selectTripScenario(trip.id, s.id)}
                        onContextMenu={(e) => handleContextMenu(e, s.id)}
                    >
                        {s.name}
                    </button>
                ))}
                <button
                    type="button"
                    className="scenario-tab scenario-tab--add"
                    onClick={handleCreate}
                    aria-label="New draft"
                    title="New draft"
                >
                    <Plus size={14} />
                </button>
            </div>

            {contextMenu && (
                <div
                    ref={menuRef}
                    className="scenario-ctx-menu"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button type="button" className="scenario-ctx-item" onClick={handleRename}>
                        Rename
                    </button>
                    <button type="button" className="scenario-ctx-item scenario-ctx-item--danger" onClick={handleDelete}>
                        Delete
                    </button>
                </div>
            )}
        </div>
    );
};

export default ScenarioTabBar;
