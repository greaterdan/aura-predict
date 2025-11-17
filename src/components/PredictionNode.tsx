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
  category?: string; // Store the actual category from Polymarket
  marketSlug?: string; // Store the Polymarket market slug for linking
  conditionId?: string; // Store the Polymarket condition_id for linking
  imageUrl?: string; // Store the market image URL from Polymarket
  volume?: number | string; // Market volume
  liquidity?: number | string; // Market liquidity
  volume24h?: number; // 24h volume
  volume7d?: number; // 7d volume
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

// Custom comparison function for memo to prevent unnecessary re-renders
const areEqual = (prevProps: PredictionNodeProps, nextProps: PredictionNodeProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.data.id === nextProps.data.id &&
    prevProps.data.price === nextProps.data.price &&
    prevProps.data.probability === nextProps.data.probability &&
    prevProps.data.position === nextProps.data.position &&
    prevProps.size === nextProps.size &&
    prevProps.isHighlighted === nextProps.isHighlighted &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.animationIndex === nextProps.animationIndex
  );
};

export const PredictionNode = memo(({ data, position, size, animationIndex = 0, isHighlighted, onClick, onShowTrades, onDragStart, onDrag, onDragEnd, isDragging: externalIsDragging }: PredictionNodeProps) => {
  const [isPressed, setIsPressed] = useState(false);
  
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
          outline: 'none',
          border: 'none',
          boxShadow: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          overflow: 'visible', // CRITICAL: Allow glow to extend outside
          '--tw-ring-width': '0',
          '--tw-ring-offset-width': '0',
          '--tw-ring-color': 'transparent',
        } as React.CSSProperties}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // Trigger pulse effect
          setIsPressed(true);
          setTimeout(() => setIsPressed(false), 300);
          onClick?.();
        }}
        onMouseDown={(e) => {
          e.preventDefault(); // Prevent text selection
          setIsPressed(true);
        }}
        onMouseUp={() => {
          setIsPressed(false);
        }}
        tabIndex={-1} // Prevent keyboard focus
      >
        {/* OUTER GLOW LAYER - Subtle outer glow - +20% more */}
        <div
          className="pointer-events-none absolute rounded-full"
          style={{ 
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: `${bubbleSize + 10}px`,
            height: `${bubbleSize + 10}px`,
            zIndex: 0,
            boxShadow: data.position === "YES"
              ? '0 0 7px rgba(48, 230, 140, 0.35), 0 0 14px rgba(48, 230, 140, 0.25)'
              : '0 0 7px rgba(255, 79, 100, 0.35), 0 0 14px rgba(255, 79, 100, 0.25)'
          }}
        />
        
        {/* The actual circular bubble - Size based on price, color based on position */}
        <div 
          className={`relative banter-bubble-inner flex items-center justify-center rounded-full overflow-hidden cursor-pointer`}
          style={{
            width: `${bubbleSize}px`,
            height: `${bubbleSize}px`,
            borderRadius: '50%', // Ensure perfectly round
            position: 'relative',
            zIndex: 1,
            backgroundColor: data.imageUrl 
              ? 'transparent' 
              : data.position === "NO"
                ? 'rgba(220, 38, 38, 0.85)' // Red for NO
                : 'rgba(15, 15, 20, 0.85)', // Dark for YES
            backgroundImage: data.imageUrl ? `url(${data.imageUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            // Better image quality - let browser use default high-quality rendering
            // Force high quality rendering and hardware acceleration
            willChange: 'transform',
            transform: 'translateZ(0) scale(1)',
            WebkitTransform: 'translateZ(0) scale(1)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            pointerEvents: 'auto',
            // Subtle colored glow - green for YES, red for NO - +20% more
            boxShadow: data.position === "YES"
              ? '0 0 5px rgba(48, 230, 140, 0.35), 0 0 10px rgba(48, 230, 140, 0.25)'
              : '0 0 5px rgba(255, 79, 100, 0.35), 0 0 10px rgba(255, 79, 100, 0.25)',
            // AGGRESSIVE: Prevent any focus rectangles, borders, rings
            outline: 'none',
            border: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            // Prevent any ring styles from Tailwind
            '--tw-ring-width': '0',
            '--tw-ring-offset-width': '0',
            '--tw-ring-color': 'transparent',
          } as React.CSSProperties}
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent any default behavior
          }}
          tabIndex={-1} // Prevent keyboard focus
        >
          {/* Lighter overlay to ensure text is readable but images are clearer - reduced opacity for clearer images */}
          {data.imageUrl && (
            <div
              className={`absolute inset-0 rounded-full ${
                data.position === "NO" ? 'bg-red-900/20' : 'bg-black/20'
              }`}
              style={{ zIndex: 1 }}
            />
          )}
          
          {/* Border - Red for NO, Green for YES - VERY VISIBLE */}
          <div
            className={`pointer-events-none absolute inset-0 rounded-full border-2 ${
              data.position === "YES"
                ? 'border-emerald-300'
                : 'border-red-300'
            }`}
            style={{ 
              zIndex: 3,
              boxShadow: data.position === "YES"
                ? '0 0 5px rgba(48, 230, 140, 0.5), 0 0 10px rgba(48, 230, 140, 0.35)'
                : '0 0 5px rgba(255, 79, 100, 0.5), 0 0 10px rgba(255, 79, 100, 0.35)'
            }}
          />
          
          {/* Content - Minimal: Only YES/NO and price */}
          <div className="relative z-10 flex flex-col items-center justify-center gap-1 text-center px-1" style={{ width: '90%', height: '90%', zIndex: 2 }}>
            {/* Position (YES/NO) - Larger - Show based on which side has higher price */}
            <div 
              className="font-bold uppercase"
              style={{
                fontSize: `${Math.max(14, Math.min(20, bubbleSize * 0.2))}px`,
                color: data.position === "YES" 
                  ? 'hsl(var(--trade-yes))' 
                  : 'hsl(var(--trade-no))',
                fontWeight: 800,
                lineHeight: '1',
                letterSpacing: '0.05em',
              }}
            >
              {data.position}
            </div>
            
            {/* Price in dollars - Show the price of the selected position */}
            <div 
              className="font-bold text-white"
              style={{
                fontSize: `${Math.max(18, Math.min(26, bubbleSize * 0.24))}px`,
                fontWeight: 700,
                lineHeight: '1',
              }}
            >
              ${data.price.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Enhanced glow/pulse effect when clicked or highlighted - MAXIMUM INTENSITY */}
        {(isHighlighted || isPressed) && (
          <div
            className="absolute inset-0 pointer-events-none rounded-full"
            style={{
              border: `3px solid ${data.position === "YES" ? 'hsl(var(--trade-yes))' : 'hsl(var(--trade-no))'}`,
              boxShadow: data.position === "YES"
                ? `0 0 ${isPressed ? '7px' : '5px'} hsl(var(--trade-yes) / ${isPressed ? '0.5' : '0.35'}), 0 0 ${isPressed ? '12px' : '10px'} hsl(var(--trade-yes) / ${isPressed ? '0.35' : '0.25'})`
                : `0 0 ${isPressed ? '7px' : '5px'} hsl(var(--trade-no) / ${isPressed ? '0.5' : '0.35'}), 0 0 ${isPressed ? '12px' : '10px'} hsl(var(--trade-no) / ${isPressed ? '0.35' : '0.25'})`,
              transition: 'box-shadow 0.2s ease, border 0.2s ease',
              animation: isPressed ? 'pulse-glow 0.3s ease-out' : 'none',
            }}
          />
        )}
      </div>

    </>
  );
}, areEqual);
