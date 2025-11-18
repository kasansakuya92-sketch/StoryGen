import React, { useState, useRef, useEffect, forwardRef } from 'react';
// FIX: Add file extension to fix module resolution issue.
import { Scene, DialogueItem } from '../types.ts';

interface SceneNodeProps {
  scene: Scene;
  onMove: (sceneId: string, newPosition: { x: number; y: number }) => void;
}

const SceneNode = forwardRef<HTMLDivElement, SceneNodeProps>(({ scene, onMove }, ref) => {
  const [position, setPosition] = useState(scene.position || { x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const nodeStartPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setPosition(scene.position || { x: 50, y: 50 });
  }, [scene.position]);
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) {
      return; 
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    nodeStartPos.current = { ...position };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - dragStartPos.current.x;
      const dy = moveEvent.clientY - dragStartPos.current.y;
      setPosition({
        x: nodeStartPos.current.x + dx,
        y: nodeStartPos.current.y + dy,
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      
      const finalX = nodeStartPos.current.x + (window.event as MouseEvent).clientX - dragStartPos.current.x;
      const finalY = nodeStartPos.current.y + (window.event as MouseEvent).clientY - dragStartPos.current.y;
      
      onMove(scene.id, { x: finalX, y: finalY });
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const outputPorts: { id: string }[] = [];
  scene.dialogue.forEach((item, index) => {
    if (item.type === 'transition') {
      outputPorts.push({ id: `dialogue-${index}` });
    } else if (item.type === 'choice') {
      item.choices.forEach((_, choiceIndex) => {
        outputPorts.push({ id: `dialogue-${index}-choice-${choiceIndex}` });
      });
    }
  });

  return (
    <div
      ref={ref}
      className={`absolute bg-card/90 backdrop-blur-md border rounded-lg shadow-xl cursor-grab ${isDragging ? 'border-primary shadow-primary/20 cursor-grabbing z-10' : 'border-border'}`}
      style={{ left: position.x, top: position.y, minWidth: '200px' }}
      onMouseDown={handleMouseDown}
    >
      <div className="bg-secondary text-secondary-foreground px-3 py-1.5 font-bold text-sm rounded-t-md">
        {scene.name}
      </div>
      <div className="p-3 text-xs text-foreground/80">
        {scene.dialogue.filter(d => d.type === 'text').length} dialogue line(s)
      </div>

      {/* Input Port */}
      <div 
        className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-foreground/70 rounded-full border-2 border-background" 
        data-port-id="input"
      />
      
      {/* Output Ports */}
      {outputPorts.map((port, index) => {
        const total = outputPorts.length;
        // Simple vertical stacking for ports
        const topOffset = 50 + (index - (total - 1) / 2) * 25;

        return (
         <div 
            key={port.id} 
            className="absolute -right-2 w-4 h-4 bg-foreground/70 rounded-full border-2 border-background" 
            style={{ top: `${topOffset}%`, transform: `translateY(-50%)` }}
            data-port-id={port.id}
          />
        );
      })}
      
    </div>
  );
});

export default SceneNode;