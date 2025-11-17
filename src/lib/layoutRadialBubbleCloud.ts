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
  maxVisible = 1000 // Show ALL markets - no artificial limit
): PositionedBubble<T>[] {
  try {
    if (!width || !height || items.length === 0) {
      console.log('⚠️ Layout skipped: invalid dimensions or no items', { width, height, itemsLength: items.length });
      return [];
    }

  // Navbar is h-11 (44px) - bubbles must stay below it
  const navbarHeight = 44;
  const startY = navbarHeight; // Start below navbar

  const visible = items.slice(0, maxVisible);
  const n = visible.length;

  // USE FULL SPACE - ABSOLUTE MINIMAL PADDING - BUBBLES GO TO EDGES
  // Don't estimate - calculate properly from actual bubble sizes
  // We'll recalculate after we know bubble sizes, but use a conservative estimate first
  const tempMaxRadius = 70; // Conservative max radius estimate
  const tempMinPadding = 0; // NO padding - bubbles go to absolute edges
  
  // Use FULL width and height - NO padding - bubbles fill edge to edge
  const usableWidth = width;
  const usableHeight = height;
  
  // NO CENTER CALCULATION - we spread across FULL space, not centered
  
  // Estimate radius from available area (rectangular, not circular)
  const totalArea = usableWidth * usableHeight;
  const areaPer = totalArea / (n * 1.5); // Space per bubble
  let estimatedRadius = Math.sqrt(areaPer / Math.PI);

  // Base radius - ADJUST SIZE BASED ON SPACE AVAILABLE AND NUMBER OF ITEMS
  // Smaller bubbles = more space to prevent stacking
  // Calculate based on available space and item count
  const spacePerBubble = (usableWidth * usableHeight) / n;
  const radiusFromSpace = Math.sqrt(spacePerBubble / Math.PI) * 0.4; // Use 40% of available space per bubble
  
  // Size constraints - make smaller to fit more bubbles densely packed
  const minRadius = n > 100 ? 35 : n > 50 ? 40 : 45; // Smaller base sizes for denser packing
  const maxRadius = n > 100 ? 50 : n > 50 ? 60 : 70; // Smaller max sizes
  const baseRadius = Math.max(minRadius, Math.min(maxRadius, Math.min(radiusFromSpace, estimatedRadius)));
  
  // Calculate bubble sizes based on price (higher price = bigger bubble)
  // Price range: 0.01 to 0.99, map to radius range
  const minPriceRadius = baseRadius * 0.8; // 80% of base for low prices
  const maxPriceRadius = baseRadius * 1.3; // 130% of base for high prices
  
  // Bubbles should be close together - minimal gap just for visual separation
  // CRITICAL: Account for visual effects that extend beyond bubble radius:
  // - 2px border (border-2)
  // - Box shadow blur (~8px extension)
  // - Border glow effect (~10-15px visible extension)
  const visualExtension = 10; // Reduced - account for borders, shadows, and glows extending beyond radius
  const minGap = 5; // MINIMAL gap between bubbles - they should be close together like banter bubbles
  const effectiveMinGap = minGap + visualExtension; // Minimal gap with visual extension
  
  // Use ACTUAL max radius for bounds checking only - NO padding, bubbles go to edges
  const actualMaxRadius = maxPriceRadius;
  const actualMinimalPadding = 0; // NO padding - use full space
  
  // CRITICAL: Use FULL width and height - bubbles go edge to edge
  const actualUsableWidth = width;
  const actualUsableHeight = height;
  
  const horizontalSpacing = 2 * maxPriceRadius + effectiveMinGap;
  const verticalSpacing = Math.sqrt(3) * (maxPriceRadius + effectiveMinGap * 0.5);

  // Calculate how many rows/cols we need to fit all items across the FULL available space
  // Use hexagonal grid layout spread across ENTIRE area - no center clustering
  const rows = Math.ceil(actualUsableHeight / verticalSpacing) + 10; // Extra buffer to fill space
  const cols = Math.ceil(actualUsableWidth / horizontalSpacing) + 10; // Extra buffer to fill space

  const positions: { x: number; y: number }[] = [];

  // Generate positions across the ENTIRE available space - edge to edge
  // Fill from below navbar to absolute bottom - NO PADDING on sides
  // startY is already set to navbarHeight above
  const startX = 0; // Start at absolute left
  const endX = width; // End at absolute right
  const endY = height; // End at absolute bottom
  
  for (let row = 0; row < rows; row++) {
    const y = startY + (row / Math.max(1, rows - 1)) * (endY - startY); // Distribute across FULL height
    const rowOffset = row % 2 === 0 ? 0 : horizontalSpacing / 2;

    for (let col = 0; col < cols; col++) {
      const x = startX + (col / Math.max(1, cols - 1)) * (endX - startX) + rowOffset; // Distribute across FULL width

      // Use FULL width and height - spread from absolute edge to absolute edge
      if (x >= 0 && x <= width && y >= 0 && y <= height) {
        positions.push({ x, y });
      }
    }
  }
  
  console.log(`📐 Layout space: ${width}x${height}, Usable: ${actualUsableWidth}x${actualUsableHeight}, Positions: ${positions.length} (${rows} rows x ${cols} cols)`);

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
  
  // Calculate all bubble radii first
  const bubbleRadii: number[] = [];
  for (let i = 0; i < n; i++) {
    const item = visible[i];
    const data = item.data as any;
    const price = data?.price ?? 0.5;
    const position = data?.position ?? 'YES';
    const priceMultiplier = position === 'YES' ? price : (1 - price);
    const radius = minPriceRadius + (maxPriceRadius - minPriceRadius) * priceMultiplier;
    bubbleRadii.push(radius);
  }

  // Function to check if a position would collide with existing bubbles
  // CRITICAL: Account for visual extensions (borders, shadows, glows)
  const hasCollision = (x: number, y: number, radius: number, excludeIndex: number = -1): boolean => {
    for (let j = 0; j < bubbles.length; j++) {
      if (j === excludeIndex) continue;
      const existingBubble = bubbles[j];
      const dx = x - existingBubble.x;
      const dy = y - existingBubble.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      // Use effective gap that accounts for visual extensions
      const minDistance = radius + existingBubble.radius + effectiveMinGap;
      
      if (distance < minDistance && distance > 0.001) {
        return true;
      }
    }
    return false;
  };

  // Function to find a non-colliding position for a bubble
  const findNonCollidingPosition = (radius: number, preferredX: number, preferredY: number): { x: number; y: number } | null => {
    // First try the preferred position
    if (!hasCollision(preferredX, preferredY, radius)) {
      // Clamp to bounds - allow bubbles to go closer to edges (just radius minimum)
      // Y must be at least navbarHeight + radius to stay below navbar
      const x = Math.max(radius, Math.min(width - radius, preferredX));
      const y = Math.max(navbarHeight + radius, Math.min(height - radius, preferredY));
      if (!hasCollision(x, y, radius)) {
        return { x, y };
      }
    }

    // Try positions in a spiral around the preferred position
    const maxSpiralRadius = Math.min(width, height) / 2;
    const stepSize = effectiveMinGap + radius;
    let spiralRadius = stepSize;
    const maxSpiralAttempts = 200; // Maximum positions to try in spiral
    
    while (spiralRadius < maxSpiralRadius && bubbles.length < maxSpiralAttempts) {
      const numPoints = Math.max(8, Math.floor((2 * Math.PI * spiralRadius) / stepSize));
      
      for (let i = 0; i < numPoints; i++) {
        const angle = (2 * Math.PI * i) / numPoints;
        const x = preferredX + Math.cos(angle) * spiralRadius;
        const y = preferredY + Math.sin(angle) * spiralRadius;
        
        // Clamp to bounds - allow bubbles closer to edges (just radius minimum)
        // Y must be at least navbarHeight + radius to stay below navbar
        const clampedX = Math.max(radius, Math.min(width - radius, x));
        const clampedY = Math.max(navbarHeight + radius, Math.min(height - radius, y));
        
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
        const clampedY = Math.max(navbarHeight + radius, Math.min(height - radius, y)); // Y must be at least navbarHeight + radius
        
        if (!hasCollision(clampedX, clampedY, radius)) {
          return { x: clampedX, y: clampedY };
        }
      }
    }

    return null; // Could not find a position
  };

  // Place bubbles one by one with strict collision detection
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
      // Y must be at least navbarHeight + radius to stay below navbar
      preferredX = Math.max(radius, Math.min(preferredX, width - radius));
      preferredY = Math.max(navbarHeight + radius, Math.min(preferredY, height - radius));
    }

    // Find a non-colliding position
    const pos = findNonCollidingPosition(radius, preferredX, preferredY);
    
    if (!pos) {
      console.warn(`⚠️ Could not find position for bubble ${i}, skipping`);
      continue;
    }

    bubbles.push({
      id: item.id,
      data: item.data,
      x: pos.x,
      y: pos.y,
      radius,
      index: i,
    });
  }

  // Post-processing: resolve any remaining collisions with iterative relaxation
  // STRICT: Run MANY iterations until NO overlaps remain
  const maxRelaxationIterations = 300; // Increased significantly
  let totalMoved = 0;
  
  for (let iter = 0; iter < maxRelaxationIterations; iter++) {
    let moved = false;
    
    for (let i = 0; i < bubbles.length; i++) {
      const bubble = bubbles[i];
      let fx = 0; // Force X
      let fy = 0; // Force Y
      
      // Calculate repulsion forces from all other bubbles
      for (let j = 0; j < bubbles.length; j++) {
        if (i === j) continue;
        const other = bubbles[j];
        const dx = bubble.x - other.x;
        const dy = bubble.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = bubble.radius + other.radius + effectiveMinGap;
        
        if (distance < minDistance && distance > 0.001) {
          // Overlap detected - STRONG repulsion force
          const overlap = minDistance - distance;
          const force = overlap * 1.5; // Even more aggressive repulsion
          const angle = Math.atan2(dy, dx);
          fx += Math.cos(angle) * force;
          fy += Math.sin(angle) * force;
          moved = true;
        }
      }
      
      // Also apply boundary forces - allow bubbles closer to edges
      const padding = bubble.radius; // Just radius, no extra gap
      const minY = navbarHeight + bubble.radius; // Minimum Y to stay below navbar
      if (bubble.x < padding) fx += (padding - bubble.x) * 0.5;
      if (bubble.x > width - padding) fx -= (bubble.x - (width - padding)) * 0.5;
      if (bubble.y < minY) fy += (minY - bubble.y) * 0.5; // Push below navbar
      if (bubble.y > height - padding) fy -= (bubble.y - (height - padding)) * 0.5;
      
      // Apply forces
      if (fx !== 0 || fy !== 0) {
        bubble.x += fx;
        bubble.y += fy;
        
        // Clamp to bounds - allow bubbles closer to edges
        // Y must be at least navbarHeight + radius to stay below navbar
        bubble.x = Math.max(bubble.radius, Math.min(width - bubble.radius, bubble.x));
        bubble.y = Math.max(minY, Math.min(height - bubble.radius, bubble.y));
        totalMoved++;
      }
    }
    
    // If no bubbles moved, we're done
    if (!moved) break;
  }
  
  console.log(`🔧 Relaxation: ${totalMoved} moves made across iterations`);

  // STRICT Final verification - run MULTIPLE passes until ZERO overlaps remain
  // This is the ABSOLUTE last resort to ensure perfect separation
  let verificationPasses = 0;
  const maxVerificationPasses = 50;
  let overlapsRemaining = 0;
  
  do {
    overlapsRemaining = 0;
    
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const a = bubbles[i];
        const b = bubbles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = a.radius + b.radius + effectiveMinGap;
        
        if (distance < minDistance && distance > 0.001) {
          overlapsRemaining++;
          
          // Emergency separation - FORCE apart with extra space
          const overlap = minDistance - distance;
          const angle = Math.atan2(dy, dx);
          // Push further apart to ensure gap - be VERY aggressive
          const pushDistance = (overlap / 2) + (effectiveMinGap * 0.3); // Add extra push
          const pushX = Math.cos(angle) * pushDistance;
          const pushY = Math.sin(angle) * pushDistance;
          
          // Move both bubbles apart
          a.x += pushX;
          a.y += pushY;
          b.x -= pushX;
          b.y -= pushY;
          
          // Clamp both strictly - allow closer to edges
          // Y must be at least navbarHeight + radius to stay below navbar
          a.x = Math.max(a.radius, Math.min(width - a.radius, a.x));
          a.y = Math.max(navbarHeight + a.radius, Math.min(height - a.radius, a.y));
          b.x = Math.max(b.radius, Math.min(width - b.radius, b.x));
          b.y = Math.max(navbarHeight + b.radius, Math.min(height - b.radius, b.y));
          
          // Verify they're actually separated now
          const newDx = a.x - b.x;
          const newDy = a.y - b.y;
          const newDistance = Math.sqrt(newDx * newDx + newDy * newDy);
          
          // If still overlapping after push, use more extreme separation
          if (newDistance < minDistance && newDistance > 0.001) {
            const extremeAngle = Math.atan2(newDy, newDx);
            const extremePush = minDistance - newDistance + effectiveMinGap; // Extra gap
            a.x = b.x + Math.cos(extremeAngle) * (b.radius + a.radius + effectiveMinGap);
            a.y = b.y + Math.sin(extremeAngle) * (b.radius + a.radius + effectiveMinGap);
            
            // Clamp again - allow closer to edges
            // Y must be at least navbarHeight + radius to stay below navbar
            a.x = Math.max(a.radius, Math.min(width - a.radius, a.x));
            a.y = Math.max(navbarHeight + a.radius, Math.min(height - a.radius, a.y));
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
  
  // Final count of remaining overlaps (should be ZERO)
  let finalOverlaps = 0;
  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) {
      const a = bubbles[i];
      const b = bubbles[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = a.radius + b.radius + effectiveMinGap;
      if (distance < minDistance && distance > 0.001) {
        finalOverlaps++;
      }
    }
  }
  
  if (finalOverlaps > 0) {
    console.warn(`⚠️ WARNING: ${finalOverlaps} overlaps still remain after ${verificationPasses} verification passes!`);
  } else {
    console.log(`✅ Verification: All bubbles properly separated (${verificationPasses} passes)`);
  }

  console.log(`📊 Layout: ${n} items, ${positions.length} positions generated, ${bubbles.length} bubbles created`);
  return bubbles;
  } catch (error) {
    console.error('❌ Error in layoutRadialBubbleCloud:', error);
    return [];
  }
}

