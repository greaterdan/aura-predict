"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import { PredictionNodeData } from "./PredictionNode";
import { PredictionNode } from "./PredictionNode";
import { layoutRadialBubbleCloud, PositionedBubble } from "@/lib/layoutRadialBubbleCloud";

type Props = {
  markets: PredictionNodeData[];
  onBubbleClick?: (market: PredictionNodeData) => void;
  selectedNodeId?: string | null;
  selectedAgent?: string | null;
  agents?: Array<{ id: string; name: string }>;
  agentTradeMarkets?: string[]; // Market names/IDs that the selected agent has traded
  isTransitioning?: boolean; // CRITICAL: Prevent recalculations during panel transitions
  isResizing?: boolean; // CRITICAL: Prevent recalculations during panel resize
  frosted?: boolean; // If true, show subtle/frosted version without text/images
};

const PredictionBubbleFieldComponent: React.FC<Props> = ({
  markets,
  onBubbleClick,
  selectedNodeId,
  selectedAgent,
  agents = [],
  agentTradeMarkets = [],
  isTransitioning = false,
  isResizing = false,
  frosted = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [isSizeReady, setIsSizeReady] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);
  const [hoveredBubbleId, setHoveredBubbleId] = useState<string | null>(null);
  const [draggedBubbleId, setDraggedBubbleId] = useState<string | null>(null);
  const [bubblePositions, setBubblePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  // CRITICAL: Persist dragged positions permanently so bubbles stay where user moves them
  const persistentPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const measureFunctionRef = useRef<(() => void) | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  // CRITICAL: Track if a drag actually occurred to prevent click after drag
  const hasDraggedRef = useRef<boolean>(false);
  // Store stable positions by market ID to prevent recalculation on price updates
  const stablePositionsRef = useRef<Record<string, { x: number; y: number; radius: number; width?: number; height?: number }>>({});
  const previousMarketIdsRef = useRef<Set<string>>(new Set());
  // CRITICAL: Store the initial container size - bubbles should NEVER move when panels resize
  // Only recalculate if window actually resizes or markets change
  const initialContainerSizeRef = useRef<{ width: number; height: number } | null>(null);
  const isPanelResizingRef = useRef<boolean>(false);

  useLayoutEffect(() => {
    let mounted = true;
    const sizeRef = { width: 0, height: 0 };
    let measureTimeout: NodeJS.Timeout | null = null;
    
    function measure() {
      // CRITICAL: DO NOT measure during transitions or resizing - prevents glitching
      if (isTransitioning || isResizing) {
        return; // Skip all measurements during panel transitions
      }
      
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
        // CRITICAL: Only update if size change is significant (more than 5%)
        // This prevents recalculation during panel animations which cause small size changes
        const widthDiff = Math.abs(width - sizeRef.width);
        const heightDiff = Math.abs(height - sizeRef.height);
        const widthChangePercent = sizeRef.width > 0 ? (widthDiff / sizeRef.width) * 100 : 100;
        const heightChangePercent = sizeRef.height > 0 ? (heightDiff / sizeRef.height) * 100 : 100;
        
        // CRITICAL: Only update size if it's the first measurement OR if window actually resized
        // NEVER update when panels resize - bubbles should stay in their positions
        if (sizeRef.width === 0 && sizeRef.height === 0) {
          // First measurement - always update and store as initial size
          sizeRef.width = width;
          sizeRef.height = height;
          initialContainerSizeRef.current = { width, height };
          setSize({ width, height });
          setIsSizeReady(true);
        } else if (initialContainerSizeRef.current) {
          // Check if this is a window resize (both dimensions change significantly) vs panel resize (only one dimension)
          const initialWidth = initialContainerSizeRef.current.width;
          const initialHeight = initialContainerSizeRef.current.height;
          const widthChangeFromInitial = Math.abs(width - initialWidth) / initialWidth * 100;
          const heightChangeFromInitial = Math.abs(height - initialHeight) / initialHeight * 100;
          
          // Only update if BOTH dimensions changed significantly (window resize) OR if change is huge (>30%)
          // Panel resizes typically only change one dimension, window resizes change both
          const isWindowResize = (widthChangeFromInitial > 10 && heightChangeFromInitial > 10) || 
                                 widthChangePercent > 30 || heightChangePercent > 30;
          
          if (isWindowResize) {
            // Actual window resize - update size and recalculate
            sizeRef.width = width;
            sizeRef.height = height;
            initialContainerSizeRef.current = { width, height }; // Update initial size
            setSize({ width, height });
            setIsSizeReady(true);
          }
          // Panel resize - IGNORE completely, bubbles stay in place
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
    
    // OPTIMIZED: Debounce resize observer to prevent excessive recalculations
    // CRITICAL: Completely disable during transitions
    const resizeObserver = new ResizeObserver((entries) => {
      if (!mounted) return;
      
      // CRITICAL: DO NOT measure during transitions or resizing
      if (isTransitioning || isResizing) {
        return; // Skip completely during panel transitions
      }
      
      // Clear any pending timeout
      if (measureTimeout) {
        clearTimeout(measureTimeout);
        measureTimeout = null;
      }
      
      // OPTIMIZED: Much longer debounce to prevent recalculation during panel open/close
      // This prevents glitching when Performance/Summary panels open
      if (layoutCalculationRef.current) {
        clearTimeout(layoutCalculationRef.current);
      }
      layoutCalculationRef.current = setTimeout(() => {
        if (mounted && !isTransitioning && !isResizing) {
          measure();
        }
      }, 500); // 500ms debounce - wait well after panel animation completes
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    // CRITICAL: DO NOT observe parent container - it causes recalculation when panels resize
    // Bubbles should stay in their positions when panels open/close
    // Only window resize should trigger recalculation
    // const parentElement = containerRef.current?.parentElement;
    // let parentObserver: ResizeObserver | null = null;
    // DISABLED: Parent observer causes bubbles to recalculate when panels resize

    // CRITICAL: Debounce window resize too to prevent recalculation during panel transitions
    let windowResizeTimeout: NodeJS.Timeout | null = null;
    const handleWindowResize = () => {
      if (!mounted) return;
      
      // CRITICAL: DO NOT measure during transitions
      if (isTransitioning || isResizing) {
        return;
      }
      
      if (windowResizeTimeout) {
        clearTimeout(windowResizeTimeout);
      }
      windowResizeTimeout = setTimeout(() => {
        if (mounted && !isTransitioning && !isResizing) {
          measure();
        }
      }, 500); // 500ms debounce
    };
    
    window.addEventListener("resize", handleWindowResize);
    
    // Update effect when isTransitioning or isResizing changes
    // This ensures measurements are blocked during transitions
    return () => {
      mounted = false;
      clearTimeout(initialTimeout);
      if (measureTimeout) clearTimeout(measureTimeout);
      // parentMeasureTimeout removed - parent observer disabled
      if (windowResizeTimeout) clearTimeout(windowResizeTimeout);
      if (layoutCalculationRef.current) {
        clearTimeout(layoutCalculationRef.current);
      }
      resizeObserver.disconnect();
      // Parent observer disabled - no need to disconnect
      window.removeEventListener("resize", handleWindowResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isTransitioning, isResizing]); // Re-run when transition state changes

  // OPTIMIZED: Debounce layout calculation to prevent excessive recalculations
  const layoutCalculationRef = useRef<NodeJS.Timeout | null>(null);
  
  // OPTIMIZED: Defer layout calculations for many bubbles to prevent blocking
  const [deferredBubbles, setDeferredBubbles] = useState<PositionedBubble<PredictionNodeData>[]>([]);
  
  const initialBubbles = useMemo(() => {
    // CRITICAL: DO NOT recalculate during transitions - reuse existing positions
    if (isTransitioning || isResizing) {
      // Return existing bubbles to prevent recalculation
      const existing = Object.keys(stablePositionsRef.current).map(id => {
        const stablePos = stablePositionsRef.current[id];
        const market = markets.find(m => (m.id ?? '') === id);
        if (market && stablePos) {
          return {
            id,
            data: market,
            x: stablePos.x,
            y: stablePos.y,
            radius: stablePos.radius,
            index: markets.findIndex(m => (m.id ?? '') === id),
          };
        }
        return null;
      }).filter((b): b is NonNullable<typeof b> => b !== null);
      
      if (existing.length > 0) {
        return existing;
      }
    }
    
    // Don't calculate layout if size is not ready (prevents glitch on refresh)
    // Allow ANY size - no minimum requirement
    if (!isSizeReady || size.width <= 0 || size.height <= 0 || markets.length === 0) {
      return [];
    }
    
    // Get current market IDs
    const currentMarketIds = new Set(markets.map(m => m.id ?? '').filter(Boolean));
    const previousMarketIds = previousMarketIdsRef.current;
    
    // Check if markets were added/removed (not just price updates)
    // CRITICAL: Only check size change if it's a real window resize, not panel resize
    const firstStablePos = Object.values(stablePositionsRef.current)[0];
    // Only consider size changed if it's significantly different (window resize)
    // Panel resizes should NOT trigger recalculation
    const sizeChanged = firstStablePos && initialContainerSizeRef.current && (
      Math.abs(firstStablePos.width - initialContainerSizeRef.current.width) / initialContainerSizeRef.current.width > 0.1 ||
      Math.abs(firstStablePos.height - initialContainerSizeRef.current.height) / initialContainerSizeRef.current.height > 0.1
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
    
    // CRITICAL: For frosted mode (landing page), always use async layout to prevent blocking
    // Also use async for larger counts to keep UI responsive
    const shouldUseAsync = frosted || maxVisible > 100;
    
    if (shouldUseAsync) {
      // CRITICAL: Check cache FIRST before any calculations (for landing page)
      // Check cache synchronously and return directly - don't set state in useMemo
      if (frosted && deferredBubbles.length === 0) {
        try {
          const cached = sessionStorage.getItem('landing_bubble_positions');
          const cachedMarketIds = sessionStorage.getItem('landing_bubble_market_ids');
          const currentMarketIds = markets.map(m => m.id ?? '').filter(Boolean).join(',');
          
          // Only use cache if market IDs match
          if (cached && cachedMarketIds === currentMarketIds) {
            const cachedPositions = JSON.parse(cached);
            const cachedBubbles = markets
              .slice(0, cachedPositions.length)
              .map((m, idx) => {
                const cached = cachedPositions.find((cp: any) => cp.id === (m.id ?? String(idx)));
                if (cached) {
                  return {
                    id: cached.id,
                    data: m,
                    x: cached.x,
                    y: cached.y,
                    radius: cached.radius,
                    index: idx,
                  };
                }
                return null;
              })
              .filter((b): b is NonNullable<typeof b> => b !== null);
            
            if (cachedBubbles.length > 0 && cachedBubbles.length === markets.length) {
              // Store in stable positions
              cachedBubbles.forEach(bubble => {
                stablePositionsRef.current[bubble.id] = {
                  x: bubble.x,
                  y: bubble.y,
                  radius: bubble.radius,
                  width: size.width,
                  height: size.height,
                };
              });
              // Update deferred bubbles in next tick to avoid setState in useMemo
              Promise.resolve().then(() => {
                if (deferredBubbles.length === 0) {
                  setDeferredBubbles(cachedBubbles);
                }
              });
              return cachedBubbles;
            }
          }
        } catch (e) {
          // Ignore cache errors
        }
      }
      
      // If we already have deferred bubbles, return them
      if (deferredBubbles.length > 0) {
        return deferredBubbles;
      }
      
      // Use requestIdleCallback if available, otherwise setTimeout with small delay
      const scheduleLayout = (callback: () => void) => {
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(callback, { timeout: 100 });
        } else {
          setTimeout(callback, 0);
        }
      };
      
      // Only calculate if not already calculating
      if (!layoutCalculationRef.current) {
        layoutCalculationRef.current = setTimeout(() => {
          scheduleLayout(() => {
            try {
              const bubbles = layoutRadialBubbleCloud(
                markets.map((m, idx) => ({ id: m.id ?? String(idx), data: m })),
                size.width,
                size.height,
                maxVisible
              );
              
              // Store stable positions with initial container size (not current size)
              // This ensures bubbles don't move when panels resize
              const storedWidth = initialContainerSizeRef.current?.width || size.width;
              const storedHeight = initialContainerSizeRef.current?.height || size.height;
              bubbles.forEach(bubble => {
                stablePositionsRef.current[bubble.id] = {
                  x: bubble.x,
                  y: bubble.y,
                  radius: bubble.radius,
                  width: storedWidth,
                  height: storedHeight,
                };
              });
              
              // Cache positions for landing page (include market IDs in cache key)
              if (frosted) {
                try {
                  const marketIds = markets.map(m => m.id ?? '').filter(Boolean).join(',');
                  sessionStorage.setItem('landing_bubble_positions', JSON.stringify(
                    bubbles.map(b => ({ id: b.id, x: b.x, y: b.y, radius: b.radius }))
                  ));
                  sessionStorage.setItem('landing_bubble_market_ids', marketIds);
                } catch (e) {
                  // Ignore storage errors
                }
              }
              
              // Clean up
              Object.keys(stablePositionsRef.current).forEach(id => {
                if (!currentMarketIds.has(id)) {
                  delete stablePositionsRef.current[id];
                }
              });
              
              previousMarketIdsRef.current = currentMarketIds;
              
              const validIds = new Set(bubbles.map(b => b.id));
              Object.keys(persistentPositionsRef.current).forEach(id => {
                if (!validIds.has(id)) {
                  delete persistentPositionsRef.current[id];
                }
              });
              
              setDeferredBubbles(bubbles);
            } catch (error) {
              setDeferredBubbles([]);
            } finally {
              layoutCalculationRef.current = null;
            }
          });
        }, 0);
      }
      
      // Return empty array - will update when async calculation completes
      return [];
    }
    
    // For smaller counts in non-frosted mode, calculate immediately
    try {
      const bubbles = layoutRadialBubbleCloud(
        markets.map((m, idx) => ({ id: m.id ?? String(idx), data: m })),
        size.width,
        size.height,
        maxVisible // Show ALL markets
      );
      
      // Store stable positions with initial container size (not current size)
      // This ensures bubbles don't move when panels resize
      const storedWidth = initialContainerSizeRef.current?.width || size.width;
      const storedHeight = initialContainerSizeRef.current?.height || size.height;
      bubbles.forEach(bubble => {
        stablePositionsRef.current[bubble.id] = {
          x: bubble.x,
          y: bubble.y,
          radius: bubble.radius,
          width: storedWidth,
          height: storedHeight,
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
      
      // CRITICAL: Clean up persistent positions for bubbles that no longer exist
      // Keep only positions for bubbles that are still in the current markets
      const validIds = new Set(bubbles.map(b => b.id));
      Object.keys(persistentPositionsRef.current).forEach(id => {
        if (!validIds.has(id)) {
          delete persistentPositionsRef.current[id];
        }
      });
      
      return bubbles;
    } catch (error) {
      return [];
    }
  }, [markets, size.width, size.height, isSizeReady, deferredBubbles, isTransitioning, isResizing, frosted]);

  // CRITICAL: Trigger async layout calculation when needed (for frosted mode or large counts)
  useEffect(() => {
    if (!isSizeReady || size.width <= 0 || size.height <= 0 || markets.length === 0) {
      return;
    }
    
    const maxVisible = markets.length;
    const shouldUseAsync = frosted || maxVisible > 100;
    
    if (shouldUseAsync && deferredBubbles.length === 0 && !layoutCalculationRef.current) {
      // Force recalculation by clearing stable positions to trigger useMemo
      // This will cause useMemo to run and schedule the async calculation
      const currentMarketIds = new Set(markets.map(m => m.id ?? '').filter(Boolean));
      const hasStablePositions = Object.keys(stablePositionsRef.current).length > 0;
      const marketsMatch = [...currentMarketIds].every(id => stablePositionsRef.current[id]);
      
      // Only trigger if we don't have stable positions for these markets
      if (!hasStablePositions || !marketsMatch) {
        // Clear deferred bubbles to force recalculation
        setDeferredBubbles([]);
      }
    }
  }, [markets, size.width, size.height, isSizeReady, frosted, deferredBubbles.length]);

  // Merge initial positions with dragged positions
  // Use useMemo with proper dependencies to prevent unnecessary recalculations
  // CRITICAL: Only recalculate if initialBubbles actually changed (not just data updates)
  // Add smooth transitions for pushed bubbles
  const bubbles = useMemo(() => {
    if (initialBubbles.length === 0) return [];
    
    // CRITICAL: Use persistent positions (from ref) merged with current drag state
    const allPositions = { ...persistentPositionsRef.current, ...bubblePositions };
    
    const result = initialBubbles.map(bubble => {
      const draggedPos = allPositions[bubble.id];
      if (draggedPos) {
        // If this bubble was pushed (not the dragged one), use smooth interpolation
        const isPushed = draggedBubbleId && bubble.id !== draggedBubbleId && draggedPos;
        if (isPushed) {
          // SMOOTH interpolation for pushed bubbles - use persistent position as base
          const persistentPos = persistentPositionsRef.current[bubble.id];
          const basePos = persistentPos || initialBubbles.find(b => b.id === bubble.id);
          if (basePos) {
            // Much slower interpolation to prevent glitching
            const smoothFactor = 0.08; // Very slow interpolation to prevent rapid movement
            return {
              ...bubble,
              x: basePos.x + (draggedPos.x - basePos.x) * smoothFactor,
              y: basePos.y + (draggedPos.y - basePos.y) * smoothFactor,
            };
          }
        }
        // CRITICAL: Use dragged position directly - this is where user moved the bubble
        return { ...bubble, x: draggedPos.x, y: draggedPos.y };
      }
      // Return bubble as-is - positions are already stable from initialBubbles
      return bubble;
    });
    
    return result;
  }, [initialBubbles, bubblePositions, draggedBubbleId]);
  
  // Viewport-based virtualization: Only render bubbles visible in viewport + buffer
  // OPTIMIZED: Enable virtualization earlier for better performance
  const [viewport, setViewport] = useState({ top: 0, bottom: 0, left: 0, right: 0 });
  // CRITICAL: Much smaller buffer for large counts to prevent rendering too many bubbles
  // More aggressive buffer reduction for better performance
  const viewportBuffer = bubbles.length > 300 ? 30 : bubbles.length > 200 ? 50 : bubbles.length > 150 ? 75 : bubbles.length > 100 ? 100 : 200;
  
  // OPTIMIZED: Progressive rendering - render bubbles in batches for many bubbles
  const [renderedCount, setRenderedCount] = useState(0);
  // CRITICAL: Much smaller batches for very large counts to prevent blocking
  // More aggressive batching for better performance
  const renderBatchSize = bubbles.length > 400 ? 10 : bubbles.length > 300 ? 15 : bubbles.length > 200 ? 20 : bubbles.length > 150 ? 25 : bubbles.length > 100 ? 30 : 50;
  
  useEffect(() => {
    if (bubbles.length > 100) {
      // Reset and progressively render
      setRenderedCount(0);
      const batches = Math.ceil(bubbles.length / renderBatchSize);
      let currentBatch = 0;
      
      const renderNextBatch = () => {
        if (currentBatch < batches) {
          setRenderedCount(Math.min((currentBatch + 1) * renderBatchSize, bubbles.length));
          currentBatch++;
          // Use setTimeout for larger counts to prevent blocking - more aggressive delays
          if (bubbles.length > 300) {
            setTimeout(() => requestAnimationFrame(renderNextBatch), 20); // Slower for very large counts
          } else if (bubbles.length > 200) {
            setTimeout(() => requestAnimationFrame(renderNextBatch), 15);
          } else if (bubbles.length > 150) {
            setTimeout(() => requestAnimationFrame(renderNextBatch), 10);
          } else {
            requestAnimationFrame(renderNextBatch);
          }
        }
      };
      
      // Start rendering immediately for faster appearance
        requestAnimationFrame(renderNextBatch);
    } else {
      // For smaller counts, render all immediately
      setRenderedCount(bubbles.length);
    }
  }, [bubbles.length, renderBatchSize]);
  
  const visibleBubbles = useMemo(() => {
    if (bubbles.length === 0) return [];
    
    // Limit to rendered count for progressive rendering
    const bubblesToCheck = bubbles.slice(0, renderedCount);
    
    // CRITICAL: For 100+ bubbles, ALWAYS use viewport virtualization to prevent crashes
    // Lowered threshold for much better performance
    if (bubbles.length > 100) {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) {
        // Safety: hard limit if container not ready
        return bubblesToCheck.slice(0, bubbles.length > 300 ? 30 : bubbles.length > 200 ? 50 : 80);
      }
      
      // CRITICAL: Cache viewport calculations ONCE to avoid repeated math in filter
      const viewTop = viewport.top - viewportBuffer;
      const viewBottom = viewport.bottom + viewportBuffer;
      const viewLeft = viewport.left - viewportBuffer;
      const viewRight = viewport.right + viewportBuffer;
      const containerTop = containerRect.top;
      const containerLeft = containerRect.left;
      
      const visible = bubblesToCheck.filter(bubble => {
        // Convert bubble position (relative to container) to viewport coordinates
        // Use cached values to avoid repeated calculations
        const bubbleTop = containerTop + bubble.y - bubble.radius;
        const bubbleBottom = containerTop + bubble.y + bubble.radius;
        const bubbleLeft = containerLeft + bubble.x - bubble.radius;
        const bubbleRight = containerLeft + bubble.x + bubble.radius;
        
        // Only render bubbles visible in viewport + buffer
        return (
          bubbleBottom >= viewTop &&
          bubbleTop <= viewBottom &&
          bubbleRight >= viewLeft &&
          bubbleLeft <= viewRight
        );
      });
      
      // CRITICAL: Hard limit on max visible bubbles to prevent DOM overload
      // Even if more are in viewport, limit to prevent crashes
      // MUCH more aggressive limits for better performance
      const maxVisible = bubbles.length > 400 ? 40 : bubbles.length > 300 ? 50 : bubbles.length > 200 ? 60 : bubbles.length > 150 ? 70 : bubbles.length > 100 ? 80 : Infinity;
      return visible.slice(0, maxVisible);
    }
    
    // For smaller numbers, render all
    return bubblesToCheck;
  }, [bubbles, viewport, viewportBuffer, renderedCount]);
  
  // Update viewport on scroll/resize (throttled)
  // CRITICAL: Throttle viewport updates aggressively for large counts
  const viewportUpdateThrottleRef = useRef<number | null>(null);
  const lastViewportUpdateRef = useRef<number>(0);
  
  const updateViewport = useCallback(() => {
    if (!containerRef.current) return;
    
    // Throttle updates - only update every 100ms for large counts
    const now = Date.now();
    const throttleMs = bubbles.length > 300 ? 100 : bubbles.length > 200 ? 50 : 16;
    
    if (now - lastViewportUpdateRef.current < throttleMs) {
      return; // Skip this update
    }
    lastViewportUpdateRef.current = now;
    
    // Get container's position relative to viewport
    const rect = containerRef.current.getBoundingClientRect();
    setViewport({
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
    });
  }, [bubbles.length]);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    updateViewport();
    
    // CRITICAL: Throttle scroll/resize handlers aggressively for large counts
    let rafId: number | null = null;
    let scrollTimeout: NodeJS.Timeout | null = null;
    
    const handleScroll = () => {
      // Cancel any pending updates
      if (rafId) cancelAnimationFrame(rafId);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      
      // For large counts, use setTimeout instead of RAF to throttle more aggressively
      if (bubbles.length > 300) {
        scrollTimeout = setTimeout(() => {
          updateViewport();
        }, 50); // 50ms throttle for very large counts
      } else {
        rafId = requestAnimationFrame(updateViewport);
      }
    };
    
    const handleResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      // Resize is less frequent, can use RAF
      rafId = requestAnimationFrame(updateViewport);
    };
    
    // Use passive listeners for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    
    // Also listen to container scroll if it's scrollable
    const container = containerRef.current;
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('scroll', handleScroll);
    };
  }, [updateViewport, bubbles.length]);
  
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
    hasDraggedRef.current = false; // Reset drag flag
    
    // Don't set draggedBubbleId yet - wait to see if mouse moves
    setDragOffset({
      x: e.clientX - rect.left - bubbleX,
      y: e.clientY - rect.top - bubbleY,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragOffset || !containerRef.current) return;
    
    // Check if mouse has moved enough to consider it a drag (not just a click)
    const dragThreshold = 3; // Lower threshold - 3 pixels to catch drags earlier
    if (mouseDownPosRef.current) {
      const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
      const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
      
      // CRITICAL: Set hasDraggedRef IMMEDIATELY when mouse moves, even before threshold
      // This prevents any click events from firing
      if (dx > 0 || dy > 0) {
        hasDraggedRef.current = true; // Mark drag immediately on ANY movement
      }
      
      if (dx < dragThreshold && dy < dragThreshold) {
        // Mouse hasn't moved enough - treat as click, not drag
        return;
      }
      
      // Mouse has moved - this is a drag
      if (!isDraggingRef.current) {
        isDraggingRef.current = true;
        hasDraggedRef.current = true; // Mark that a drag occurred (redundant but safe)
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
    
    // Use requestAnimationFrame for smooth dragging with throttling to prevent glitching
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    const throttleMs = 16; // ~60fps max update rate
    
    const updatePosition = (timestamp: number) => {
      // Throttle updates to prevent glitching from too many rapid updates
      if (timestamp - lastUpdateTimeRef.current < throttleMs) {
        animationFrameRef.current = requestAnimationFrame(updatePosition);
        return;
      }
      lastUpdateTimeRef.current = timestamp;
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
    
    // OPTIMIZED: Only check nearby bubbles for collision (spatial optimization)
    // COLLISION PREVENTION: Iteratively resolve all collisions
    // REDUCED iterations to prevent glitching from too many rapid updates
    const maxIterations = 3; // Reduced from 5 to 3 for smoother, less aggressive movement
    // Find max radius from current bubbles for search optimization
    const maxRadius = currentBubbles.length > 0 
      ? Math.max(...currentBubbles.map(b => b.radius), draggedBubble.radius)
      : draggedBubble.radius;
    const searchRadius = draggedBubble.radius + maxRadius + totalMinDistance;
    
    for (let iter = 0; iter < maxIterations; iter++) {
      let hasCollision = false;
      
      // OPTIMIZED: Only check bubbles within search radius
      for (const otherBubble of currentBubbles) {
        if (otherBubble.id === draggedBubbleId) continue;
        
        const dx = finalX - otherBubble.x;
        const dy = finalY - otherBubble.y;
        const distanceSq = dx * dx + dy * dy;
        const searchRadiusSq = searchRadius * searchRadius;
        
        // Early exit if bubble is too far away
        if (distanceSq > searchRadiusSq) continue;
        
        const distance = Math.sqrt(distanceSq);
        const requiredDistance = draggedBubble.radius + otherBubble.radius + totalMinDistance;
        
        if (distance < requiredDistance && distance > 0.001) {
          // Collision detected - smoothly push dragged bubble away
          const pushAngle = Math.atan2(dy, dx);
          const overlap = requiredDistance - distance;
          
          // SMOOTH push - use gentle interpolation for smooth, non-bouncy movement
          const pushFactor = 0.05; // Much gentler interpolation (reduced from 0.1) to prevent rapid/bouncy movement
          const targetX = otherBubble.x + Math.cos(pushAngle) * requiredDistance;
          const targetY = otherBubble.y + Math.sin(pushAngle) * requiredDistance;
          
          // Interpolate for smooth movement - gentle and non-bouncy
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
      const pushStrength = 0.3; // Gentler push to prevent aggressive movement
      
      // Only push other bubbles if we're actually dragging (not just clicking)
      if (isDraggingRef.current) {
      // OPTIMIZED: Use spatial optimization - only check nearby bubbles
      // Use iterative relaxation to push all affected bubbles smoothly
      // REDUCED passes to prevent glitching from too many rapid updates
      for (let pass = 0; pass < 2; pass++) {
      let movedAny = false;
      const pushMaxRadius = currentBubbles.length > 0
        ? Math.max(...currentBubbles.map(b => b.radius), draggedBubble.radius)
        : draggedBubble.radius;
      const pushSearchRadius = draggedBubble.radius + pushMaxRadius + totalMinDistance;
      
      currentBubbles.forEach(otherBubble => {
        if (otherBubble.id === draggedBubbleId) return;
        
        // OPTIMIZED: Early exit if bubble is too far away
        const currentPos = pushedBubbles[otherBubble.id] || { x: otherBubble.x, y: otherBubble.y };
        const dx = clampedX - currentPos.x;
        const dy = clampedY - currentPos.y;
        const distanceSq = dx * dx + dy * dy;
        const searchRadiusSq = pushSearchRadius * pushSearchRadius;
        
        if (distanceSq > searchRadiusSq) return; // Too far, skip
        
        const distance = Math.sqrt(distanceSq);
        const requiredDistance = draggedBubble.radius + otherBubble.radius + totalMinDistance;
        
        if (distance < requiredDistance && distance > 0.001) {
          const pushAngle = Math.atan2(dy, dx);
          const overlap = requiredDistance - distance;
          
          // SMOOTH push - use gentle interpolation for smooth, non-bouncy movement
          const smoothPushFactor = 0.08; // Much gentler interpolation for smooth movement (reduced from 0.15)
          const pushDistance = overlap * pushStrength;
          
          // Calculate target position - push away from dragged bubble smoothly (no extra distance)
          const targetX = currentPos.x - Math.cos(pushAngle) * pushDistance;
          const targetY = currentPos.y - Math.sin(pushAngle) * pushDistance;
          
          // Interpolate for smooth movement - gentle and non-bouncy
          let finalTargetX = currentPos.x + (targetX - currentPos.x) * smoothPushFactor;
          let finalTargetY = currentPos.y + (targetY - currentPos.y) * smoothPushFactor;
          
          // Also check for collisions with other pushed bubbles (gentle correction)
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
              const otherOverlap = otherRequiredDistance - otherDistance;
              // Gentle correction without extra distance
              const correctionFactor = 0.5;
              finalTargetX = finalTargetX + Math.cos(otherAngle) * (otherOverlap * correctionFactor);
              finalTargetY = finalTargetY + Math.sin(otherAngle) * (otherOverlap * correctionFactor);
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
        const newPositions = {
          ...persistentPositionsRef.current,
          [draggedBubbleId]: { x: clampedX, y: clampedY },
          ...pushedBubbles,
        };
        // CRITICAL: Save to both state and persistent ref so positions persist
        persistentPositionsRef.current = newPositions;
        setBubblePositions(newPositions);
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(updatePosition);
  };

  const handleMouseUp = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // CRITICAL: Keep positions permanently - don't clear them!
    // The persistentPositionsRef already has the final positions saved
    // Just ensure state matches the persistent ref
    if (isDraggingRef.current && draggedBubbleId) {
      // Final positions are already saved in persistentPositionsRef during drag
      // Keep them in state so bubbles stay where user moved them
      setBubblePositions({ ...persistentPositionsRef.current });
    }
    
    // CRITICAL: Clear drag state but keep hasDraggedRef for longer to prevent click
    // Keep it longer to ensure click events are completely blocked
    const wasDragging = hasDraggedRef.current || isDraggingRef.current;
    lastMousePosRef.current = null;
    setDraggedBubbleId(null);
    setDragOffset(null);
    mouseDownPosRef.current = null;
    isDraggingRef.current = false;
    
    // CRITICAL: Keep hasDraggedRef true for longer to prevent ANY click after drag
    // This prevents the performance panel from opening when dragging
    if (wasDragging) {
      // Keep flag true for 300ms to ensure all click events are blocked
      setTimeout(() => {
        hasDraggedRef.current = false;
      }, 300); // Longer delay to ensure clicks are blocked
    } else {
      // If no drag occurred, clear immediately
      hasDraggedRef.current = false;
    }
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
      {isSizeReady && visibleBubbles.length > 0 && (() => {
        // CRITICAL: Pre-calculate expensive lookups ONCE, not for every bubble
        // Check if bubble matches agent's trades by comparing market names
        const isBubbleInAgentTrades = (bubble: typeof visibleBubbles[0]) => {
          if (!selectedAgent || agentTradeMarkets.length === 0) return false;
          // Match by market name (question) - check if trade market name matches bubble question
          return agentTradeMarkets.some(tradeMarket => {
            const tradeMarketLower = tradeMarket.toLowerCase();
            const bubbleQuestionLower = bubble.data.question.toLowerCase();
            // Check if trade market name is contained in bubble question or vice versa
            return bubbleQuestionLower.includes(tradeMarketLower) || 
                   tradeMarketLower.includes(bubbleQuestionLower) ||
                   // Also check for exact match or close match
                   bubbleQuestionLower === tradeMarketLower;
          });
        };
        
        return visibleBubbles.map((bubble) => {
          // CRITICAL: Use pre-calculated values to prevent expensive lookups in loop
          const isSelected = selectedNodeId === bubble.id;
          const isInAgentTrades = isBubbleInAgentTrades(bubble);
          // Highlight if selected OR if it's in the agent's trades
          const isHighlighted = isSelected || isInAgentTrades || hoveredBubbleId === bubble.id;
          const isDragging = draggedBubbleId === bubble.id;
          
          // When agent is selected, dim non-matching bubbles but keep same size/styling
          const opacity = selectedAgent && !isInAgentTrades ? 0.4 : 1;
        
        // Note: visibleBubbles useMemo already filters by viewport correctly
        // No need for expensive getBoundingClientRect calls here

        return (
          <div
            key={bubble.id}
            className="absolute banter-bubble-wrapper"
            style={{
              // CRITICAL: Use fixed positioning - bubbles should NEVER move when container resizes
              position: 'absolute',
              left: `${bubble.x - bubble.radius}px`,
              top: `${bubble.y - bubble.radius}px`,
              width: `${bubble.radius * 2}px`,
              height: `${bubble.radius * 2}px`,
              borderRadius: '50%', // Make wrapper round too
              // CRITICAL: Prevent any layout shifts during transitions
              transform: 'translateZ(0)', // GPU acceleration - single transform property
              // Floating animation - smooth natural float (like bubbles in water)
              // Enable for all bubbles for more bubbly effect
              animationName: isDragging ? 'none' : 'bubble-float-smooth',
              animationDuration: isDragging ? '0s' : `${20 + (bubble.index % 20) * 3}s`, // Slower, more natural
              animationTimingFunction: isDragging ? 'ease' : 'ease-in-out',
              animationIterationCount: isDragging ? 0 : 'infinite',
              animationDelay: isDragging ? '0s' : `${(bubble.index % 30) * 0.15}s`, // Staggered delays for natural effect
              cursor: isDragging ? 'grabbing' : 'grab',
              zIndex: isDragging ? 1000 : isHighlighted ? 200 : 50,
              transition: isDragging && bubble.id === draggedBubbleId
                ? 'none' // NO transition when dragging - instant response
                : bubblePositions[bubble.id] && bubble.id !== draggedBubbleId
                ? 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1), top 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease' // Smooth transition for pushed bubbles
                : 'none', // NO transition on position updates - prevents glitchy movement
              opacity: hasRendered ? opacity : 0,
              // OPTIMIZED: Better CSS containment for performance (paint removed to allow glow)
              contain: 'layout style', // Layout/style containment for performance
              overflow: 'visible', // CRITICAL: Allow glow to extend outside
              // Use GPU acceleration
              backfaceVisibility: 'hidden',
              perspective: 1000,
              // OPTIMIZED: Reduce repaints with will-change only when needed
              // During resizing, don't set willChange to prevent unnecessary repaints
              willChange: (isDragging || isHighlighted) ? 'transform' : 'auto',
              // CRITICAL: Ensure pointer events work for dragging
              pointerEvents: 'auto',
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
              // Stop immediate propagation using native event
              if (e.nativeEvent && typeof (e.nativeEvent as any).stopImmediatePropagation === 'function') {
                (e.nativeEvent as any).stopImmediatePropagation();
              }
              
              // CRITICAL: Prevent click if drag occurred or if currently dragging
              // Check ALL drag flags to ensure no clicks fire after drags
              if (hasDraggedRef.current || isDraggingRef.current || isDragging || draggedBubbleId) {
                // Drag occurred - DO NOT fire click
                return;
              }
              
              // Only fire click if NO drag occurred - add delay to be extra safe
              setTimeout(() => {
                // Double-check drag didn't occur during delay
                if (!hasDraggedRef.current && !isDraggingRef.current && !draggedBubbleId) {
                  onBubbleClick?.(bubble.data);
                }
              }, 50);
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
              frosted={frosted}
              onClick={() => {
                // CRITICAL: Also check drag flags in PredictionNode onClick
                if (hasDraggedRef.current || isDraggingRef.current || isDragging || draggedBubbleId) {
                  // Drag occurred - DO NOT fire click
                  return;
                }
                // Only fire click if NO drag occurred
                onBubbleClick?.(bubble.data);
              }}
            />
          </div>
        );
        })})()}
    </div>
  );
};

// Memoize component to prevent unnecessary re-renders when props haven't actually changed
// React.memo: return true = props are equal (skip re-render), false = props changed (allow re-render)
export const PredictionBubbleField = React.memo(PredictionBubbleFieldComponent, (prevProps, nextProps) => {
  // CRITICAL: Ignore isResizing state changes during drag - prevents glitching
  // The component uses refs internally to handle resizing, so state changes are not needed
  // Only care about transitioning state changes (panel open/close)
  if (prevProps.isTransitioning !== nextProps.isTransitioning) {
    return false; // Props changed, allow re-render
  }
  
  // IGNORE isResizing changes - component handles resizing via refs without re-rendering
  
  // Compare markets array length and IDs - if same markets, skip expensive re-render
  if (prevProps.markets.length !== nextProps.markets.length) {
    return false; // Different number of markets, allow re-render
  }
  
  // Check if it's the same markets (by ID) - if yes, skip re-render for data-only updates
  const prevIds = new Set(prevProps.markets.map(m => m.id ?? '').filter(Boolean));
  const nextIds = new Set(nextProps.markets.map(m => m.id ?? '').filter(Boolean));
  
  if (prevIds.size === nextIds.size && [...prevIds].every(id => nextIds.has(id))) {
    // Same markets - only re-render if selection changed
    if (prevProps.selectedNodeId === nextProps.selectedNodeId && 
        prevProps.selectedAgent === nextProps.selectedAgent &&
        JSON.stringify(prevProps.agentTradeMarkets || []) === JSON.stringify(nextProps.agentTradeMarkets || [])) {
      return true; // Props are equal (same markets, same selection), skip re-render
    }
  }
  
  return false; // Props changed, allow re-render
});
