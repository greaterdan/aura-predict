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
  if (!width || !height || items.length === 0) return [];

  const visible = items.slice(0, maxVisible);
  const n = visible.length;

  const margin = 30; // Reduced margin to use more space
  const innerWidth = Math.max(40, width - margin * 2);
  const innerHeight = Math.max(40, height - margin * 2);

  // Center in the available space
  const cx = width / 2;
  const cy = height / 2;

  // Use the smaller dimension to ensure circular cluster fits
  let clusterRadius = Math.min(innerWidth, innerHeight) / 2;
  clusterRadius -= 30; // breathing room from edges
  if (clusterRadius <= 0) clusterRadius = Math.min(innerWidth, innerHeight) / 2;
  
  // Ensure cluster is centered and fits within available space
  const maxClusterRadius = Math.min(width / 2 - margin, height / 2 - margin);
  clusterRadius = Math.min(clusterRadius, maxClusterRadius);

  // Estimate radius from available circular area
  const clusterArea = Math.PI * clusterRadius * clusterRadius;
  const areaPer = clusterArea / (n * 1.5); // 1.5 = more space between bubbles
  let estimatedRadius = Math.sqrt(areaPer / Math.PI);

  // Clamp so text stays readable and fits all content - LARGER bubbles
  const radius = Math.max(50, Math.min(90, estimatedRadius));
  const gap = radius * 0.4; // Moderate gap - bubbles close but not touching

  const horizontalSpacing = 2 * radius + gap;
  const verticalSpacing = Math.sqrt(3) * (radius + gap * 0.5);

  const rows = Math.ceil((2 * clusterRadius) / verticalSpacing) + 2;
  const cols = Math.ceil((2 * clusterRadius) / horizontalSpacing) + 2;

  const positions: { x: number; y: number }[] = [];

  const startY = cy - ((rows - 1) * verticalSpacing) / 2;
  const startX = cx - ((cols - 1) * horizontalSpacing) / 2;

  for (let row = 0; row < rows; row++) {
    const y = startY + row * verticalSpacing;
    const rowOffset = row % 2 === 0 ? 0 : horizontalSpacing / 2;

    for (let col = 0; col < cols; col++) {
      const x = startX + col * horizontalSpacing + rowOffset;

      const dx = x - cx;
      const dy = y - cy;
      const distSq = dx * dx + dy * dy;

      if (distSq <= clusterRadius * clusterRadius) {
        positions.push({ x, y });
      }
    }
  }

  // Fill from center outwards
  positions.sort((a, b) => {
    const da = (a.x - cx) ** 2 + (a.y - cy) ** 2;
    const db = (b.x - cx) ** 2 + (b.y - cy) ** 2;
    return da - db;
  });

  const bubbles: PositionedBubble<T>[] = [];
  const count = Math.min(n, positions.length);
  const jitter = radius * 0.1; // smaller jitter so layout stays clean

  for (let i = 0; i < count; i++) {
    const item = visible[i];
    const pos = positions[i];

    let x = pos.x + (Math.random() - 0.5) * jitter;
    let y = pos.y + (Math.random() - 0.5) * jitter;

    // Clamp back inside the circle so edges never cut bubbles
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = clusterRadius - radius;
    if (dist > maxDist) {
      const scale = maxDist / dist;
      x = cx + dx * scale;
      y = cy + dy * scale;
    }

    bubbles.push({
      id: item.id,
      data: item.data,
      x,
      y,
      radius,
      index: i,
    });
  }

  return bubbles;
}

