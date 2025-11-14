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
        className="absolute cursor-move select-none"
        style={{ left: position.x, top: position.y }}
        drag
        dragMomentum={false}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* The actual circular bubble */}
        <motion.div 
          className={`relative w-56 h-56 rounded-full bg-bg-elevated border ${borderColor} p-4 flex flex-col items-center justify-center text-center shadow-xl`}
          style={{
            borderWidth: '1px',
            boxShadow: data.position === "YES" 
              ? '0 0 0 1px hsl(var(--trade-yes) / 0.7), inset 0 0 60px hsl(var(--trade-yes) / 0.08)'
              : data.position === "NO"
              ? '0 0 0 1px hsl(var(--trade-no) / 0.7), inset 0 0 60px hsl(var(--trade-no) / 0.08)'
              : '0 0 0 1px hsl(var(--border))'
          }}
          animate={{
            boxShadow: data.position === "YES"
              ? [
                  '0 0 0 1px hsl(var(--trade-yes) / 0.7), inset 0 0 60px hsl(var(--trade-yes) / 0.08), 0 0 20px hsl(var(--trade-yes) / 0.3)',
                  '0 0 0 1px hsl(var(--trade-yes) / 0.9), inset 0 0 80px hsl(var(--trade-yes) / 0.12), 0 0 40px hsl(var(--trade-yes) / 0.5)',
                  '0 0 0 1px hsl(var(--trade-yes) / 0.7), inset 0 0 60px hsl(var(--trade-yes) / 0.08), 0 0 20px hsl(var(--trade-yes) / 0.3)'
                ]
              : data.position === "NO"
              ? [
                  '0 0 0 1px hsl(var(--trade-no) / 0.7), inset 0 0 60px hsl(var(--trade-no) / 0.08), 0 0 20px hsl(var(--trade-no) / 0.3)',
                  '0 0 0 1px hsl(var(--trade-no) / 0.9), inset 0 0 80px hsl(var(--trade-no) / 0.12), 0 0 40px hsl(var(--trade-no) / 0.5)',
                  '0 0 0 1px hsl(var(--trade-no) / 0.7), inset 0 0 60px hsl(var(--trade-no) / 0.08), 0 0 20px hsl(var(--trade-no) / 0.3)'
                ]
              : ['0 0 0 1px hsl(var(--border))', '0 0 0 1px hsl(var(--border))', '0 0 0 1px hsl(var(--border))']
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {/* Probability */}
          <div className={`text-5xl font-bold ${accentColor} mb-2`} style={{ fontWeight: 700 }}>
            {data.probability}%
          </div>
          
          {/* Position Tag */}
          <div 
            className={`text-[11px] px-3 py-1 ${accentColor} font-mono rounded-full mb-3 uppercase tracking-wider`}
            style={{
              backgroundColor: 'transparent',
              border: `1px solid ${data.position === "YES" ? 'hsl(var(--trade-yes))' : 'hsl(var(--trade-no))'}`,
              fontWeight: 600
            }}
          >
            {data.position}
          </div>

          {/* Market Title */}
          <div className="text-[13px] text-text-secondary mb-3 leading-[1.4] px-2" style={{ fontWeight: 400 }}>
            {data.question.length > 60 ? data.question.substring(0, 60) + '...' : data.question}
          </div>

          {/* Agent */}
          <div className="flex items-center gap-1.5 text-xs text-text-muted mb-2">
            <span className="text-trade-neutral">{data.agentEmoji}</span>
            <span className="font-mono">{data.agentName}</span>
          </div>

          {/* Price & Change */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-foreground font-mono font-medium">${data.price.toFixed(2)}</span>
            <span className={data.change >= 0 ? 'text-trade-yes' : 'text-trade-no'} style={{ fontWeight: 500 }}>
              {data.change >= 0 ? '+' : ''}{data.change.toFixed(1)}%
            </span>
          </div>
        </motion.div>

        {/* Pulse animation on highlight */}
        {isHighlighted && (
          <motion.div
            className={`absolute inset-0 border-2 ${borderColor} pointer-events-none rounded-full`}
            animate={{
              opacity: [0.8, 0, 0.8],
              scale: [1, 1.2, 1],
            }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </motion.div>

      {/* Hover Tooltip */}
      {showTooltip && (
        <motion.div
          className="absolute z-50 w-80 bg-bg-card border border-border p-4 pointer-events-auto rounded"
          style={{ 
            left: 280, 
            top: 0,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)'
          }}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.15 }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <div className="text-xs text-terminal-accent font-mono mb-3">
            &gt; AI_REASONING
          </div>
          <div className="text-[13px] text-text-secondary leading-[1.5] mb-4" style={{ fontWeight: 400 }}>
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
              className="w-full text-xs px-3 py-2 border border-border bg-muted hover:bg-secondary transition-colors cursor-pointer text-foreground"
              style={{ fontWeight: 500 }}
            >
              Show Trades
            </button>
          </div>
        </motion.div>
      )}
    </>
  );
};
