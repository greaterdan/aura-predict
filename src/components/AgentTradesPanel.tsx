import { motion } from "framer-motion";
import { X, TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Trade {
  id: string;
  timestamp: Date;
  market: string;
  marketSlug?: string;
  conditionId?: string;
  decision: "YES" | "NO";
  confidence: number;
  reasoning: string;
  pnl?: number;
  investmentUsd?: number; // Amount invested in this trade
  status: "OPEN" | "CLOSED" | "PENDING";
  predictionId?: string; // Link to actual prediction ID for accurate matching
}

interface AgentTradesPanelProps {
  agentId: string;
  agentName: string;
  agentEmoji: string;
  trades: Trade[];
  onClose: () => void;
  onTradeClick?: (market: string, predictionId?: string) => void;
}

const getAgentLogo = (agentId: string): string => {
  if (agentId === 'grok') return "/grok.png";
  if (agentId === 'gpt5') return "/GPT.png";
  if (agentId === 'gemini') return "/GEMENI.png";
  if (agentId === 'deepseek') return "/deepseek.png";
  if (agentId === 'claude') return "/Claude_AI_symbol.svg";
  if (agentId === 'qwen') return "/Qwen_logo.svg";
  return "/placeholder.svg";
};

const formatTimeAgo = (date: Date) => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const AgentTradesPanel = ({ agentId, agentName, agentEmoji, trades, onClose, onTradeClick }: AgentTradesPanelProps) => {
  const sortedTrades = [...trades].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  const openTrades = sortedTrades.filter(t => t.status === "OPEN");
  const closedTrades = sortedTrades.filter(t => t.status === "CLOSED");
  const totalPnl = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="h-12 px-4 border-b border-border flex items-center justify-between bg-bg-elevated flex-shrink-0">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <img
            src={getAgentLogo(agentId)}
            alt={agentName}
            className="w-6 h-6 object-contain flex-shrink-0 rounded-full"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder.svg";
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-mono text-terminal-accent leading-none" style={{ fontWeight: 600 }}>
              {agentName} TRADES
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
              {trades.length} total • {openTrades.length} open
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-7 w-7 p-0 hover:bg-muted rounded-full flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="px-4 py-2.5 border-b border-border bg-bg-elevated flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground font-mono uppercase">Total PnL</span>
            <span className={`text-[14px] font-mono ${totalPnl >= 0 ? 'text-trade-yes' : 'text-trade-no'}`} style={{ fontWeight: 600 }}>
              {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} SOL
            </span>
          </div>
          <div className="w-px h-6 bg-border" />
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground font-mono uppercase">Win Rate</span>
            <span className="text-[14px] font-mono text-terminal-accent" style={{ fontWeight: 600 }}>
              {closedTrades.length > 0 
                ? `${Math.round((closedTrades.filter(t => (t.pnl || 0) > 0).length / closedTrades.length) * 100)}%`
                : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Trades List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <div className="p-3 space-y-2.5">
          {/* Open Trades */}
          {openTrades.length > 0 && (
            <>
              <div className="text-[11px] text-muted-foreground font-mono uppercase mb-2 px-1" style={{ fontWeight: 600 }}>
                Open Positions ({openTrades.length})
              </div>
              {openTrades.map((trade, index) => (
                <motion.div
                  key={trade.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-bg-elevated border border-terminal-accent/30 rounded-xl p-3 hover:border-terminal-accent/50 transition-colors cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onTradeClick?.(trade.market, trade.predictionId);
                  }}
                  style={{ pointerEvents: 'auto' }}
                >
                  <div className="flex items-start justify-between mb-2" style={{ pointerEvents: 'none' }}>
                    <div className="flex-1 min-w-0" style={{ pointerEvents: 'none' }}>
                      <div className="text-[13px] font-mono text-foreground mb-1" style={{ fontWeight: 600, pointerEvents: 'none' }}>
                        {trade.market}
                      </div>
                      <div className="flex items-center gap-2 mb-2" style={{ pointerEvents: 'none' }}>
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold ${
                          trade.decision === "YES"
                            ? "bg-trade-yes/20 text-trade-yes border border-trade-yes/30"
                            : "bg-trade-no/20 text-trade-no border border-trade-no/30"
                        }`} style={{ pointerEvents: 'none' }}>
                          {trade.decision === "YES" ? (
                            <TrendingUp className="w-2.5 h-2.5" />
                          ) : (
                            <TrendingDown className="w-2.5 h-2.5" />
                          )}
                          {trade.decision}
                        </div>
                        <div className="px-2 py-0.5 rounded-lg text-[11px] font-mono bg-terminal-accent/20 text-terminal-accent border border-terminal-accent/30" style={{ pointerEvents: 'none' }}>
                          {trade.confidence}% CONF
                        </div>
                        {trade.investmentUsd !== undefined && trade.investmentUsd > 0 && (
                          <div className="px-2 py-0.5 rounded-lg text-[11px] font-mono bg-muted text-foreground border border-border" style={{ pointerEvents: 'none' }}>
                            ${trade.investmentUsd.toFixed(0)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono flex-shrink-0 ml-2" style={{ pointerEvents: 'none' }}>
                      {formatTimeAgo(trade.timestamp)}
                    </div>
                  </div>
                  <div className="text-[12px] text-text-secondary leading-relaxed mb-2" style={{ fontWeight: 400, pointerEvents: 'none' }}>
                    {trade.reasoning}
                  </div>
                  <div className="flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
                    {(trade.marketSlug || trade.conditionId) && (
                      <a
                        href={
                          trade.marketSlug
                            ? `https://polymarket.com/event/${trade.marketSlug}`
                            : `https://polymarket.com/condition/${trade.conditionId}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-terminal-accent/10 text-terminal-accent rounded hover:bg-terminal-accent/20 transition-colors text-[11px] font-mono"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View Market
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </>
          )}

          {/* Closed Trades */}
          {closedTrades.length > 0 && (
            <>
              <div className="text-[11px] text-muted-foreground font-mono uppercase mb-2 px-1 mt-4" style={{ fontWeight: 600 }}>
                Closed Positions ({closedTrades.length})
              </div>
              {closedTrades.map((trade, index) => (
                <motion.div
                  key={trade.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (openTrades.length + index) * 0.05 }}
                  className="bg-bg-elevated border border-border rounded-xl p-3 hover:border-terminal-accent/50 transition-colors cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Use predictionId if available, otherwise try to find by market name
                    if (trade.predictionId) {
                      onTradeClick?.(trade.market, trade.predictionId);
                    } else {
                      console.warn('No predictionId for trade:', trade.id, trade.market);
                      // Still try to call with market name - parent can try to find it
                      onTradeClick?.(trade.market, undefined);
                    }
                  }}
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                >
                  <div className="flex items-start justify-between mb-2" style={{ pointerEvents: 'none' }}>
                    <div className="flex-1 min-w-0" style={{ pointerEvents: 'none' }}>
                      <div className="text-[13px] font-mono text-foreground mb-1" style={{ fontWeight: 600, pointerEvents: 'none' }}>
                        {trade.market}
                      </div>
                      <div className="flex items-center gap-2 mb-2" style={{ pointerEvents: 'none' }}>
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold ${
                          trade.decision === "YES"
                            ? "bg-trade-yes/20 text-trade-yes border border-trade-yes/30"
                            : "bg-trade-no/20 text-trade-no border border-trade-no/30"
                        }`} style={{ pointerEvents: 'none' }}>
                          {trade.decision === "YES" ? (
                            <TrendingUp className="w-2.5 h-2.5" />
                          ) : (
                            <TrendingDown className="w-2.5 h-2.5" />
                          )}
                          {trade.decision}
                        </div>
                        {trade.pnl !== undefined && (
                          <div className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold ${
                            trade.pnl >= 0
                              ? "bg-trade-yes/20 text-trade-yes border border-trade-yes/30"
                              : "bg-trade-no/20 text-trade-no border border-trade-no/30"
                          }`} style={{ pointerEvents: 'none' }}>
                            {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(4)} SOL
                          </div>
                        )}
                        {trade.investmentUsd !== undefined && trade.investmentUsd > 0 && (
                          <div className="px-2 py-0.5 rounded-lg text-[11px] font-mono bg-muted text-foreground border border-border" style={{ pointerEvents: 'none' }}>
                            ${trade.investmentUsd.toFixed(0)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono flex-shrink-0 ml-2" style={{ pointerEvents: 'none' }}>
                      {formatTimeAgo(trade.timestamp)}
                    </div>
                  </div>
                  <div className="text-[12px] text-text-secondary leading-relaxed mb-2" style={{ fontWeight: 400, pointerEvents: 'none' }}>
                    {trade.reasoning}
                  </div>
                  <div className="flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
                    {(trade.marketSlug || trade.conditionId) && (
                      <a
                        href={
                          trade.marketSlug
                            ? `https://polymarket.com/event/${trade.marketSlug}`
                            : `https://polymarket.com/condition/${trade.conditionId}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-terminal-accent/10 text-terminal-accent rounded hover:bg-terminal-accent/20 transition-colors text-[11px] font-mono"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View Market
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </>
          )}

          {trades.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-[13px] font-mono mb-1">No trades yet</div>
              <div className="text-[11px] font-mono">This agent hasn't made any trades</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

