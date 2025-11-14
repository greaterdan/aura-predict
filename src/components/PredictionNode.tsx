import { motion } from "framer-motion";
import { useState } from "react";

export interface PredictionNodeData {
  id: string;
  question: string;
  probability: number;
  position: "YES" | "NO";
  price: number;
  change: number;
  agentName: string;
  agentEmoji: string;
  reasoning: string;
}

interface PredictionNodeProps {
  data: PredictionNodeData;
  position: { x: number; y: number };
  isHighlighted?: boolean;
  onClick?: () => void;
  onShowTrades?: () => void;
}

export const PredictionNode = ({ data, position, isHighlighted, onClick, onShowTrades }: PredictionNodeProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const borderColor = data.position === "YES" 
    ? "border-trade-yes" 
    : data.position === "NO" 
    ? "border-trade-no" 
    : "border-terminal-gray";

  const accentColor = data.position === "YES" 
    ? "text-trade-yes" 
    : "text-trade-no";

  return (
    <>
      <motion.div
        className="absolute cursor-pointer select-none"
        style={{ left: position.x, top: position.y }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* The actual circular bubble */}
        <div className={`relative w-56 h-56 rounded-full bg-card border-2 ${borderColor} p-4 flex flex-col items-center justify-center text-center ${isHighlighted ? 'opacity-100' : 'opacity-90'}`}>
          {/* Probability */}
          <div className={`text-4xl font-bold ${accentColor} mb-1`}>
            {data.probability}%
          </div>
          
          {/* Position Tag */}
          <div className={`text-xs px-3 py-1 border ${borderColor} ${accentColor} font-mono rounded-full mb-2`}>
            {data.position}
          </div>

          {/* Market Title */}
          <div className="text-xs text-foreground mb-2 leading-tight font-medium px-2">
            {data.question.length > 60 ? data.question.substring(0, 60) + '...' : data.question}
          </div>

          {/* Agent */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <span>{data.agentEmoji}</span>
            <span className="font-mono">{data.agentName}</span>
          </div>

          {/* Price & Change */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-foreground font-mono">${data.price.toFixed(2)}</span>
            <span className={data.change >= 0 ? 'text-trade-yes' : 'text-trade-no'}>
              {data.change >= 0 ? '+' : ''}{data.change.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Pulse animation on highlight */}
        {isHighlighted && (
          <motion.div
            className={`absolute inset-0 border-2 ${borderColor} pointer-events-none rounded-full`}
            animate={{
              opacity: [0.5, 0, 0.5],
              scale: [1, 1.1, 1],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </motion.div>

      {/* Hover Tooltip */}
      {showTooltip && (
        <motion.div
          className="fixed z-50 w-80 bg-card border border-border p-3 shadow-lg rounded-xl"
          style={{ 
            left: position.x + 250, 
            top: position.y,
          }}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.15 }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <div className="text-xs text-terminal-accent font-mono mb-2">
            &gt; AI_REASONING
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed mb-3">
            {data.reasoning}
          </div>
          <div className="text-xs text-foreground mb-2">
            Current odds: <span className={accentColor}>{data.probability}%</span>
          </div>
          <div className="pt-2 border-t border-border">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onShowTrades?.();
                setShowTooltip(false);
              }}
              className="w-full text-xs px-2 py-1 border border-border hover:bg-muted transition-colors"
            >
              Show Trades
            </button>
          </div>
        </motion.div>
      )}
    </>
  );
};
