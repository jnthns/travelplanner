import React, { useState, useRef, useCallback } from 'react';

interface DraggableListProps<T> {
    items: T[];
    keyFn: (item: T) => string;
    onReorder: (reordered: T[]) => void;
    renderItem: (item: T, index: number, dragHandleProps: DragHandleProps) => React.ReactNode;
    disabled?: boolean;
}

export interface DragHandleProps {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
}

function DraggableList<T>({ items, keyFn, onReorder, renderItem, disabled }: DraggableListProps<T>) {
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [overIndex, setOverIndex] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleDragStart = useCallback((index: number) => (e: React.DragEvent) => {
        setDragIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
        (e.currentTarget as HTMLElement).style.opacity = '0.5';
    }, []);

    const handleDragEnd = useCallback((_e: React.DragEvent) => {
        setDragIndex(null);
        setOverIndex(null);
        const el = _e.currentTarget as HTMLElement;
        el.style.opacity = '';
    }, []);

    const handleDragOver = useCallback((index: number) => (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOverIndex(index);
    }, []);

    const handleDrop = useCallback((index: number) => (e: React.DragEvent) => {
        e.preventDefault();
        const fromIndex = dragIndex;
        if (fromIndex === null || fromIndex === index) {
            setDragIndex(null);
            setOverIndex(null);
            return;
        }
        const reordered = [...items];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(index, 0, moved);
        setDragIndex(null);
        setOverIndex(null);
        onReorder(reordered);
    }, [dragIndex, items, onReorder]);

    return (
        <div ref={containerRef}>
            {items.map((item, index) => {
                const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;
                const dragHandleProps: DragHandleProps = {
                    draggable: !disabled,
                    onDragStart: handleDragStart(index),
                    onDragEnd: handleDragEnd,
                };

                return (
                    <div
                        key={keyFn(item)}
                        onDragOver={handleDragOver(index)}
                        onDrop={handleDrop(index)}
                        className={`draggable-item ${isOver ? 'drag-over' : ''}`}
                    >
                        {renderItem(item, index, dragHandleProps)}
                    </div>
                );
            })}
        </div>
    );
}

export default DraggableList;
