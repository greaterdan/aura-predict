"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PredictionNodeData } from "./PredictionNode";
import { PredictionNode } from "./PredictionNode";
import { layoutRadialBubbleCloud } from "@/lib/layoutRadialBubbleCloud";

type Props = {
  markets: PredictionNodeData[];
  onBubbleClick?: (market: PredictionNodeData) => void;
  selectedNodeId?: string | null;
  selectedAgent?: string | null;
  agents?: Array<{ id: string; name: string }>;
};

export const PredictionBubbleField: React.FC<Props> = ({
  markets,
  onBubbleClick,
  selectedNodeId,
  selectedAgent,
  agents = [],
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [isSizeReady, setIsSizeReady] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);
  const [hoveredBubbleId, setHoveredBubbleId] = useState<string | null>(null);
  const [draggedBubbleId, setDraggedBubbleId] = useState<string | null>(null);
  const [bubblePositions, setBubblePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    let mounted = true;
    const sizeRef = { width: 0, height: 0 };
    let measureTimeout: NodeJS.Timeout | null = null;
    
    function measure() {
      if (!containerRef.current || !mounted) return;
      const rect = containerRef.current.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      
      // Only update if we have valid dimensions (at least 200px to avoid tiny initial sizes)
      if (width >= 200 && height >= 200 && (width !== sizeRef.width || height !== sizeRef.height)) {
        sizeRef.width = width;
        sizeRef.height = height;
        setSize({ width, height });
        setIsSizeReady(true);
      } else if (width < 200 || height < 200) {
        // Reset if size becomes too small
        setIsSizeReady(false);
      }
    }

    // Initial measure - wait for container to be properly sized and DOM to be ready
    const initialTimeout = setTimeout(() => {
      if (mounted) {
        measure();
        // Double-check after a short delay to ensure stable size
        measureTimeout = setTimeout(() => {
          if (mounted) measure();
        }, 100);
      }
    }, 200);
    
    // Use ResizeObserver for reliable size tracking
    const resizeObserver = new ResizeObserver((entries) => {
      if (!mounted) return;
      
      // Clear any pending timeout
      if (measureTimeout) {
        clearTimeout(measureTimeout);
        measureTimeout = null;
      }
      
      // Debounce resize to prevent glitches
      measureTimeout = setTimeout(() => {
        if (mounted) measure();
      }, 100);
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener("resize", measure);
    
    return () => {
      mounted = false;
      clearTimeout(initialTimeout);
      if (measureTimeout) clearTimeout(measureTimeout);
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const initialBubbles = useMemo(() => {
    // Don't calculate layout if size is not ready (prevents glitch on refresh)
    // Require minimum valid dimensions to avoid calculating with tiny sizes
    if (!isSizeReady || size.width < 200 || size.height < 200 || markets.length === 0) {
      return [];
    }
    // For "All Markets" - show as many as possible, otherwise limit to 200
    const maxVisible = markets.length > 200 ? markets.length : 200;
    
    try {
      return layoutRadialBubbleCloud(
        markets.map((m, idx) => ({ id: m.id ?? String(idx), data: m })),
        size.width,
        size.height,
        maxVisible // Show all markets if possible
      );
    } catch (error) {
      console.error('Error calculating bubble layout:', error);
      return [];
    }
  }, [markets, size.width, size.height, isSizeReady]);

  // Merge initial positions with dragged positions
  const bubbles = useMemo(() => {
    const result = initialBubbles.map(bubble => {
      const draggedPos = bubblePositions[bubble.id];
      if (draggedPos) {
        return { ...bubble, x: draggedPos.x, y: draggedPos.y };
      }
      return bubble;
    });
    
    return result;
  }, [initialBubbles, bubblePositions]);
  
  // Mark as rendered once we have bubbles and size is ready
  useEffect(() => {
    if (bubbles.length > 0 && isSizeReady && !hasRendered) {
      const timer = setTimeout(() => setHasRendered(true), 100);
      return () => clearTimeout(timer);
    }
  }, [bubbles.length, isSizeReady, hasRendered]);

  const handleMouseDown = (e: React.MouseEvent, bubbleId: string, bubbleX: number, bubbleY: number) => {
    if (e.button !== 0) return; // Only left mouse button
    e.preventDefault();
    e.stopPropagation();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setDraggedBubbleId(bubbleId);
    setDragOffset({
      x: e.clientX - rect.left - bubbleX,
      y: e.clientY - rect.top - bubbleY,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedBubbleId || !dragOffset || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    let newX = e.clientX - rect.left - dragOffset.x;
    let newY = e.clientY - rect.top - dragOffset.y;
    
    // Clamp to container bounds - use initialBubbles to get radius
    const draggedBubble = initialBubbles.find(b => b.id === draggedBubbleId);
    if (!draggedBubble) return;
    
    // Get current bubble positions (including already dragged ones)
    const currentBubbles = bubbles.map(b => {
      const draggedPos = bubblePositions[b.id];
      return draggedPos ? { ...b, x: draggedPos.x, y: draggedPos.y } : b;
    });
    
    // NO INTERPOLATION on dragged bubble - it should follow mouse directly
    let finalX = newX;
    let finalY = newY;
    const minGap = 1; // Minimum gap to prevent overlap
    
    // COLLISION PREVENTION: Check if new position would overlap, adjust if needed
    for (const otherBubble of currentBubbles) {
      if (otherBubble.id === draggedBubbleId) continue;
      
      const dx = finalX - otherBubble.x;
      const dy = finalY - otherBubble.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const requiredDistance = draggedBubble.radius + otherBubble.radius + minGap;
      
      if (distance < requiredDistance && distance > 0) {
        // Calculate how much we need to move the dragged bubble away
        const pushAngle = Math.atan2(dy, dx);
        
        // Move dragged bubble away from the other bubble (direct, no interpolation)
        finalX = otherBubble.x + Math.cos(pushAngle) * requiredDistance;
        finalY = otherBubble.y + Math.sin(pushAngle) * requiredDistance;
      }
    }
    
    // Clamp final position to container bounds
    const clampedX = Math.max(draggedBubble.radius, Math.min(size.width - draggedBubble.radius, finalX));
    const clampedY = Math.max(draggedBubble.radius, Math.min(size.height - draggedBubble.radius, finalY));
    
    // COLLISION DETECTION: Push other bubbles away smoothly when dragged bubble gets close
    const pushedBubbles: Record<string, { x: number; y: number }> = {};
    const pushStrength = 0.7; // Strong push to prevent overlap
    
    currentBubbles.forEach(otherBubble => {
      if (otherBubble.id === draggedBubbleId) return;
      
      const dx = clampedX - otherBubble.x;
      const dy = clampedY - otherBubble.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const requiredDistance = draggedBubble.radius + otherBubble.radius + minGap;
      
      if (distance < requiredDistance && distance > 0) {
        const pushAngle = Math.atan2(dy, dx);
        const overlap = requiredDistance - distance;
        const pushDistance = overlap * pushStrength; // Push away to prevent overlap
        
        const currentPos = bubblePositions[otherBubble.id] || { x: otherBubble.x, y: otherBubble.y };
        
        // Calculate target position
        const targetX = otherBubble.x - Math.cos(pushAngle) * pushDistance;
        const targetY = otherBubble.y - Math.sin(pushAngle) * pushDistance;
        
        // Smooth interpolation from current position to target (only for pushed bubbles)
        const smoothingFactor = 0.3;
        const smoothX = currentPos.x + (targetX - currentPos.x) * smoothingFactor;
        const smoothY = currentPos.y + (targetY - currentPos.y) * smoothingFactor;
        
        const clampedPushX = Math.max(otherBubble.radius, Math.min(size.width - otherBubble.radius, smoothX));
        const clampedPushY = Math.max(otherBubble.radius, Math.min(size.height - otherBubble.radius, smoothY));
        
        pushedBubbles[otherBubble.id] = { x: clampedPushX, y: clampedPushY };
      }
    });
    
    // Update positions: dragged bubble moves immediately, others push smoothly
    setBubblePositions(prev => ({
      ...prev,
      [draggedBubbleId]: { x: clampedX, y: clampedY },
      ...pushedBubbles,
    }));
  };

  const handleMouseUp = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    lastMousePosRef.current = null;
    setDraggedBubbleId(null);
    setDragOffset(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{ 
        width: '100%', 
        height: '100%',
        overflow: 'visible',
        minWidth: '100%',
        minHeight: '100%',
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {isSizeReady && bubbles.length > 0 && bubbles.map((bubble) => {
        const isSelected =
          selectedNodeId === bubble.id ||
          (selectedAgent &&
            bubble.data.agentName ===
              agents.find((a) => a.id === selectedAgent)?.name);
        const isHighlighted = isSelected || hoveredBubbleId === bubble.id;
        const isDragging = draggedBubbleId === bubble.id;
        
        // When agent is selected, dim non-matching bubbles but keep same size/styling
        const opacity = selectedAgent && !isSelected ? 0.4 : 1;

        return (
          <div
            key={bubble.id}
            className="absolute banter-bubble-wrapper"
            style={{
              left: bubble.x - bubble.radius,
              top: bubble.y - bubble.radius,
              width: bubble.radius * 2,
              height: bubble.radius * 2,
              animation: isDragging 
                ? 'none' 
                : `bubble-orbit ${30 + (bubble.index % 8) * 4}s ease-in-out infinite`,
              animationDelay: isDragging ? '0s' : `${(bubble.index % 30) * 0.5}s`,
              cursor: isDragging ? 'grabbing' : 'grab',
              zIndex: isDragging ? 1000 : isHighlighted ? 100 : 1,
              transition: isDragging && bubble.id === draggedBubbleId
                ? 'none' // NO transition when dragging - instant response
                : bubblePositions[bubble.id] && bubble.id !== draggedBubbleId
                ? 'left 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.2s ease'
                : hasRendered 
                ? 'opacity 0.3s ease, transform 0.3s ease'
                : 'opacity 0.5s ease, transform 0.5s ease',
              willChange: isDragging ? 'transform' : 'auto',
              transform: 'translateZ(0)',
              opacity: hasRendered ? opacity : 0,
            }}
            onMouseDown={(e) => handleMouseDown(e, bubble.id, bubble.x, bubble.y)}
            onClick={(e) => {
              if (!isDragging) {
                onBubbleClick?.(bubble.data);
              }
            }}
            onMouseEnter={() => setHoveredBubbleId(bubble.id)}
            onMouseLeave={() => {
              if (!isDragging) {
                setHoveredBubbleId(null);
              }
            }}
          >
            <PredictionNode
              data={bubble.data}
              position={{ x: 0, y: 0 }}
              size={bubble.radius * 2}
              animationIndex={bubble.index}
              isHighlighted={isHighlighted}
              isDragging={isDragging}
              onClick={() => {
                if (!isDragging) {
                  onBubbleClick?.(bubble.data);
                }
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
