"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
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
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  // Store stable positions by market ID to prevent recalculation on price updates
  const stablePositionsRef = useRef<Record<string, { x: number; y: number; radius: number; width?: number; height?: number }>>({});
  const previousMarketIdsRef = useRef<Set<string>>(new Set());

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
      
      // Use parent's full dimensions - allow ANY size (even small)
      if (width > 0 && height > 0) {
        if (width !== sizeRef.width || height !== sizeRef.height) {
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
      return [];
    }
    
    // Get current market IDs
    const currentMarketIds = new Set(markets.map(m => m.id ?? '').filter(Boolean));
    const previousMarketIds = previousMarketIdsRef.current;
    
    // Check if markets were added/removed (not just price updates)
    // Also check if viewport size changed (which requires recalculation)
    const firstStablePos = Object.values(stablePositionsRef.current)[0];
    const sizeChanged = firstStablePos && (
      firstStablePos.width !== size.width || 
      firstStablePos.height !== size.height
    );
    
    const marketsChanged = 
      currentMarketIds.size !== previousMarketIds.size ||
      ![...currentMarketIds].every(id => previousMarketIds.has(id)) ||
      sizeChanged;
    
    // If only prices/data changed (same markets), reuse existing positions
    if (!marketsChanged && Object.keys(stablePositionsRef.current).length > 0) {
      // Reuse existing positions, just update data
      const existingBubbles = markets
        .map((m, idx) => {
          const marketId = m.id ?? String(idx);
          const stablePos = stablePositionsRef.current[marketId];
          if (stablePos) {
            // Preserve the exact same position and radius - no recalculation
            return {
              id: marketId,
              data: m,
              x: stablePos.x,
              y: stablePos.y,
              radius: stablePos.radius,
              index: idx,
            };
          }
          return null;
        })
        .filter((b): b is NonNullable<typeof b> => b !== null);
      
      if (existingBubbles.length === markets.length) {
        // All markets have stable positions, reuse them - NO POSITION CHANGES
        return existingBubbles;
      }
    }
    
    // Markets changed or first load - recalculate layout
    const maxVisible = markets.length;
    
    try {
      const bubbles = layoutRadialBubbleCloud(
        markets.map((m, idx) => ({ id: m.id ?? String(idx), data: m })),
        size.width,
        size.height,
        maxVisible // Show ALL markets
      );
      
      // Store stable positions for future updates
      bubbles.forEach(bubble => {
        stablePositionsRef.current[bubble.id] = {
          x: bubble.x,
          y: bubble.y,
          radius: bubble.radius,
          width: size.width,
          height: size.height,
        };
      });
      
      // Remove positions for markets that no longer exist
      Object.keys(stablePositionsRef.current).forEach(id => {
        if (!currentMarketIds.has(id)) {
          delete stablePositionsRef.current[id];
        }
      });
      
      // Update previous market IDs
      previousMarketIdsRef.current = currentMarketIds;
      
      return bubbles;
    } catch (error) {
      return [];
    }
  }, [markets, size.width, size.height, isSizeReady]);

  // Merge initial positions with dragged positions
  // Use useMemo with proper dependencies to prevent unnecessary recalculations
  // CRITICAL: Only recalculate if initialBubbles actually changed (not just data updates)
  // Add smooth transitions for pushed bubbles
  const bubbles = useMemo(() => {
    if (initialBubbles.length === 0) return [];
    
    const result = initialBubbles.map(bubble => {
      const draggedPos = bubblePositions[bubble.id];
      if (draggedPos) {
        // If this bubble was pushed (not the dragged one), use smooth interpolation
        const isPushed = draggedBubbleId && bubble.id !== draggedBubbleId && draggedPos;
        if (isPushed) {
          // Smooth interpolation for pushed bubbles
          const currentBubble = initialBubbles.find(b => b.id === bubble.id);
          if (currentBubble) {
            const smoothFactor = 0.15; // Smooth interpolation
            return {
              ...bubble,
              x: currentBubble.x + (draggedPos.x - currentBubble.x) * smoothFactor,
              y: currentBubble.y + (draggedPos.y - currentBubble.y) * smoothFactor,
            };
          }
        }
        return { ...bubble, x: draggedPos.x, y: draggedPos.y };
      }
      // Return bubble as-is - positions are already stable from initialBubbles
      return bubble;
    });
    
    return result;
  }, [initialBubbles, bubblePositions, draggedBubbleId]);
  
  // Viewport-based virtualization: Only render bubbles visible in viewport + buffer
  const [viewport, setViewport] = useState({ top: 0, bottom: 0, left: 0, right: 0 });
  const viewportBuffer = 200; // Render bubbles 200px outside viewport
  
  const visibleBubbles = useMemo(() => {
    if (bubbles.length === 0) return [];
    
    // For very large numbers, use viewport culling
    if (bubbles.length > 500) {
      return bubbles.filter(bubble => {
        // Convert bubble position (relative to container) to viewport coordinates
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return true; // If container not ready, show all
        
        const bubbleTop = containerRect.top + bubble.y - bubble.radius;
        const bubbleBottom = containerRect.top + bubble.y + bubble.radius;
        const bubbleLeft = containerRect.left + bubble.x - bubble.radius;
        const bubbleRight = containerRect.left + bubble.x + bubble.radius;
        
        return (
          bubbleBottom >= viewport.top - viewportBuffer &&
          bubbleTop <= viewport.bottom + viewportBuffer &&
          bubbleRight >= viewport.left - viewportBuffer &&
          bubbleLeft <= viewport.right + viewportBuffer
        );
      });
    }
    
    // For smaller numbers, render all
    return bubbles;
  }, [bubbles, viewport, viewportBuffer]);
  
  // Update viewport on scroll/resize (throttled)
  const updateViewport = useCallback(() => {
    if (!containerRef.current) return;
    
    // Get container's position relative to viewport
    const rect = containerRef.current.getBoundingClientRect();
    setViewport({
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
    });
  }, []);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    updateViewport();
    
    const handleScroll = () => {
      requestAnimationFrame(updateViewport);
    };
    
    const handleResize = () => {
      requestAnimationFrame(updateViewport);
    };
    
    // Use passive listeners for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    
    // Also listen to container scroll if it's scrollable
    const container = containerRef.current;
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('scroll', handleScroll);
    };
  }, [updateViewport]);
  
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
    
    // Store initial mouse position to distinguish click from drag
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
    
    // Don't set draggedBubbleId yet - wait to see if mouse moves
    setDragOffset({
      x: e.clientX - rect.left - bubbleX,
      y: e.clientY - rect.top - bubbleY,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragOffset || !containerRef.current) return;
    
    // Check if mouse has moved enough to consider it a drag (not just a click)
    const dragThreshold = 5; // pixels
    if (mouseDownPosRef.current) {
      const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
      const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
      
      if (dx < dragThreshold && dy < dragThreshold) {
        // Mouse hasn't moved enough - treat as click, not drag
        return;
      }
      
      // Mouse has moved - this is a drag
      if (!isDraggingRef.current) {
        isDraggingRef.current = true;
        // Find which bubble we're dragging based on mouse position
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Find the closest bubble to the mouse
        let closestBubble = bubbles[0];
        let minDist = Infinity;
        for (const bubble of bubbles) {
          const dx = mouseX - bubble.x;
          const dy = mouseY - bubble.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist && dist < bubble.radius * 2) {
            minDist = dist;
            closestBubble = bubble;
          }
        }
        setDraggedBubbleId(closestBubble.id);
      }
    }
    
    if (!draggedBubbleId || !isDraggingRef.current) return;
    
    // Use requestAnimationFrame for smooth dragging
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      if (!draggedBubbleId || !dragOffset || !containerRef.current || !isDraggingRef.current) return;
      
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
    const minGap = 8; // Gap between bubbles when dragging - smooth spacing
    const effectiveMinGap = minGap + visualExtension; // Minimal gap with visual extension
    const animationBuffer = 15; // Account for floating animation
    const totalMinDistance = effectiveMinGap + animationBuffer; // Total spacing needed
    
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
        const requiredDistance = draggedBubble.radius + otherBubble.radius + totalMinDistance;
        
        if (distance < requiredDistance && distance > 0.001) {
          // Collision detected - smoothly push dragged bubble away
          const pushAngle = Math.atan2(dy, dx);
          const overlap = requiredDistance - distance;
          
          // Smooth push - use interpolation for smoother movement
          const pushFactor = 0.3; // Smooth interpolation factor
          const targetX = otherBubble.x + Math.cos(pushAngle) * requiredDistance;
          const targetY = otherBubble.y + Math.sin(pushAngle) * requiredDistance;
          
          // Interpolate for smooth movement
          finalX = finalX + (targetX - finalX) * pushFactor;
          finalY = finalY + (targetY - finalY) * pushFactor;
          hasCollision = true;
        }
      }
      
      if (!hasCollision) break;
    }
    
      // Clamp final position to container bounds with padding - container already accounts for navbars
      const edgePadding = 20; // Padding to keep bubbles away from edges (glow extends ~15px)
      const clampedX = Math.max(edgePadding + draggedBubble.radius, Math.min(size.width - edgePadding - draggedBubble.radius, finalX));
      const clampedY = Math.max(edgePadding + draggedBubble.radius, Math.min(size.height - edgePadding - draggedBubble.radius, finalY));
    
      // COLLISION DETECTION: Only push other bubbles if we're actually dragging
      // Don't push on click - only on drag
      const pushedBubbles: Record<string, { x: number; y: number }> = {};
      const pushStrength = 1.0; // Full push to prevent overlap - no smoothing during overlap
      
      // Only push other bubbles if we're actually dragging (not just clicking)
      if (isDraggingRef.current) {
        // Use iterative relaxation to push all affected bubbles smoothly
        for (let pass = 0; pass < 10; pass++) {
      let movedAny = false;
      
      currentBubbles.forEach(otherBubble => {
        if (otherBubble.id === draggedBubbleId) return;
        
        // Check collision with dragged bubble
        const currentPos = pushedBubbles[otherBubble.id] || { x: otherBubble.x, y: otherBubble.y };
        const dx = clampedX - currentPos.x;
        const dy = clampedY - currentPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const requiredDistance = draggedBubble.radius + otherBubble.radius + totalMinDistance;
        
        if (distance < requiredDistance && distance > 0.001) {
          const pushAngle = Math.atan2(dy, dx);
          const overlap = requiredDistance - distance;
          
          // Smooth push - use interpolation for smoother movement of other bubbles
          const smoothPushFactor = 0.4; // Smooth interpolation for other bubbles
          const pushDistance = overlap * pushStrength;
          
          // Calculate target position - push away from dragged bubble smoothly
          const targetX = currentPos.x - Math.cos(pushAngle) * (pushDistance + totalMinDistance * 0.5);
          const targetY = currentPos.y - Math.sin(pushAngle) * (pushDistance + totalMinDistance * 0.5);
          
          // Interpolate for smooth movement
          let finalTargetX = currentPos.x + (targetX - currentPos.x) * smoothPushFactor;
          let finalTargetY = currentPos.y + (targetY - currentPos.y) * smoothPushFactor;
          
          // Also check for collisions with other pushed bubbles
          for (const [otherId, otherPos] of Object.entries(pushedBubbles)) {
            if (otherId === otherBubble.id || otherId === draggedBubbleId) continue;
            const otherB = currentBubbles.find(b => b.id === otherId);
            if (!otherB) continue;
            
            const otherDx = finalTargetX - otherPos.x;
            const otherDy = finalTargetY - otherPos.y;
            const otherDistance = Math.sqrt(otherDx * otherDx + otherDy * otherDy);
            const otherRequiredDistance = otherBubble.radius + otherB.radius + totalMinDistance;
            
            if (otherDistance < otherRequiredDistance && otherDistance > 0.001) {
              const otherAngle = Math.atan2(otherDy, otherDx);
              finalTargetX = otherPos.x + Math.cos(otherAngle) * (otherRequiredDistance + totalMinDistance * 0.5);
              finalTargetY = otherPos.y + Math.sin(otherAngle) * (otherRequiredDistance + totalMinDistance * 0.5);
              movedAny = true;
            }
          }
          
          // Container already accounts for navbars, so use container bounds with padding
          const edgePadding = 20; // Padding to keep bubbles away from edges
          const clampedPushX = Math.max(edgePadding + otherBubble.radius, Math.min(size.width - edgePadding - otherBubble.radius, finalTargetX));
          const clampedPushY = Math.max(edgePadding + otherBubble.radius, Math.min(size.height - edgePadding - otherBubble.radius, finalTargetY));
          
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
        const requiredDistance = draggedBubble.radius + bubble.radius + totalMinDistance;
        
        if (distance < requiredDistance && distance > 0.001) {
          const angle = Math.atan2(dy, dx);
          pos.x = clampedX - Math.cos(angle) * requiredDistance;
          pos.y = clampedY - Math.sin(angle) * requiredDistance;
          
          // Clamp again - container already accounts for navbars, add padding
          const edgePadding = 20; // Padding to keep bubbles away from edges
          pos.x = Math.max(edgePadding + bubble.radius, Math.min(size.width - edgePadding - bubble.radius, pos.x));
          pos.y = Math.max(edgePadding + bubble.radius, Math.min(size.height - edgePadding - bubble.radius, pos.y));
        }
        
        // Check against other pushed bubbles
        for (const [otherId, otherPos] of Object.entries(pushedBubbles)) {
          if (otherId === bubbleId) continue;
          const otherB = currentBubbles.find(b => b.id === otherId);
          if (!otherB) continue;
          
          const otherDx = pos.x - otherPos.x;
          const otherDy = pos.y - otherPos.y;
          const otherDistance = Math.sqrt(otherDx * otherDx + otherDy * otherDy);
          const otherRequiredDistance = bubble.radius + otherB.radius + totalMinDistance;
          
          if (otherDistance < otherRequiredDistance && otherDistance > 0.001) {
            const otherAngle = Math.atan2(otherDy, otherDx);
            pos.x = otherPos.x + Math.cos(otherAngle) * otherRequiredDistance;
            pos.y = otherPos.y + Math.sin(otherAngle) * otherRequiredDistance;
            
            // Clamp again - container already accounts for navbars
            pos.x = Math.max(bubble.radius, Math.min(size.width - bubble.radius, pos.x));
            pos.y = Math.max(bubble.radius, Math.min(size.height - bubble.radius, pos.y));
          }
        }
      }
    }
    
      // Update positions: dragged bubble moves immediately, others push smoothly (only if dragging)
      if (isDraggingRef.current) {
        setBubblePositions(prev => ({
          ...prev,
          [draggedBubbleId]: { x: clampedX, y: clampedY },
          ...pushedBubbles,
        }));
      }
    });
  };

  const handleMouseUp = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Only clear positions if we were actually dragging
    if (isDraggingRef.current) {
      // Keep positions for a moment, then clear after a short delay
      setTimeout(() => {
        setBubblePositions({});
      }, 100);
    }
    
    lastMousePosRef.current = null;
    setDraggedBubbleId(null);
    setDragOffset(null);
    mouseDownPosRef.current = null;
    isDraggingRef.current = false;
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ 
        width: '100%', 
        height: '100%',
        overflow: 'hidden', // CRITICAL: Clip bubbles to container bounds
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        // REMOVED minWidth/minHeight - container should respect parent bounds only
        // Performance optimizations - removed 'paint' to allow glow to extend outside
        contain: 'layout style',
        willChange: 'scroll-position',
        // Use GPU acceleration
        transform: 'translateZ(0)',
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {isSizeReady && visibleBubbles.length > 0 && visibleBubbles.map((bubble) => {
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
              borderRadius: '50%', // Make wrapper round too
              overflow: 'hidden', // Clip to round shape
              // Floating animation - smooth natural float (like bubbles in water)
              // Enable for all bubbles for more bubbly effect
              animationName: isDragging ? 'none' : 'bubble-float-smooth',
              animationDuration: isDragging ? '0s' : `${20 + (bubble.index % 20) * 3}s`, // Slower, more natural
              animationTimingFunction: isDragging ? 'ease' : 'ease-in-out',
              animationIterationCount: isDragging ? 0 : 'infinite',
              animationDelay: isDragging ? '0s' : `${(bubble.index % 30) * 0.15}s`, // Staggered delays for natural effect
              cursor: isDragging ? 'grabbing' : 'grab',
              zIndex: isDragging ? 1000 : isHighlighted ? 100 : 1,
              transition: isDragging && bubble.id === draggedBubbleId
                ? 'none' // NO transition when dragging - instant response
                : bubblePositions[bubble.id] && bubble.id !== draggedBubbleId
                ? 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1), top 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease' // Smooth transition for pushed bubbles
                : 'none', // NO transition on position updates - prevents glitchy movement
              willChange: isDragging ? 'transform' : 'auto',
              transform: 'translateZ(0)',
              opacity: hasRendered ? opacity : 0,
              // CSS containment - removed 'paint' to allow glow to extend outside
              contain: 'layout style',
              overflow: 'visible', // CRITICAL: Allow glow to extend outside
              // Use GPU acceleration
              backfaceVisibility: 'hidden',
              perspective: 1000,
              // AGGRESSIVE: Remove ALL outlines, borders, rings
              outline: 'none',
              border: 'none',
              boxShadow: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
              // Prevent any ring styles
              '--tw-ring-width': '0',
              '--tw-ring-offset-width': '0',
              '--tw-ring-color': 'transparent',
            } as React.CSSProperties}
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent text selection
              handleMouseDown(e, bubble.id, bubble.x, bubble.y);
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
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
            tabIndex={-1} // Prevent keyboard focus
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
