import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Info } from 'lucide-react';
import type { PlanningConflict } from '../lib/planning/conflictTypes';
import './ConflictList.css';

interface ConflictListProps {
  conflicts: PlanningConflict[];
  title?: string;
  compact?: boolean;
}

const ConflictList: React.FC<ConflictListProps> = ({ conflicts, title = 'Planning checks', compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (conflicts.length === 0) return null;

  return (
    <div className={`conflict-list ${compact ? 'compact' : ''}`}>
      <button
        type="button"
        className="conflict-list__header conflict-list__toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <div className="conflict-list__header-main">
          <AlertTriangle size={16} />
          <span>{title}</span>
          <span className="conflict-list__count">
            {conflicts.length} issue{conflicts.length === 1 ? '' : 's'}
          </span>
        </div>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {isOpen && (
        <div className="conflict-list__items">
          {conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className={`conflict-item conflict-item--${conflict.severity}`}
            >
              <div className="conflict-item__icon">
                {conflict.severity === 'warning' ? <AlertTriangle size={14} /> : <Info size={14} />}
              </div>
              <div className="conflict-item__content">
                <div className="conflict-item__title">{conflict.title}</div>
                <div className="conflict-item__message">{conflict.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConflictList;
