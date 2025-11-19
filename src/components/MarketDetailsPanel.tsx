import { X, ExternalLink, TrendingUp, TrendingDown, DollarSign, BarChart3, Clock, Tag, Info, Star } from "lucide-react";
import { PredictionNodeData } from "./PredictionNode";
import { isInWatchlist, addToWatchlist, removeFromWatchlist } from "@/lib/watchlist";
import { useState, useEffect } from "react";

interface Outcome {
  tokenId: string;
  name: string;
  price: number;
  buyPrice?: number;
  sellPrice?: number;
  probability: number;
}

interface MarketDetailsPanelProps {
  market: PredictionNodeData & {
    // Additional fields from Polymarket API
    volume?: number | string;
    volume24h?: number;
    volume7d?: number;
    liquidity?: number | string;
    yesPrice?: number;
    noPrice?: number;
    outcomes?: Outcome[]; // All outcomes with prices
    endDate?: string;
    startDate?: string;
    createdAt?: string;
    tags?: string[];
    subcategory?: string;
    active?: boolean;
    closed?: boolean;
    archived?: boolean;
    new?: boolean;
    featured?: boolean;
  };
  onClose: () => void;
  onWatchlistChange?: () => void;
  watchlist?: PredictionNodeData[]; // Pass watchlist to check if market is in it
  userEmail?: string; // User email for watchlist operations
}

export const MarketDetailsPanel = ({ market, onClose, onWatchlistChange, watchlist, userEmail }: MarketDetailsPanelProps) => {
  const [isWatched, setIsWatched] = useState(false);

  useEffect(() => {
    if (market) {
      // Check if market is in watchlist (use prop if provided, otherwise check localStorage)
      if (watchlist) {
        setIsWatched(watchlist.some(m => m.id === market.id));
      } else {
        setIsWatched(isInWatchlist(market.id, userEmail));
      }
    }
  }, [market, watchlist, userEmail]);

  const handleToggleWatchlist = () => {
    if (!market || !userEmail) return; // Only allow if logged in
    
    if (isWatched) {
      removeFromWatchlist(market.id, userEmail);
      setIsWatched(false);
    } else {
      addToWatchlist(market, userEmail);
      setIsWatched(true);
    }
    
    // Notify parent to refresh watchlist
    onWatchlistChange?.();
  };

  if (!market) return null;

  const formatCurrency = (value?: number) => {
    if (!value) return "N/A";
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const getTimeRemaining = (endDate?: string) => {
    if (!endDate) return "N/A";
    try {
      const end = new Date(endDate);
      const now = new Date();
      const diff = end.getTime() - now.getTime();
      
      if (diff < 0) return "Ended";
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (days > 0) return `${days}d ${hours}h`;
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m`;
    } catch {
      return "N/A";
    }
  };

  const isYes = market.position === "YES";
  const yesPrice = market.yesPrice ?? (isYes ? market.price : 1 - market.price);
  const noPrice = market.noPrice ?? (isYes ? 1 - market.price : market.price);

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-secondary/50 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {market.imageUrl && (
            <img
              src={market.imageUrl}
              alt={market.question}
              className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-foreground truncate">{market.question}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              {market.category && (
                <span className="text-[10px] px-1.5 py-0.5 bg-terminal-accent/20 text-terminal-accent rounded font-mono">
                  {market.category}
                </span>
              )}
              {market.subcategory && (
                <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded font-mono">
                  {market.subcategory}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleToggleWatchlist}
            className={`w-7 h-7 flex items-center justify-center border border-border hover:bg-muted rounded transition-colors flex-shrink-0 ${
              isWatched ? 'bg-terminal-accent/20 border-terminal-accent text-terminal-accent' : ''
            }`}
            title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
          >
            <Star className={`w-3.5 h-3.5 ${isWatched ? 'fill-terminal-accent' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center border border-border hover:bg-muted rounded transition-colors flex-shrink-0"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {/* Position & Probability */}
        <div className="grid grid-cols-2 gap-2">
          <div className={`p-3 rounded-lg border-2 ${
            isYes 
              ? 'bg-trade-yes/10 border-trade-yes/40' 
              : 'bg-trade-no/10 border-trade-no/40'
          }`}>
            <div className="text-[10px] text-muted-foreground font-mono mb-1">POSITION</div>
            <div className={`text-lg font-bold ${
              isYes ? 'text-trade-yes' : 'text-trade-no'
            }`}>
              {market.position}
            </div>
            <div className="text-xs text-foreground mt-0.5">
              Probability: <span className="font-bold">{market.probability}%</span>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-border bg-secondary/30">
            <div className="text-[10px] text-muted-foreground font-mono mb-1">PRICE</div>
            <div className="text-lg font-bold text-foreground">
              ${market.price.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {market.change !== undefined && (
                <span className={`flex items-center gap-1 ${
                  market.change >= 0 ? 'text-trade-yes' : 'text-trade-no'
                }`}>
                  {market.change >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {market.change >= 0 ? '+' : ''}{market.change.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Outcomes Section */}
        <div className="p-2.5 rounded-lg border border-border bg-secondary/30">
          <div className="text-[10px] text-muted-foreground font-mono mb-2">OUTCOMES & PRICES</div>
          
          {market.outcomes && market.outcomes.length > 0 ? (
            <div className="space-y-1.5">
              {market.outcomes.map((outcome, idx) => {
                const isSelected = market.position === outcome.name.toUpperCase() || 
                                 (market.position === 'YES' && outcome.name.toUpperCase() === 'YES') ||
                                 (market.position === 'NO' && outcome.name.toUpperCase() === 'NO');
                const isYesOutcome = outcome.name.toUpperCase() === 'YES';
                const isNoOutcome = outcome.name.toUpperCase() === 'NO';
                
                // Determine color classes
                const bgClass = isYesOutcome 
                  ? (isSelected ? 'bg-trade-yes/20' : 'bg-trade-yes/5')
                  : isNoOutcome
                  ? (isSelected ? 'bg-trade-no/20' : 'bg-trade-no/5')
                  : (isSelected ? 'bg-terminal-accent/20' : 'bg-terminal-accent/5');
                
                const borderClass = isYesOutcome
                  ? (isSelected ? 'border-trade-yes/50' : 'border-trade-yes/20')
                  : isNoOutcome
                  ? (isSelected ? 'border-trade-no/50' : 'border-trade-no/20')
                  : (isSelected ? 'border-terminal-accent/50' : 'border-terminal-accent/20');
                
                const textClass = isYesOutcome 
                  ? 'text-trade-yes' 
                  : isNoOutcome 
                  ? 'text-trade-no' 
                  : 'text-terminal-accent';
                
                const dotClass = isYesOutcome
                  ? (isSelected ? 'bg-trade-yes' : 'bg-trade-yes/50')
                  : isNoOutcome
                  ? (isSelected ? 'bg-trade-no' : 'bg-trade-no/50')
                  : (isSelected ? 'bg-terminal-accent' : 'bg-terminal-accent/50');
                
                const barBgClass = isYesOutcome
                  ? 'bg-trade-yes/10'
                  : isNoOutcome
                  ? 'bg-trade-no/10'
                  : 'bg-terminal-accent/10';
                
                const barFillClass = isYesOutcome
                  ? 'bg-trade-yes'
                  : isNoOutcome
                  ? 'bg-trade-no'
                  : 'bg-terminal-accent';
                
                return (
                  <div 
                    key={outcome.tokenId || idx}
                    className={`p-2 rounded-lg border-2 ${bgClass} ${borderClass}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
                        <span className={`text-[10px] font-bold ${textClass} uppercase tracking-wider truncate`}>
                          {outcome.name}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <div className={`text-sm font-bold ${textClass}`}>
                          ${outcome.price.toFixed(3)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-muted-foreground">Probability</span>
                      <span className={`text-[10px] font-bold ${textClass}`}>
                        {outcome.probability.toFixed(1)}%
                      </span>
                    </div>
                    {outcome.buyPrice !== undefined && outcome.sellPrice !== undefined && (
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                        <span>Buy: ${outcome.buyPrice.toFixed(3)}</span>
                        <span>Sell: ${outcome.sellPrice.toFixed(3)}</span>
                      </div>
                    )}
                    {/* Progress bar */}
                    <div className={`mt-1 h-1 ${barBgClass} rounded-full overflow-hidden`}>
                      <div 
                        className={`h-full ${barFillClass} rounded-full transition-all duration-300`}
                        style={{ width: `${outcome.probability}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              
              {/* Summary */}
              <div className="mt-1.5 pt-1.5 border-t border-border">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground font-mono">Total Probability</span>
                  <span className="font-bold text-foreground">
                    {market.outcomes.reduce((sum, o) => sum + o.probability, 0).toFixed(1)}%
                  </span>
                </div>
                {Math.abs(market.outcomes.reduce((sum, o) => sum + o.probability, 0) - 100) > 1 && (
                  <div className="mt-0.5 text-[10px] text-muted-foreground italic">
                    Note: Prices may not sum to 100% due to market spread
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Fallback to YES/NO display if no outcomes array
            <div className="space-y-1.5">
              {/* YES Outcome */}
              <div className={`p-2 rounded-lg border-2 ${
                isYes 
                  ? 'bg-trade-yes/20 border-trade-yes/50' 
                  : 'bg-trade-yes/5 border-trade-yes/20'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      isYes ? 'bg-trade-yes' : 'bg-trade-yes/50'
                    }`} />
                    <span className="text-[10px] font-bold text-trade-yes uppercase tracking-wider">
                      YES
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-trade-yes">
                      ${yesPrice.toFixed(3)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Probability</span>
                  <span className="text-[10px] font-bold text-trade-yes">
                    {(yesPrice * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1 h-1 bg-trade-yes/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-trade-yes rounded-full transition-all duration-300"
                    style={{ width: `${yesPrice * 100}%` }}
                  />
                </div>
              </div>

              {/* NO Outcome */}
              <div className={`p-2 rounded-lg border-2 ${
                !isYes 
                  ? 'bg-trade-no/20 border-trade-no/50' 
                  : 'bg-trade-no/5 border-trade-no/20'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      !isYes ? 'bg-trade-no' : 'bg-trade-no/50'
                    }`} />
                    <span className="text-[10px] font-bold text-trade-no uppercase tracking-wider">
                      NO
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-trade-no">
                      ${noPrice.toFixed(3)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Probability</span>
                  <span className="text-[10px] font-bold text-trade-no">
                    {(noPrice * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1 h-1 bg-trade-no/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-trade-no rounded-full transition-all duration-300"
                    style={{ width: `${noPrice * 100}%` }}
                  />
                </div>
              </div>
              
              <div className="mt-1.5 pt-1.5 border-t border-border">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground font-mono">Total Probability</span>
                  <span className="font-bold text-foreground">
                    {((yesPrice + noPrice) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Trading Metrics */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-lg border border-border bg-secondary/30">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono mb-1.5">
              <DollarSign className="w-2.5 h-2.5" />
              VOL 24H
            </div>
            <div className="text-base font-bold text-foreground">
              {formatCurrency(market.volume24h || market.volume)}
            </div>
          </div>

          <div className="p-2.5 rounded-lg border border-border bg-secondary/30">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono mb-1.5">
              <BarChart3 className="w-2.5 h-2.5" />
              LIQUIDITY
            </div>
            <div className="text-base font-bold text-foreground">
              {formatCurrency(market.liquidity)}
            </div>
          </div>

          <div className="p-2.5 rounded-lg border border-border bg-secondary/30">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono mb-1.5">
              <DollarSign className="w-2.5 h-2.5" />
              TOTAL VOL
            </div>
            <div className="text-base font-bold text-foreground">
              {formatCurrency(market.volume)}
            </div>
          </div>
        </div>

        {/* Volume Breakdown */}
        {(market.volume24h || market.volume7d) && (
          <div className="p-2.5 rounded-lg border border-border bg-secondary/30">
            <div className="text-[10px] text-muted-foreground font-mono mb-2">VOLUME BREAKDOWN</div>
            <div className="space-y-1.5">
              {market.volume24h && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">24 Hours</span>
                  <span className="text-xs font-bold text-foreground">{formatCurrency(market.volume24h)}</span>
                </div>
              )}
              {market.volume7d && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">7 Days</span>
                  <span className="text-xs font-bold text-foreground">{formatCurrency(market.volume7d)}</span>
                </div>
              )}
              {market.volume && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">All Time</span>
                  <span className="text-xs font-bold text-foreground">{formatCurrency(market.volume)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Market Info */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg border border-border bg-secondary/30">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono mb-1.5">
              <Clock className="w-2.5 h-2.5" />
              END DATE
            </div>
            <div className="text-xs font-bold text-foreground">{formatDate(market.endDate)}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {getTimeRemaining(market.endDate)} remaining
            </div>
          </div>

          <div className="p-2.5 rounded-lg border border-border bg-secondary/30">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono mb-1.5">
              <Clock className="w-2.5 h-2.5" />
              CREATED
            </div>
            <div className="text-xs font-bold text-foreground">{formatDate(market.createdAt)}</div>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap gap-1.5">
          {market.active && (
            <span className="px-1.5 py-0.5 text-[10px] bg-trade-yes/20 text-trade-yes rounded font-mono border border-trade-yes/40">
              ACTIVE
            </span>
          )}
          {market.closed && (
            <span className="px-1.5 py-0.5 text-[10px] bg-trade-no/20 text-trade-no rounded font-mono border border-trade-no/40">
              CLOSED
            </span>
          )}
          {market.archived && (
            <span className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded font-mono border border-border">
              ARCHIVED
            </span>
          )}
          {market.new && (
            <span className="px-1.5 py-0.5 text-[10px] bg-terminal-accent/20 text-terminal-accent rounded font-mono border border-terminal-accent/40">
              NEW
            </span>
          )}
          {market.featured && (
            <span className="px-1.5 py-0.5 text-[10px] bg-terminal-accent/20 text-terminal-accent rounded font-mono border border-terminal-accent/40">
              FEATURED
            </span>
          )}
        </div>

        {/* Tags */}
        {market.tags && market.tags.length > 0 && (
          <div className="p-2.5 rounded-lg border border-border bg-secondary/30">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono mb-1.5">
              <Tag className="w-2.5 h-2.5" />
              TAGS
            </div>
            <div className="flex flex-wrap gap-1.5">
              {market.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded font-mono border border-border"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {market.reasoning && (
          <div className="p-2.5 rounded-lg border border-border bg-secondary/30">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono mb-1.5">
              <Info className="w-2.5 h-2.5" />
              DESCRIPTION
            </div>
            <p className="text-xs text-foreground leading-relaxed">{market.reasoning}</p>
          </div>
        )}

        {/* Agent Info */}
        <div className="p-2.5 rounded-lg border border-border bg-secondary/30">
          <div className="text-[10px] text-muted-foreground font-mono mb-1.5">AGENT</div>
          <div className="flex items-center gap-2">
            <img
              src={((): string => {
                const agentUpper = market.agentName.toUpperCase();
                if (agentUpper.includes("GROK")) return "/grok.png";
                if (agentUpper.includes("GEMINI")) return "/GEMENI.png";
                if (agentUpper.includes("DEEPSEEK")) return "/deepseek.png";
                if (agentUpper.includes("CLAUDE")) return "/Claude_AI_symbol.svg";
                if (agentUpper.includes("GPT") || agentUpper.includes("OPENAI")) return "/GPT.png";
                if (agentUpper.includes("QWEN")) return "/Qwen_logo.svg";
                return "/placeholder.svg";
              })()}
              alt={market.agentName}
              className="w-5 h-5 object-contain rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder.svg";
              }}
            />
            <span className="text-xs font-bold text-foreground">{market.agentName}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-2.5 border-t border-border bg-secondary/50 flex items-center justify-between flex-shrink-0">
        <div className="text-[10px] text-muted-foreground font-mono truncate flex-1 min-w-0">
          ID: {market.id}
        </div>
        <a
          href={
            market.marketSlug
              ? `https://polymarket.com/event/${market.marketSlug}`
              : market.conditionId
              ? `https://polymarket.com/condition/${market.conditionId}`
              : `https://polymarket.com/search?q=${encodeURIComponent(market.question)}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-terminal-accent text-black rounded hover:bg-terminal-accent/90 transition-colors text-xs font-semibold flex-shrink-0"
        >
          <ExternalLink className="w-3 h-3" />
          View on Polymarket
        </a>
      </div>
    </div>
  );
};

