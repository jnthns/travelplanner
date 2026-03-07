import React, { useState, useRef, useEffect } from 'react';
import './SwipeableItem.css';
import { Pencil, Trash2 } from 'lucide-react';

interface SwipeableItemProps {
    children: React.ReactNode;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    leftThreshold?: number;
    rightThreshold?: number;
    disabled?: boolean;
}

export const SwipeableItem: React.FC<SwipeableItemProps> = ({
    children,
    onSwipeLeft,
    onSwipeRight,
    leftThreshold = 80,
    rightThreshold = 80,
    disabled = false
}) => {
    const [offset, setOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startXRef = useRef<number | null>(null);
    const itemRef = useRef<HTMLDivElement>(null);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (disabled) return;
        startXRef.current = e.clientX;
        setIsDragging(true);
        if (itemRef.current) {
            itemRef.current.style.transition = 'none';
        }
    };

    const handlePointerMove = (e: PointerEvent) => {
        if (!isDragging || startXRef.current === null) return;

        const delta = e.clientX - startXRef.current;

        // Prevent swiping in directions that don't have handlers
        if (delta > 0 && !onSwipeRight) return;
        if (delta < 0 && !onSwipeLeft) return;

        setOffset(delta);
    };

    const handlePointerUp = () => {
        if (!isDragging) return;

        setIsDragging(false);
        if (itemRef.current) {
            itemRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
        }

        if (onSwipeLeft && offset < -leftThreshold) {
            // Snap completely to left
            setOffset(-window.innerWidth);
            setTimeout(() => {
                onSwipeLeft();
                setOffset(0); // Reset for potential undo
            }, 300);
        } else if (onSwipeRight && offset > rightThreshold) {
            // We generally don't want edit action to fly offscreen, just trigger
            setOffset(0);
            onSwipeRight();
        } else {
            // Snap back
            setOffset(0);
        }

        startXRef.current = null;
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
        } else {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        }
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDragging, offset, onSwipeLeft, onSwipeRight]);

    return (
        <div className="swipeable-container">
            <div className="swipeable-background">
                {onSwipeRight && (
                    <div className={`swipeable-action swipeable-action-left ${offset > rightThreshold ? 'active' : ''}`}>
                        <Pencil size={20} />
                        <span>Edit</span>
                    </div>
                )}
                {onSwipeLeft && (
                    <div className={`swipeable-action swipeable-action-right ${offset < -leftThreshold ? 'active' : ''}`}>
                        <Trash2 size={20} />
                        <span>Delete</span>
                    </div>
                )}
            </div>
            <div
                ref={itemRef}
                className="swipeable-content"
                style={{ transform: `translateX(${offset}px)` }}
                onPointerDown={handlePointerDown}
            >
                {children}
            </div>
        </div>
    );
};

export default SwipeableItem;
