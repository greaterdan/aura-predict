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
  const measureFunctionRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    let mounted = true;
    const sizeRef = { width: 0, height: 0 };
    let measureTimeout: NodeJS.Timeout | null = null;
    
    function measure() {
      if (!containerRef.current || !mounted) return;
      
      // Get the parent container's full dimensions (the dashboard area)
      const parent = containerRef.current.parentElement;
      if (!parent) return;
      
      const parentRect = parent.getBoundingClientRect();
      const width = Math.floor(parentRect.width);
      const height = Math.floor(parentRect.height);
      
      // Navbar is h-11 (44px) - account for it in measurements
      const navbarHeight = 44;
      
      console.log(`📏 Measuring container: parent=${width}x${height}, navbar=${navbarHeight}px, usable=${width}x${height}`);
      
      // Use parent's full dimensions - allow ANY size (even small)
      if (width > 0 && height > 0) {
        if (width !== sizeRef.width || height !== sizeRef.height) {
          console.log(`✅ Container size updated: ${sizeRef.width}x${sizeRef.height} → ${width}x${height}`);
          sizeRef.width = width;
          sizeRef.height = height;
          setSize({ width, height });
          setIsSizeReady(true);
        }
      }
    }
    
    // Store measure function so we can call it externally
    measureFunctionRef.current = measure;
    
    // Force immediate measurement
    measure();

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
      
      // Measure immediately when panels resize - single check for performance
      if (mounted) {
        measure();
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    // Also observe parent container to catch panel size changes
    const parentElement = containerRef.current?.parentElement;
    let parentObserver: ResizeObserver | null = null;
    if (parentElement) {
      parentObserver = new ResizeObserver(() => {
        if (mounted) {
          // Simple immediate measure - no debounce for responsiveness
          measure();
        }
      });
      parentObserver.observe(parentElement);
    }

    window.addEventListener("resize", measure);
    
    return () => {
      mounted = false;
      clearTimeout(initialTimeout);
      if (measureTimeout) clearTimeout(measureTimeout);
      resizeObserver.disconnect();
      if (parentObserver) {
        parentObserver.disconnect();
      }
      window.removeEventListener("resize", measure);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const initialBubbles = useMemo(() => {
    // Don't calculate layout if size is not ready (prevents glitch on refresh)
    // Allow ANY size - no minimum requirement
    if (!isSizeReady || size.width <= 0 || size.height <= 0 || markets.length === 0) {
      console.log(`⚠️ Bubble layout skipped: isSizeReady=${isSizeReady}, size=${size.width}x${size.height}, markets=${markets.length}`);
      return [];
    }
    
    // Show ALL markets - no limit
    const maxVisible = markets.length;
    console.log(`🎯 Creating bubbles for ${markets.length} markets (maxVisible: ${maxVisible})`);
    console.log(`📐 Container size: ${size.width}x${size.height} - USING FULL SPACE`);
    
    try {
      const bubbles = layoutRadialBubbleCloud(
        markets.map((m, idx) => ({ id: m.id ?? String(idx), data: m })),
        size.width,
        size.height,
        maxVisible // Show ALL markets
      );
      console.log(`✅ Bubble layout created ${bubbles.length} bubbles using FULL space ${size.width}x${size.height}`);
      return bubbles;
    } catch (error) {
      console.error('❌ Error calculating bubble layout:', error);
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
    // CRITICAL: Account for visual extensions (borders, shadows, glows) - same as layout
    const visualExtension = 10; // Reduced - account for borders, shadows, and glows extending beyond radius
    const minGap = 5; // MINIMAL gap between bubbles - close together like banter bubbles
    const effectiveMinGap = minGap + visualExtension; // Minimal gap with visual extension
    
    // COLLISION PREVENTION: Iteratively resolve all collisions
    // Use multiple passes to ensure NO overlaps
    const maxIterations = 20;
    for (let iter = 0; iter < maxIterations; iter++) {
      let hasCollision = false;
      
      for (const otherBubble of currentBubbles) {
        if (otherBubble.id === draggedBubbleId) continue;
        
        const dx = finalX - otherBubble.x;
        const dy = finalY - otherBubble.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const requiredDistance = draggedBubble.radius + otherBubble.radius + effectiveMinGap;
        
        if (distance < requiredDistance && distance > 0.001) {
          // Collision detected - push dragged bubble away
          const pushAngle = Math.atan2(dy, dx);
          const overlap = requiredDistance - distance;
          
          // Move dragged bubble away from the other bubble
          finalX = otherBubble.x + Math.cos(pushAngle) * requiredDistance;
          finalY = otherBubble.y + Math.sin(pushAngle) * requiredDistance;
          hasCollision = true;
        }
      }
      
      if (!hasCollision) break;
    }
    
    // Clamp final position to container bounds - allow bubbles closer to edges
    // Y must be at least navbarHeight + radius to stay below navbar
    const navbarHeight = 44; // Navbar is h-11 (44px)
    const clampedX = Math.max(draggedBubble.radius, Math.min(size.width - draggedBubble.radius, finalX));
    const clampedY = Math.max(navbarHeight + draggedBubble.radius, Math.min(size.height - draggedBubble.radius, finalY));
    
    // COLLISION DETECTION: Push other bubbles away to prevent ANY overlap
    const pushedBubbles: Record<string, { x: number; y: number }> = {};
    const pushStrength = 1.0; // Full push to prevent overlap - no smoothing during overlap
    
    // Use iterative relaxation to push all affected bubbles
    for (let pass = 0; pass < 10; pass++) {
      let movedAny = false;
      
      currentBubbles.forEach(otherBubble => {
        if (otherBubble.id === draggedBubbleId) return;
        
        // Check collision with dragged bubble
        const currentPos = pushedBubbles[otherBubble.id] || { x: otherBubble.x, y: otherBubble.y };
        const dx = clampedX - currentPos.x;
        const dy = clampedY - currentPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const requiredDistance = draggedBubble.radius + otherBubble.radius + effectiveMinGap;
        
        if (distance < requiredDistance && distance > 0.001) {
          const pushAngle = Math.atan2(dy, dx);
          const overlap = requiredDistance - distance;
          const pushDistance = overlap * pushStrength;
          
          // Calculate target position - push away from dragged bubble
          let targetX = currentPos.x - Math.cos(pushAngle) * (pushDistance + 1);
          let targetY = currentPos.y - Math.sin(pushAngle) * (pushDistance + 1);
          
          // Also check for collisions with other pushed bubbles
          for (const [otherId, otherPos] of Object.entries(pushedBubbles)) {
            if (otherId === otherBubble.id || otherId === draggedBubbleId) continue;
            const otherB = currentBubbles.find(b => b.id === otherId);
            if (!otherB) continue;
            
            const otherDx = targetX - otherPos.x;
            const otherDy = targetY - otherPos.y;
            const otherDistance = Math.sqrt(otherDx * otherDx + otherDy * otherDy);
            const otherRequiredDistance = otherBubble.radius + otherB.radius + effectiveMinGap;
            
            if (otherDistance < otherRequiredDistance && otherDistance > 0.001) {
              const otherAngle = Math.atan2(otherDy, otherDx);
              const otherOverlap = otherRequiredDistance - otherDistance;
              targetX = otherPos.x + Math.cos(otherAngle) * (otherRequiredDistance + 1);
              targetY = otherPos.y + Math.sin(otherAngle) * (otherRequiredDistance + 1);
              movedAny = true;
            }
          }
          
          // Y must be at least navbarHeight + radius to stay below navbar
          const navbarHeight = 44;
          const clampedPushX = Math.max(otherBubble.radius, Math.min(size.width - otherBubble.radius, targetX));
          const clampedPushY = Math.max(navbarHeight + otherBubble.radius, Math.min(size.height - otherBubble.radius, targetY));
          
          if (clampedPushX !== currentPos.x || clampedPushY !== currentPos.y) {
            pushedBubbles[otherBubble.id] = { x: clampedPushX, y: clampedPushY };
            movedAny = true;
          }
        }
      });
      
      if (!movedAny) break;
    }
    
    // Final pass: ensure NO overlaps remain
    for (const [bubbleId, pos] of Object.entries(pushedBubbles)) {
      const bubble = currentBubbles.find(b => b.id === bubbleId);
      if (!bubble) continue;
      
      // Check against dragged bubble
      const dx = clampedX - pos.x;
      const dy = clampedY - pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const requiredDistance = draggedBubble.radius + bubble.radius + effectiveMinGap;
      
      if (distance < requiredDistance && distance > 0.001) {
        const angle = Math.atan2(dy, dx);
        pos.x = clampedX - Math.cos(angle) * requiredDistance;
        pos.y = clampedY - Math.sin(angle) * requiredDistance;
        
        // Clamp again - allow closer to edges
        // Y must be at least navbarHeight + radius to stay below navbar
        const navbarHeight = 44;
        pos.x = Math.max(bubble.radius, Math.min(size.width - bubble.radius, pos.x));
        pos.y = Math.max(navbarHeight + bubble.radius, Math.min(size.height - bubble.radius, pos.y));
      }
      
      // Check against other pushed bubbles
      for (const [otherId, otherPos] of Object.entries(pushedBubbles)) {
        if (otherId === bubbleId) continue;
        const otherB = currentBubbles.find(b => b.id === otherId);
        if (!otherB) continue;
        
        const otherDx = pos.x - otherPos.x;
        const otherDy = pos.y - otherPos.y;
        const otherDistance = Math.sqrt(otherDx * otherDx + otherDy * otherDy);
        const otherRequiredDistance = bubble.radius + otherB.radius + effectiveMinGap;
        
        if (otherDistance < otherRequiredDistance && otherDistance > 0.001) {
          const otherAngle = Math.atan2(otherDy, otherDx);
          pos.x = otherPos.x + Math.cos(otherAngle) * otherRequiredDistance;
          pos.y = otherPos.y + Math.sin(otherAngle) * otherRequiredDistance;
          
          // Clamp again
          pos.x = Math.max(bubble.radius + effectiveMinGap, Math.min(size.width - bubble.radius - effectiveMinGap, pos.x));
          pos.y = Math.max(bubble.radius + effectiveMinGap, Math.min(size.height - bubble.radius - effectiveMinGap, pos.y));
        }
      }
    }
    
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
      className="absolute inset-0"
      style={{ 
        width: '100%', 
        height: '100%',
        overflow: 'visible',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        minWidth: '100vw',
        minHeight: '100vh',
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
              // Floating animation - smooth orbit like banterbubbles
              animationName: isDragging ? 'none' : 'bubble-float',
              animationDuration: isDragging ? '0s' : `${20 + (bubble.index % 10) * 3}s`,
              animationTimingFunction: isDragging ? 'ease' : 'ease-in-out',
              animationIterationCount: isDragging ? 0 : 'infinite',
              animationDelay: isDragging ? '0s' : `${(bubble.index % 20) * 0.3}s`,
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
