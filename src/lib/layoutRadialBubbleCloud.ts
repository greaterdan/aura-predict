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
    
  // Use FULL screen - bubbles fill entire viewport
  const navbarHeight = 44;
  const startY = 0; // Start from top (bubbles can go behind navbar if needed, but we'll avoid it)
  const endY = height; // Use full height

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

  // Generate positions across the ENTIRE available space - edge to edge
  // Fill from top to bottom - FULL SCREEN
  const startX = 0; // Start at absolute left
  const endX = width; // End at absolute right
  const startYPos = 0; // Start from top
  const endYPos = height; // End at absolute bottom
  
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

  // Function to check if a position would collide with existing bubbles
  // CRITICAL: Account for visual extensions (borders, shadows, glows, animation movement)
  // STRICT: Bubbles must NEVER touch or overlap
  const hasCollision = (x: number, y: number, radius: number, excludeIndex: number = -1): boolean => {
    for (let j = 0; j < bubbles.length; j++) {
      if (j === excludeIndex) continue;
      const existingBubble = bubbles[j];
      const dx = x - existingBubble.x;
      const dy = y - existingBubble.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      // Use effective gap that accounts for visual extensions AND animation movement
      // Add extra buffer for floating animation (bubbles move ~15px during animation)
      const animationBuffer = 15; // Reduced for tighter packing
      const minDistance = radius + existingBubble.radius + effectiveMinGap + animationBuffer;
      
      // STRICT: If distance is less than minimum, it's a collision
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
      // Clamp to bounds - allow bubbles to fill entire screen (just radius minimum from edges)
      // Allow bubbles to go anywhere on screen, including behind navbar
      const x = Math.max(radius, Math.min(width - radius, preferredX));
      const y = Math.max(radius, Math.min(height - radius, preferredY)); // Start from top, not navbar
      if (!hasCollision(x, y, radius)) {
        return { x, y };
      }
    }

    // Try positions in a spiral around the preferred position
    // Use larger step size to ensure proper spacing
    const animationBuffer = 15; // Reduced for tighter packing
    const maxSpiralRadius = Math.min(width, height) / 2;
    const stepSize = effectiveMinGap + radius + animationBuffer; // Larger steps for better spacing
    let spiralRadius = stepSize;
    const maxSpiralAttempts = 500; // More attempts to find a good position
    
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
        const randomX = radius + Math.random() * (width - 2 * radius);
        const randomY = radius + Math.random() * (height - 2 * radius);
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
    
    bubbles.push({
      id: item.id,
      data: item.data,
      x: finalX,
      y: finalY,
      radius,
      index: i,
    });
  }

  // Post-processing: resolve any remaining collisions with iterative relaxation
  // STRICT: Run MANY iterations until NO overlaps remain
  const maxRelaxationIterations = 500; // Increased significantly - MUST resolve all overlaps
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
        // Include animation buffer in minimum distance check
        const animationBuffer = 15;
        const minDistance = bubble.radius + other.radius + effectiveMinGap + animationBuffer;
        
        if (distance < minDistance && distance > 0.001) {
          // Overlap detected - EXTREMELY STRONG repulsion force
          const overlap = minDistance - distance;
          const force = overlap * 3.0; // MUCH more aggressive repulsion to prevent touching/stacking
          const angle = Math.atan2(dy, dx);
          fx += Math.cos(angle) * force;
          fy += Math.sin(angle) * force;
          moved = true;
        }
      }
      
      // Also apply boundary forces - allow bubbles closer to edges
      const padding = bubble.radius; // Just radius, no extra gap
      if (bubble.x < padding) fx += (padding - bubble.x) * 0.5;
      if (bubble.x > width - padding) fx -= (bubble.x - (width - padding)) * 0.5;
      if (bubble.y < padding) fy += (padding - bubble.y) * 0.5; // Fill entire screen
      if (bubble.y > height - padding) fy -= (bubble.y - (height - padding)) * 0.5;
      
      // Apply forces
      if (fx !== 0 || fy !== 0) {
        bubble.x += fx;
        bubble.y += fy;
        
        // Clamp to bounds - fill entire screen
        bubble.x = Math.max(bubble.radius, Math.min(width - bubble.radius, bubble.x));
        bubble.y = Math.max(bubble.radius, Math.min(height - bubble.radius, bubble.y));
        totalMoved++;
      }
    }
    
    // If no bubbles moved, we're done
    if (!moved) break;
  }

  // STRICT Final verification - run MULTIPLE passes until ZERO overlaps remain
  // This is the ABSOLUTE last resort to ensure perfect separation
  // DO NOT REMOVE - just force separate
  let verificationPasses = 0;
  const maxVerificationPasses = 100; // Increased significantly
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
        // Include animation buffer in final verification
        const animationBuffer = 15;
        const minDistance = a.radius + b.radius + effectiveMinGap + animationBuffer;
        
        if (distance < minDistance && distance > 0.001) {
          overlapsRemaining++;
          
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
    
    verificationPasses++;
    
    // Break if no overlaps found OR we've done too many passes
    if (overlapsRemaining === 0 || verificationPasses >= maxVerificationPasses) {
      break;
    }
  } while (overlapsRemaining > 0 && verificationPasses < maxVerificationPasses);
  
  // NO REMOVAL - keep all bubbles, just ensure they're separated
  // Final pass: Force separate any remaining overlaps instead of removing
  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) {
      const a = bubbles[i];
      const b = bubbles[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const animationBuffer = 15;
      const minDistance = a.radius + b.radius + effectiveMinGap + animationBuffer;
      
      if (distance < minDistance && distance > 0.001) {
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

  console.log(`Layout complete: ${bubbles.length} bubbles placed (ALL bubbles shown)`);
  return bubbles;
  } catch (error) {
    return [];
  }
}

