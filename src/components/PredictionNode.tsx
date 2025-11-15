import { useState, useMemo, useRef, memo } from "react";

const getAgentLogo = (agentName: string): string => {
  const agentUpper = agentName.toUpperCase();
  if (agentUpper.includes("GROK")) return "/grok.png";
  if (agentUpper.includes("GEMINI")) return "/GEMENI.png";
  if (agentUpper.includes("DEEPSEEK")) return "/Deepseek-logo-icon.svg";
  if (agentUpper.includes("CLAUDE")) return "/Claude_AI_symbol.svg";
  if (agentUpper.includes("GPT") || agentUpper.includes("OPENAI")) return "/GPT.png";
  if (agentUpper.includes("QWEN")) return "/Qwen_logo.svg";
  return "/placeholder.svg";
};

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
  size?: number; // Optional size prop for dynamic sizing
  animationIndex?: number; // For animation delay variation
  isHighlighted?: boolean;
  onClick?: () => void;
  onShowTrades?: () => void;
  onDragStart?: (id: string, e: React.MouseEvent) => void;
  onDrag?: (id: string, e: React.MouseEvent) => void;
  onDragEnd?: (id: string) => void;
  isDragging?: boolean;
}

export const PredictionNode = memo(({ data, position, size, animationIndex = 0, isHighlighted, onClick, onShowTrades, onDragStart, onDrag, onDragEnd, isDragging: externalIsDragging }: PredictionNodeProps) => {
  // Use provided size, or fallback to fixed size (prevents glitch on refresh)
  // Size is always provided from layout, so this fallback should rarely be used
  const bubbleSize = size || 120; // Fixed fallback size
  
  // Scale text sizes proportionally to bubble size
  const textScale = bubbleSize / 96; // Base size is 96px
  const probabilitySize = Math.max(10, Math.min(20, 14 * textScale));
  const tagSize = Math.max(5, Math.min(8, 6 * textScale));
  const questionSize = Math.max(5, Math.min(7, 6 * textScale));
  const agentSize = Math.max(4, Math.min(6, 5 * textScale));
  const priceSize = Math.max(4, Math.min(6, 5 * textScale));
  const logoSize = Math.max(12, Math.min(20, 16 * textScale));
  const bubbleRef = useRef<HTMLDivElement>(null);
  
  const isDragging = externalIsDragging || false;
  
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
      <div
        ref={bubbleRef}
        className="relative select-none w-full h-full"
        style={{ 
          pointerEvents: 'auto',
          cursor: 'pointer',
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
      >
        {/* The actual circular bubble - Clean Banter style */}
        <div 
          className={`relative banter-bubble-inner flex items-center justify-center rounded-full overflow-hidden cursor-pointer`}
          style={{
            width: `${bubbleSize}px`,
            height: `${bubbleSize}px`,
            backgroundColor: 'rgba(15, 15, 20, 0.85)',
            pointerEvents: 'auto',
          }}
        >
          {/* Subtle border - clean and minimal */}
          <div
            className={`pointer-events-none absolute inset-[2px] rounded-full border ${
              data.position === "YES"
                ? 'border-emerald-500/40'
                : 'border-rose-500/40'
            }`}
          />
          
          {/* Content - Properly sized to fit inside larger bubbles */}
          <div className="relative z-10 flex flex-col items-center justify-center gap-0.5 text-center px-2" style={{ width: '90%', height: '90%' }}>
            {/* Agent Logo - Smaller icon */}
            <img 
              src={getAgentLogo(data.agentName)} 
              alt={data.agentName}
              className="object-contain"
              style={{ 
                width: `${Math.max(10, Math.min(14, bubbleSize * 0.12))}px`, 
                height: `${Math.max(10, Math.min(14, bubbleSize * 0.12))}px`,
                marginBottom: '2px',
                opacity: 0.9,
              }}
            />
            
            {/* Ticker/Question - Smaller text */}
            <div 
              className="font-semibold uppercase text-white leading-tight"
              style={{
                fontSize: `${Math.max(8, Math.min(12, bubbleSize * 0.11))}px`,
                fontWeight: 600,
                lineHeight: '1.2',
                letterSpacing: '0.03em',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {data.question.length > 18 ? data.question.substring(0, 17) + '…' : data.question.toUpperCase()}
            </div>
            
            {/* Percentage - Smaller but still prominent */}
            <div 
              className="font-bold leading-none"
              style={{
                fontSize: `${Math.max(14, Math.min(22, bubbleSize * 0.2))}px`,
                color: data.position === "YES" 
                  ? 'hsl(var(--trade-yes))' 
                  : 'hsl(var(--trade-no))',
                fontWeight: 700,
                lineHeight: '1',
                letterSpacing: '0.01em',
              }}
            >
              {data.probability}%
            </div>
            
            {/* Position + Price - Smaller badge */}
            <div className="flex items-center gap-1 mt-0.5">
              <div 
                className="font-semibold uppercase px-1 py-0.5 rounded"
                style={{
                  fontSize: `${Math.max(7, Math.min(10, bubbleSize * 0.09))}px`,
                  color: data.position === "YES" 
                    ? 'hsl(var(--trade-yes))' 
                    : 'hsl(var(--trade-no))',
                  backgroundColor: data.position === "YES" 
                    ? 'hsl(var(--trade-yes) / 0.15)' 
                    : 'hsl(var(--trade-no) / 0.15)',
                  border: `1px solid ${data.position === "YES" ? 'hsl(var(--trade-yes) / 0.5)' : 'hsl(var(--trade-no) / 0.5)'}`,
                  fontWeight: 600,
                  lineHeight: '1',
                  letterSpacing: '0.06em',
                }}
              >
                {data.position}
              </div>
              <div 
                className="text-white/80 font-mono"
                style={{
                  fontSize: `${Math.max(7, Math.min(9, bubbleSize * 0.08))}px`,
                  fontWeight: 500,
                  lineHeight: '1',
                }}
              >
                ${data.price.toFixed(2)}
              </div>
            </div>
            
            {/* Change - Smaller indicator */}
            <div 
              className={`font-semibold ${data.change >= 0 ? 'text-trade-yes' : 'text-trade-no'}`}
              style={{
                fontSize: `${Math.max(7, Math.min(10, bubbleSize * 0.09))}px`,
                fontWeight: 600,
                lineHeight: '1',
              }}
            >
              {data.change >= 0 ? '+' : ''}{data.change.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Static highlight ring - NO ANIMATION - stronger glow on hover/select */}
        {isHighlighted && (
          <div
            className="absolute inset-0 pointer-events-none rounded-full"
            style={{
              border: `3px solid ${data.position === "YES" ? 'hsl(var(--trade-yes))' : 'hsl(var(--trade-no))'}`,
              boxShadow: data.position === "YES"
                ? '0 0 30px hsl(var(--trade-yes) / 1), 0 0 60px hsl(var(--trade-yes) / 0.8), 0 0 90px hsl(var(--trade-yes) / 0.5)'
                : '0 0 30px hsl(var(--trade-no) / 1), 0 0 60px hsl(var(--trade-no) / 0.8), 0 0 90px hsl(var(--trade-no) / 0.5)'
            }}
          />
        )}
      </div>

    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo - only re-render if relevant props change
  return (
    prevProps.data.id === nextProps.data.id &&
    prevProps.position.x === nextProps.position.x &&
    prevProps.position.y === nextProps.position.y &&
    prevProps.size === nextProps.size &&
    prevProps.isHighlighted === nextProps.isHighlighted &&
    prevProps.isDragging === nextProps.isDragging
  );
});
