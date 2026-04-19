// Purpose: Shared animation primitives for the Sakura Mist theme — FadeIn, StaggerGroup, PageTransition, SakuraSkeleton.

import React, { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

// ---------------------------------------------------------------------------
// FadeIn
// ---------------------------------------------------------------------------

interface FadeInProps {
  delay?: number;
  duration?: number;
  direction?: 'up' | 'left' | 'scale';
  children: ReactNode;
  className?: string;
}

function getHiddenTransform(direction: 'up' | 'left' | 'scale'): string {
  switch (direction) {
    case 'up': return 'translateY(16px)';
    case 'left': return 'translateX(16px)';
    case 'scale': return 'scale(0.92)';
  }
}

export function FadeIn({
  delay = 0,
  duration = 600,
  direction = 'up',
  children,
  className,
}: FadeInProps): React.JSX.Element {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(id);
  }, [delay]);

  const style: CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'none' : getHiddenTransform(direction),
    transition: `opacity ${duration}ms ${EASING}, transform ${duration}ms ${EASING}`,
    willChange: 'opacity, transform',
  };

  return (
    <div className={`fade-in-animated${className ? ` ${className}` : ''}`} style={style}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StaggerGroup
// ---------------------------------------------------------------------------

interface StaggerGroupProps {
  baseDelay?: number;
  stagger?: number;
  children: ReactNode;
  className?: string;
}

export function StaggerGroup({
  baseDelay = 0,
  stagger = 100,
  children,
  className,
}: StaggerGroupProps): React.JSX.Element {
  const items = React.Children.toArray(children);

  return (
    <div className={className}>
      {items.map((child, index) => (
        <FadeIn key={index} delay={baseDelay + index * stagger}>
          {child}
        </FadeIn>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PageTransition
// ---------------------------------------------------------------------------

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps): React.JSX.Element {
  return (
    <FadeIn
      duration={500}
      direction="up"
      delay={0}
      className={`page-transition${className ? ` ${className}` : ''}`}
    >
      {children}
    </FadeIn>
  );
}

// ---------------------------------------------------------------------------
// SakuraSkeleton
// ---------------------------------------------------------------------------

const SHIMMER_STYLE_ID = 'sakura-shimmer-keyframes';

function ensureShimmerKeyframes(): void {
  if (document.getElementById(SHIMMER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SHIMMER_STYLE_ID;
  style.textContent = `
@keyframes sakura-shimmer {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
@media (prefers-reduced-motion: reduce) {
  .sakura-skeleton { animation: none !important; opacity: 0.6; }
}`;
  document.head.appendChild(style);
}

interface SakuraSkeletonProps {
  width?: string | number;
  height?: string | number;
  rounded?: string;
  className?: string;
}

export function SakuraSkeleton({
  width = '100%',
  height = '1rem',
  rounded = '0.5rem',
  className,
}: SakuraSkeletonProps): React.JSX.Element {
  const injected = useRef(false);

  if (!injected.current) {
    ensureShimmerKeyframes();
    injected.current = true;
  }

  const style: CSSProperties = {
    width,
    height,
    borderRadius: rounded === 'full' ? '9999px' : rounded,
    background: 'var(--border-light, rgba(0,0,0,0.06))',
    animation: 'sakura-shimmer 1.5s ease-in-out infinite',
  };

  return (
    <div
      className={`sakura-skeleton fade-in-animated${className ? ` ${className}` : ''}`}
      style={style}
      aria-hidden="true"
    />
  );
}
