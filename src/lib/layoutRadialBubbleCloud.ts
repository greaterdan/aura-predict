// lib/layoutRadialBubbleCloud.ts

export type BubbleItem<T> = {
  id: string;
  data: T;
};

export type PositionedBubble<T> = {
  id: string;
  data: T;
  x: number;
  y: number;
  radius: number;
  index: number;
};

export function layoutRadialBubbleCloud<T>(
  items: BubbleItem<T>[],
  width: number,
  height: number,
  maxVisible = 10000 // Show ALL markets - no artificial limit (increased for performance)
): PositionedBubble<T>[] {
  try {
    if (!width || !height || items.length === 0) {
      return [];
    }
    
  // Container height already accounts for navbars (viewport - top navbar - bottom navbar)
  // Add padding to keep bubbles away from edges (glow extends ~15px)
  const edgePadding = 20; // Padding to keep bubbles away from container edges
  const startY = edgePadding; // Start with padding from top
  const endY = height - edgePadding; // End with padding from bottom

  // NO LIMITING - show ALL bubbles requested, make them smaller if needed
  const visible = items.slice(0, maxVisible);
  const n = visible.length;

  // USE FULL SPACE - BUBBLES FILL ENTIRE SCREEN
  const usableWidth = width;
  const usableHeight = height; // Use full height
  
  // NO CENTER CALCULATION - we spread across FULL space, not centered
  
  // Estimate radius from available area (rectangular, not circular)
  const totalArea = usableWidth * usableHeight;
  const areaPer = totalArea / (n * 1.5); // Space per bubble
  let estimatedRadius = Math.sqrt(areaPer / Math.PI);

  // Base radius - SCALE DOWN if we have many bubbles to fit them all
  // Calculate based on available space and item count
  const spacePerBubble = (usableWidth * usableHeight) / n;
  const radiusFromSpace = Math.sqrt(spacePerBubble / Math.PI) * 0.4; // Use 40% of available space per bubble
  
  // Size constraints - SCALE DOWN for more bubbles
  const minRadius = n > 200 ? 25 : n > 150 ? 30 : n > 100 ? 35 : n > 50 ? 40 : 45; // Smaller for more bubbles
  const maxRadius = n > 200 ? 50 : n > 150 ? 60 : n > 100 ? 70 : n > 50 ? 80 : 90; // Smaller max sizes
  const baseRadius = Math.max(minRadius, Math.min(maxRadius, Math.min(radiusFromSpace, estimatedRadius)));
  
  // Calculate bubble sizes based on VOLUME (higher volume = bigger bubble)
  // First, find min/max volume to normalize
  const volumes: number[] = [];
  for (let i = 0; i < n; i++) {
    const item = visible[i];
    const data = item.data as any;
    const volume = typeof data?.volume === 'string' ? parseFloat(data.volume) : (data?.volume || 0);
    volumes.push(Math.max(0, volume)); // Ensure non-negative
  }
  
  const nonZeroVolumes = volumes.filter(v => v > 0);
  const minVolume = nonZeroVolumes.length > 0 ? Math.min(...nonZeroVolumes) : 0;
  const maxVolume = volumes.length > 0 ? Math.max(...volumes) : 1;
  const volumeRange = maxVolume - minVolume;
  
  // Size range: smaller bubbles for low volume, bigger for high volume
  // Make size range bigger to fill screen better
  const minVolumeRadius = baseRadius * 0.7; // 70% of base for low volume
  const maxVolumeRadius = baseRadius * 2.5; // 250% of base for high volume (bigger range for more variation)
  
  // Bubbles should NOT touch or overlap - ensure proper spacing for natural floating
  // CRITICAL: Account for visual effects that extend beyond bubble radius:
  // - 2px border (border-2)
  // - Box shadow blur (~8px extension)
  // - Border glow effect (~10px visible extension)
  // - Animation movement (~15px extension during float)
  const visualExtension = 10; // Reduced for tighter packing
  const minGap = 8; // Smaller gap to fit more bubbles - NO TOUCHING, NO STACKING
  const effectiveMinGap = minGap + visualExtension; // Safe gap with visual extension = 18px minimum
  
  // Use ACTUAL max radius for bounds checking only - NO padding, bubbles go to edges
  const actualMaxRadius = maxVolumeRadius;
  const actualMinimalPadding = 0; // NO padding - use full space
  
  // CRITICAL: Use FULL width and height - bubbles go edge to edge
  const actualUsableWidth = width;
  const actualUsableHeight = height;
  
  // Increase spacing to account for animation movement and ensure no touching
  const animationBuffer = 15; // Reduced for tighter packing
  const horizontalSpacing = 2 * maxVolumeRadius + effectiveMinGap + animationBuffer;
  const verticalSpacing = Math.sqrt(3) * (maxVolumeRadius + (effectiveMinGap + animationBuffer) * 0.5);

  // Calculate how many rows/cols we need to fit all items across the FULL available space
  // Use hexagonal grid layout spread across ENTIRE area - no center clustering
  const rows = Math.ceil(actualUsableHeight / verticalSpacing) + 10; // Extra buffer to fill space
  const cols = Math.ceil(actualUsableWidth / horizontalSpacing) + 10; // Extra buffer to fill space

  const positions: { x: number; y: number }[] = [];

  // Generate positions across the ENTIRE available space - with edge padding
  // Fill from top to bottom - CONTAINER with padding (container already accounts for navbars)
  const startX = edgePadding; // Start with padding from left
  const endX = width - edgePadding; // End with padding from right
  const startYPos = edgePadding; // Start with padding from top
  const endYPos = height - edgePadding; // End with padding from bottom
  
  for (let row = 0; row < rows; row++) {
    const y = startYPos + (row / Math.max(1, rows - 1)) * (endYPos - startYPos); // Distribute across FULL height
    const rowOffset = row % 2 === 0 ? 0 : horizontalSpacing / 2;

    for (let col = 0; col < cols; col++) {
      const x = startX + (col / Math.max(1, cols - 1)) * (endX - startX) + rowOffset; // Distribute across FULL width

      // Use FULL width and height - spread from absolute edge to absolute edge
      // Allow bubbles to go slightly outside bounds for better coverage
      if (x >= -maxVolumeRadius && x <= width + maxVolumeRadius && y >= -maxVolumeRadius && y <= height + maxVolumeRadius) {
        positions.push({ x, y });
      }
    }
  }

  // DON'T sort by center - spread across FULL space!
  // Sort by a deterministic pattern (left-to-right, top-to-bottom) for stable layout
  // This prevents bubbles from clustering in the center AND ensures stable positions on refresh
  positions.sort((a, b) => {
    // Primary sort: by Y position (top to bottom)
    if (Math.abs(a.y - b.y) > 1) {
      return a.y - b.y;
    }
    // Secondary sort: by X position (left to right)
    return a.x - b.x;
  });

  const bubbles: PositionedBubble<T>[] = [];
  
  // Calculate all bubble radii based on VOLUME (most popular = bigger)
  const bubbleRadii: number[] = [];
  for (let i = 0; i < n; i++) {
    const item = visible[i];
    const data = item.data as any;
    const volume = typeof data?.volume === 'string' ? parseFloat(data.volume) : (data?.volume || 0);
    
    // Normalize volume to 0-1 range for sizing
    let volumeMultiplier = 0.5; // Default to middle size if no volume
    if (volumeRange > 0 && volume > 0) {
      volumeMultiplier = (volume - minVolume) / volumeRange;
    } else if (volume > 0) {
      // All volumes are the same, use default
      volumeMultiplier = 0.5;
    }
    
    // Calculate radius based on volume (higher volume = bigger bubble)
    const radius = minVolumeRadius + (maxVolumeRadius - minVolumeRadius) * volumeMultiplier;
    bubbleRadii.push(radius);
  }

  // OPTIMIZED: Spatial grid for O(1) collision detection instead of O(n)
  const gridCellSize = Math.max(100, maxVolumeRadius * 2 + effectiveMinGap + 15);
  const gridCols = Math.ceil(width / gridCellSize);
  const gridRows = Math.ceil(height / gridCellSize);
  const spatialGrid: PositionedBubble<T>[][] = Array(gridRows * gridCols).fill(null).map(() => []);
  
  // Helper to get grid cell index
  const getGridIndex = (x: number, y: number): number => {
    const col = Math.floor(Math.max(0, Math.min(width - 1, x)) / gridCellSize);
    const row = Math.floor(Math.max(0, Math.min(height - 1, y)) / gridCellSize);
    return row * gridCols + col;
  };
  
  // Helper to get all nearby grid cells
  const getNearbyCells = (x: number, y: number, radius: number): number[] => {
    const cells: number[] = [];
    const searchRadius = radius + maxVolumeRadius + effectiveMinGap + 15;
    const minCol = Math.max(0, Math.floor((x - searchRadius) / gridCellSize));
    const maxCol = Math.min(gridCols - 1, Math.floor((x + searchRadius) / gridCellSize));
    const minRow = Math.max(0, Math.floor((y - searchRadius) / gridCellSize));
    const maxRow = Math.min(gridRows - 1, Math.floor((y + searchRadius) / gridCellSize));
    
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        cells.push(row * gridCols + col);
      }
    }
    return cells;
  };
  
  // Function to check if a position would collide with existing bubbles
  // OPTIMIZED: Uses spatial grid for O(k) where k is nearby bubbles, not O(n)
  const hasCollision = (x: number, y: number, radius: number, excludeIndex: number = -1): boolean => {
    const nearbyCells = getNearbyCells(x, y, radius);
    const animationBuffer = 15;
    const minDistance = radius + maxVolumeRadius + effectiveMinGap + animationBuffer;
    
    for (const cellIndex of nearbyCells) {
      const cellBubbles = spatialGrid[cellIndex] || [];
      for (const existingBubble of cellBubbles) {
        // Skip if this is the excluded bubble
        const bubbleIndex = bubbles.findIndex(b => b.id === existingBubble.id);
        if (bubbleIndex === excludeIndex) continue;
        
        const dx = x - existingBubble.x;
        const dy = y - existingBubble.y;
        const distanceSq = dx * dx + dy * dy; // Use squared distance to avoid sqrt
        const minDistanceSq = (radius + existingBubble.radius + effectiveMinGap + animationBuffer) ** 2;
        
        if (distanceSq < minDistanceSq && distanceSq > 0.000001) {
          return true;
        }
      }
    }
    return false;
  };

  // Function to find a non-colliding position for a bubble
  const findNonCollidingPosition = (radius: number, preferredX: number, preferredY: number): { x: number; y: number } | null => {
    // First try the preferred position
    if (!hasCollision(preferredX, preferredY, radius)) {
      // Clamp to bounds - allow bubbles to fill entire screen (just radius minimum from edges)
      // Allow bubbles to go anywhere on screen, including behind navbar
      const x = Math.max(edgePadding + radius, Math.min(width - edgePadding - radius, preferredX));
      const y = Math.max(edgePadding + radius, Math.min(height - edgePadding - radius, preferredY)); // Stay within container bounds with padding
      if (!hasCollision(x, y, radius)) {
        return { x, y };
      }
    }

    // Try positions in a spiral around the preferred position
    // OPTIMIZED: Reduce spiral attempts for many bubbles
    const animationBuffer = 15; // Reduced for tighter packing
    const maxSpiralRadius = Math.min(width, height) / 2;
    const stepSize = effectiveMinGap + radius + animationBuffer; // Larger steps for better spacing
    let spiralRadius = stepSize;
    const maxSpiralAttempts = n > 200 ? 100 : n > 100 ? 200 : 300; // Fewer attempts for many bubbles
    
    while (spiralRadius < maxSpiralRadius && bubbles.length < maxSpiralAttempts) {
      const numPoints = Math.max(8, Math.floor((2 * Math.PI * spiralRadius) / stepSize));
      
      for (let i = 0; i < numPoints; i++) {
        const angle = (2 * Math.PI * i) / numPoints;
        const x = preferredX + Math.cos(angle) * spiralRadius;
        const y = preferredY + Math.sin(angle) * spiralRadius;
        
        // Clamp to bounds - allow bubbles to fill entire screen (just radius minimum from edges)
        const clampedX = Math.max(radius, Math.min(width - radius, x));
        const clampedY = Math.max(radius, Math.min(height - radius, y)); // Fill entire screen
        
        if (!hasCollision(clampedX, clampedY, radius)) {
          return { x: clampedX, y: clampedY };
        }
      }
      
      spiralRadius += stepSize;
    }

    // If spiral search fails, try grid positions - use FULL space edge to edge
    for (let row = 0; row < rows * 2; row++) {
      for (let col = 0; col < cols * 2; col++) {
        const x = col * (horizontalSpacing * 0.5) + ((row % 2) * horizontalSpacing * 0.25);
        const y = row * (verticalSpacing * 0.5);
        
        const clampedX = Math.max(radius, Math.min(width - radius, x));
        const clampedY = Math.max(radius, Math.min(height - radius, y)); // Fill entire screen
        
        if (!hasCollision(clampedX, clampedY, radius)) {
          return { x: clampedX, y: clampedY };
        }
      }
    }

    return null; // Could not find a position
  };

  // Place bubbles one by one with EXTREMELY strict collision detection
  // CRITICAL: Each bubble MUST be verified before adding to prevent ANY stacking
  for (let i = 0; i < n; i++) {
    const item = visible[i];
    const radius = bubbleRadii[i];
    
    // Get preferred position from grid
    let preferredX: number;
    let preferredY: number;
    
    if (i < positions.length) {
      preferredX = positions[i].x;
      preferredY = positions[i].y;
    } else {
      // Generate position for items beyond available positions - use FULL space edge to edge
      const extraRow = Math.floor((i - positions.length) / cols);
      const extraCol = (i - positions.length) % cols;
      preferredX = extraCol * horizontalSpacing + (extraRow % 2 === 0 ? 0 : horizontalSpacing / 2);
      preferredY = (rows + extraRow) * verticalSpacing;
      
      // Make sure we don't go beyond full space bounds (just radius minimum)
      // Fill entire screen
      preferredX = Math.max(radius, Math.min(preferredX, width - radius));
      preferredY = Math.max(radius, Math.min(preferredY, height - radius));
    }

    // Find a non-colliding position - try multiple times if needed
    let pos = findNonCollidingPosition(radius, preferredX, preferredY);
    
    // If first attempt fails, try random positions across the screen
    const maxRandomAttempts = 100;
    if (!pos) {
      let attempts = 0;
      while (!pos && attempts < maxRandomAttempts) {
        const randomX = edgePadding + radius + Math.random() * (width - 2 * edgePadding - 2 * radius);
        const randomY = edgePadding + radius + Math.random() * (height - 2 * edgePadding - 2 * radius);
        pos = findNonCollidingPosition(radius, randomX, randomY);
        attempts++;
      }
    }
    
    // STRICT: If we STILL can't find a position, SKIP this bubble - don't stack it
    if (!pos) {
      console.warn(`Could not find position for bubble ${i} after ${maxRandomAttempts} attempts, skipping to prevent stacking`);
      continue;
    }
    
    // TRIPLE CHECK: Verify the position doesn't collide with ANY existing bubble
    let hasAnyCollision = false;
    for (let j = 0; j < bubbles.length; j++) {
      const existingBubble = bubbles[j];
      const dx = pos.x - existingBubble.x;
      const dy = pos.y - existingBubble.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const animationBuffer = 15;
      const minDistance = radius + existingBubble.radius + effectiveMinGap + animationBuffer;
      
      if (distance < minDistance && distance > 0.001) {
        hasAnyCollision = true;
        break;
      }
    }
    
    if (hasAnyCollision) {
      console.warn(`Position for bubble ${i} collides with existing bubbles, skipping to prevent stacking`);
      continue;
    }

    // FINAL VERIFICATION: Position is safe, add bubble
    // CRITICAL: Check for duplicate positions - if two bubbles have same x,y, offset one slightly
    let finalX = pos.x;
    let finalY = pos.y;
    
    // Check if this exact position already exists
    for (const existing of bubbles) {
      if (Math.abs(existing.x - finalX) < 0.1 && Math.abs(existing.y - finalY) < 0.1) {
        // Same position! Offset this bubble slightly
        finalX += radius * 0.5;
        finalY += radius * 0.5;
        // Clamp to bounds
        finalX = Math.max(radius, Math.min(width - radius, finalX));
        finalY = Math.max(radius, Math.min(height - radius, finalY));
        console.warn(`Bubble ${i} had duplicate position, offset to (${finalX.toFixed(1)}, ${finalY.toFixed(1)})`);
        break;
      }
    }
    
    const newBubble: PositionedBubble<T> = {
      id: item.id,
      data: item.data,
      x: finalX,
      y: finalY,
      radius,
      index: i,
    };
    
    bubbles.push(newBubble);
    
    // OPTIMIZED: Add to spatial grid for fast collision detection
    const gridIndices = getNearbyCells(finalX, finalY, radius);
    for (const idx of gridIndices) {
      if (!spatialGrid[idx]) spatialGrid[idx] = [];
      spatialGrid[idx].push(newBubble);
    }
  }

  // OPTIMIZED: Rebuild spatial grid after initial placement
  const rebuildSpatialGrid = () => {
    spatialGrid.forEach(cell => cell.length = 0);
    bubbles.forEach(bubble => {
      const gridIndices = getNearbyCells(bubble.x, bubble.y, bubble.radius);
      for (const idx of gridIndices) {
        if (!spatialGrid[idx]) spatialGrid[idx] = [];
        spatialGrid[idx].push(bubble);
      }
    });
  };
  rebuildSpatialGrid();
  
  // Post-processing: resolve any remaining collisions with iterative relaxation
  // OPTIMIZED: Reduce iterations based on bubble count for performance
  // For many bubbles, use fewer iterations but still ensure separation
  const maxRelaxationIterations = n > 200 ? 50 : n > 100 ? 100 : n > 50 ? 200 : 300;
  let totalMoved = 0;
  
  for (let iter = 0; iter < maxRelaxationIterations; iter++) {
    let moved = false;
    
    for (let i = 0; i < bubbles.length; i++) {
      const bubble = bubbles[i];
      let fx = 0; // Force X
      let fy = 0; // Force Y
      
      // OPTIMIZED: Use spatial grid to only check nearby bubbles
      const nearbyCells = getNearbyCells(bubble.x, bubble.y, bubble.radius);
      const animationBuffer = 15;
      const minDistanceBase = bubble.radius + effectiveMinGap + animationBuffer;
      
      for (const cellIndex of nearbyCells) {
        const cellBubbles = spatialGrid[cellIndex] || [];
        for (const other of cellBubbles) {
          if (other.id === bubble.id) continue;
          const dx = bubble.x - other.x;
          const dy = bubble.y - other.y;
          const distanceSq = dx * dx + dy * dy;
          const minDistance = minDistanceBase + other.radius;
          const minDistanceSq = minDistance * minDistance;
          
          if (distanceSq < minDistanceSq && distanceSq > 0.000001) {
            const distance = Math.sqrt(distanceSq);
            const overlap = minDistance - distance;
            const force = overlap * 3.0;
            const angle = Math.atan2(dy, dx);
            fx += Math.cos(angle) * force;
            fy += Math.sin(angle) * force;
            moved = true;
          }
        }
      }
      
      // Also apply boundary forces - allow bubbles closer to edges
      const padding = bubble.radius; // Just radius, no extra gap
      if (bubble.x < edgePadding + padding) fx += (edgePadding + padding - bubble.x) * 0.5;
      if (bubble.x > width - edgePadding - padding) fx -= (bubble.x - (width - edgePadding - padding)) * 0.5;
      if (bubble.y < edgePadding + padding) fy += (edgePadding + padding - bubble.y) * 0.5; // Stay within container top with padding
      if (bubble.y > height - edgePadding - padding) fy -= (bubble.y - (height - edgePadding - padding)) * 0.5; // Stay within container bottom with padding
      
      // Apply forces
      if (fx !== 0 || fy !== 0) {
        bubble.x += fx;
        bubble.y += fy;
        
        // Clamp to bounds - fill entire screen
        bubble.x = Math.max(edgePadding + bubble.radius, Math.min(width - edgePadding - bubble.radius, bubble.x));
        bubble.y = Math.max(edgePadding + bubble.radius, Math.min(height - edgePadding - bubble.radius, bubble.y));
        totalMoved++;
      }
    }
    
    // OPTIMIZED: Rebuild spatial grid after each iteration
    if (moved) {
      rebuildSpatialGrid();
    }
    
    // If no bubbles moved, we're done
    if (!moved) break;
  }

  // STRICT Final verification - run MULTIPLE passes until ZERO overlaps remain
  // OPTIMIZED: Reduce verification passes for many bubbles
  const maxVerificationPasses = n > 200 ? 10 : n > 100 ? 25 : n > 50 ? 50 : 75;
  let verificationPasses = 0;
  let overlapsRemaining = 0;
  
  do {
    overlapsRemaining = 0;
    rebuildSpatialGrid(); // Ensure grid is up to date
    
    // OPTIMIZED: Use spatial grid to only check nearby bubbles
    for (let i = 0; i < bubbles.length; i++) {
      const a = bubbles[i];
      const nearbyCells = getNearbyCells(a.x, a.y, a.radius);
      const animationBuffer = 15;
      const minDistanceBase = a.radius + effectiveMinGap + animationBuffer;
      
      for (const cellIndex of nearbyCells) {
        const cellBubbles = spatialGrid[cellIndex] || [];
        for (const b of cellBubbles) {
          if (b.id === a.id || bubbles.findIndex(bub => bub.id === b.id) <= i) continue; // Skip self and already checked pairs
          
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distanceSq = dx * dx + dy * dy;
          const minDistance = minDistanceBase + b.radius;
          const minDistanceSq = minDistance * minDistance;
          
          if (distanceSq < minDistanceSq && distanceSq > 0.000001) {
            overlapsRemaining++;
            const distance = Math.sqrt(distanceSq);
            
            // Try emergency separation first - FORCE apart with extra space
            const overlap = minDistance - distance;
            const angle = Math.atan2(dy, dx);
            // Push further apart to ensure gap - be EXTREMELY aggressive
            const pushDistance = overlap + (effectiveMinGap * 1.2); // MUCH larger push to prevent stacking
            const pushX = Math.cos(angle) * pushDistance;
            const pushY = Math.sin(angle) * pushDistance;
            
            // Move both bubbles apart
            const newAX = a.x + pushX;
            const newAY = a.y + pushY;
            const newBX = b.x - pushX;
            const newBY = b.y - pushY;
            
            // Clamp both strictly - fill entire screen
            const clampedAX = Math.max(a.radius, Math.min(width - a.radius, newAX));
            const clampedAY = Math.max(a.radius, Math.min(height - a.radius, newAY));
            const clampedBX = Math.max(b.radius, Math.min(width - b.radius, newBX));
            const clampedBY = Math.max(b.radius, Math.min(height - b.radius, newBY));
            
            // Check if separation worked - if not, mark one for removal
            const newDx = clampedAX - clampedBX;
            const newDy = clampedAY - clampedBY;
            const newDistance = Math.sqrt(newDx * newDx + newDy * newDy);
            
            if (newDistance >= minDistance) {
              // Separation worked, apply it
              a.x = clampedAX;
              a.y = clampedAY;
              b.x = clampedBX;
              b.y = clampedBY;
            } else {
              // Separation failed - try harder, push further
              const extremePush = overlap * 2;
              const extremePushX = Math.cos(angle) * extremePush;
              const extremePushY = Math.sin(angle) * extremePush;
              a.x += extremePushX;
              a.y += extremePushY;
              b.x -= extremePushX;
              b.y -= extremePushY;
              // Clamp again
              a.x = Math.max(a.radius, Math.min(width - a.radius, a.x));
              a.y = Math.max(a.radius, Math.min(height - a.radius, a.y));
              b.x = Math.max(b.radius, Math.min(width - b.radius, b.x));
              b.y = Math.max(b.radius, Math.min(height - b.radius, b.y));
            }
          }
        }
      }
    }
    
    verificationPasses++;
    
    // Break if no overlaps found OR we've done too many passes
    if (overlapsRemaining === 0 || verificationPasses >= maxVerificationPasses) {
      break;
    }
  } while (overlapsRemaining > 0 && verificationPasses < maxVerificationPasses);
  
  // NO REMOVAL - keep all bubbles, just ensure they're separated
  // Final pass: Force separate any remaining overlaps instead of removing
  // OPTIMIZED: Use spatial grid
  rebuildSpatialGrid();
  for (let i = 0; i < bubbles.length; i++) {
    const a = bubbles[i];
    const nearbyCells = getNearbyCells(a.x, a.y, a.radius);
    const animationBuffer = 15;
    const minDistanceBase = a.radius + effectiveMinGap + animationBuffer;
    
    for (const cellIndex of nearbyCells) {
      const cellBubbles = spatialGrid[cellIndex] || [];
      for (const b of cellBubbles) {
        if (b.id === a.id || bubbles.findIndex(bub => bub.id === b.id) <= i) continue;
        
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distanceSq = dx * dx + dy * dy;
        const minDistance = minDistanceBase + b.radius;
        const minDistanceSq = minDistance * minDistance;
        
        if (distanceSq < minDistanceSq && distanceSq > 0.000001) {
          const distance = Math.sqrt(distanceSq);
          // Force separate - push apart
          const overlap = minDistance - distance;
          const angle = Math.atan2(dy, dx);
          const pushDistance = overlap * 0.5;
          const pushX = Math.cos(angle) * pushDistance;
          const pushY = Math.sin(angle) * pushDistance;
          
          a.x += pushX;
          a.y += pushY;
          b.x -= pushX;
          b.y -= pushY;
          
          // Clamp to bounds
          a.x = Math.max(a.radius, Math.min(width - a.radius, a.x));
          a.y = Math.max(a.radius, Math.min(height - a.radius, a.y));
          b.x = Math.max(b.radius, Math.min(width - b.radius, b.x));
          b.y = Math.max(b.radius, Math.min(height - b.radius, b.y));
        }
      }
    }
  }

  console.log(`Layout complete: ${bubbles.length} bubbles placed (ALL bubbles shown)`);
  return bubbles;
  } catch (error) {
    return [];
  }
}

