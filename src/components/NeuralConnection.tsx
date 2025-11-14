import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface NeuralConnectionProps {
  startPos: { x: number; y: number };
  endPos: { x: number; y: number };
  isActive: boolean;
}

export const NeuralConnection = ({ startPos, endPos, isActive }: NeuralConnectionProps) => {
  const [pathD, setPathD] = useState("");

  useEffect(() => {
    // Create a curved path between start and end
    const midX = (startPos.x + endPos.x) / 2;
    const midY = (startPos.y + endPos.y) / 2;
    const dx = endPos.x - startPos.x;
    const dy = endPos.y - startPos.y;
    const offset = Math.sqrt(dx * dx + dy * dy) * 0.2;

    const path = `M ${startPos.x} ${startPos.y} Q ${midX - offset} ${midY + offset} ${endPos.x} ${endPos.y}`;
    setPathD(path);
  }, [startPos, endPos]);

  if (!isActive) return null;

  return (
    <svg
      className="fixed inset-0 pointer-events-none z-30"
      style={{ width: '100vw', height: '100vh' }}
    >
      {/* Glow effect */}
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <motion.path
        d={pathD}
        stroke="hsl(var(--accent))"
        strokeWidth="3"
        fill="none"
        filter="url(#glow)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ 
          pathLength: [0, 1, 1],
          opacity: [0, 1, 0]
        }}
        transition={{ duration: 1.5, times: [0, 0.5, 1] }}
      />

      {/* Animated particles along the path */}
      <motion.circle
        r="4"
        fill="hsl(var(--accent))"
        initial={{ offsetDistance: "0%", opacity: 0 }}
        animate={{
          offsetDistance: "100%",
          opacity: [0, 1, 1, 0]
        }}
        transition={{ duration: 1.5, times: [0, 0.2, 0.8, 1] }}
        style={{
          offsetPath: `path('${pathD}')`,
          offsetRotate: "0deg",
        } as any}
      />
    </svg>
  );
};
