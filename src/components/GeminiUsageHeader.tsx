import React from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import { useAiUsage } from '../lib/aiUsage';
import './GeminiUsageHeader.css';

const GeminiUsageHeader: React.FC = () => {
  const usage = useAiUsage();

  return (
    <div className="gemini-usage-header">
      <div className="gemini-usage-header__inner">
        <div className="gemini-usage-header__title-group">
          <div className="gemini-usage-header__title">
            <Sparkles size={16} />
            <span>Gemini usage today</span>
          </div>
          <div className="gemini-usage-header__meta">
            <span className="gemini-usage-header__subtitle">
              Free: {usage.attempted}/250 · Tier 1: {usage.attempted}/1500 · Tier 2: {usage.attempted}/4000 (Resets 00:00 PST)
            </span>
            <span className="gemini-usage-header__subtitle">
              Model: <code>{usage.lastModel || 'unknown'}</code>
            </span>
          </div>
        </div>

        <div className="gemini-usage-header__metrics" aria-label="Gemini API usage metrics">
          <div className="gemini-usage-metric gemini-usage-metric--primary">
            <span className="gemini-usage-metric__value">{usage.attempted}</span>
            <span className="gemini-usage-metric__label">requests</span>
          </div>

          <div className="gemini-usage-metric">
            <span className="gemini-usage-metric__value">{usage.succeeded}</span>
            <span className="gemini-usage-metric__label">ok</span>
          </div>

          <div className="gemini-usage-metric">
            <RotateCcw size={14} />
            <span className="gemini-usage-metric__value">{usage.retried}</span>
            <span className="gemini-usage-metric__label">retries</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeminiUsageHeader;
