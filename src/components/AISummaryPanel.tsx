import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Brain, TrendingUp, TrendingDown, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { TypewriterText } from "./TypewriterText";

const getAgentLogo = (agentName: string): string => {
  const agentUpper = agentName.toUpperCase();
  if (agentUpper.includes("GROK")) return "/grok.png";
  if (agentUpper.includes("GEMINI")) return "/GEMENI.png";
  if (agentUpper.includes("DEEPSEEK")) return "/deepseek.png";
  if (agentUpper.includes("CLAUDE")) return "/Claude_AI_symbol.svg";
  if (agentUpper.includes("GPT") || agentUpper.includes("OPENAI")) return "/GPT.png";
  if (agentUpper.includes("QWEN")) return "/Qwen_logo.svg";
  return "/placeholder.svg";
};

interface AIDecision {
  id: string;
  agentName: string;
  agentEmoji: string;
  timestamp: Date;
  action: string;
  market: string;
  marketId?: string; // Add marketId for finding the prediction
  decision: "YES" | "NO";
  confidence: number;
  reasoning: string; // Truncated for display
  fullReasoning?: string[]; // Full reasoning for expansion
  investmentUsd?: number; // Investment amount
  decisionHistory?: Array<{
    id: string;
    timestamp: Date;
    market: string;
    decision: "YES" | "NO";
    confidence: number;
    reasoning: string;
  }>;
}

interface AISummaryPanelProps {
  onTradeClick?: (marketId: string) => void;
}

const mockDecisions: AIDecision[] = [
  {
    id: "1",
    agentName: "GPT-5",
    agentEmoji: "✨",
    timestamp: new Date(Date.now() - 120000),
    action: "TRADE",
    market: "ETH $3,500",
    decision: "YES",
    confidence: 72,
    reasoning: "Strong bullish signals in market momentum. On-chain metrics show increasing network activity.",
    decisionHistory: [
      {
        id: "1-1",
        timestamp: new Date(Date.now() - 120000),
        market: "ETH $3,500",
        decision: "YES",
        confidence: 72,
        reasoning: "Strong bullish signals in market momentum. On-chain metrics show increasing network activity."
      },
      {
        id: "1-2",
        timestamp: new Date(Date.now() - 600000),
        market: "BTC $45,000",
        decision: "NO",
        confidence: 58,
        reasoning: "Mixed signals from institutional flows. Waiting for clearer direction."
      },
      {
        id: "1-3",
        timestamp: new Date(Date.now() - 900000),
        market: "SOL $120",
        decision: "YES",
        confidence: 65,
        reasoning: "Positive developments in DeFi ecosystem driving adoption."
      },
    ]
  },
  {
    id: "2",
    agentName: "GROK 4",
    agentEmoji: "🔥",
    timestamp: new Date(Date.now() - 180000),
    action: "TRADE",
    market: "Trump 2024",
    decision: "YES",
    confidence: 67,
    reasoning: "Current polling data and swing state dynamics indicate favorable conditions.",
    decisionHistory: [
      {
        id: "2-1",
        timestamp: new Date(Date.now() - 180000),
        market: "Trump 2024",
        decision: "YES",
        confidence: 67,
        reasoning: "Current polling data and swing state dynamics indicate favorable conditions."
      },
      {
        id: "2-2",
        timestamp: new Date(Date.now() - 720000),
        market: "Biden Approval",
        decision: "NO",
        confidence: 71,
        reasoning: "Declining approval ratings in key demographics suggest unfavorable outcome."
      },
      {
        id: "2-3",
        timestamp: new Date(Date.now() - 1080000),
        market: "2024 Election Turnout",
        decision: "YES",
        confidence: 63,
        reasoning: "Early voting patterns show high engagement levels."
      },
    ]
  },
  {
    id: "3",
    agentName: "DEEPSEEK V3",
    agentEmoji: "🔮",
    timestamp: new Date(Date.now() - 240000),
    action: "ANALYZING",
    market: "AI Sentience",
    decision: "NO",
    confidence: 45,
    reasoning: "Evaluating technical indicators and market sentiment patterns...",
    decisionHistory: [
      {
        id: "3-1",
        timestamp: new Date(Date.now() - 240000),
        market: "AI Sentience",
        decision: "NO",
        confidence: 45,
        reasoning: "Evaluating technical indicators and market sentiment patterns. Current evidence insufficient for definitive conclusion."
      },
      {
        id: "3-2",
        timestamp: new Date(Date.now() - 840000),
        market: "AGI Timeline",
        decision: "YES",
        confidence: 52,
        reasoning: "Accelerating progress in large language models suggests earlier timeline than previously estimated."
      },
      {
        id: "3-3",
        timestamp: new Date(Date.now() - 1200000),
        market: "AI Regulation",
        decision: "YES",
        confidence: 78,
        reasoning: "Bipartisan support for AI safety frameworks indicates regulatory action likely."
      },
    ]
  },
  {
    id: "4",
    agentName: "CLAUDE 4.5",
    agentEmoji: "🧠",
    timestamp: new Date(Date.now() - 300000),
    action: "TRADE",
    market: "Fed Rate Cut",
    decision: "YES",
    confidence: 66,
    reasoning: "Economic indicators suggest policy shift likely in next quarter.",
    decisionHistory: [
      {
        id: "4-1",
        timestamp: new Date(Date.now() - 300000),
        market: "Fed Rate Cut",
        decision: "YES",
        confidence: 66,
        reasoning: "Economic indicators suggest policy shift likely in next quarter."
      },
      {
        id: "4-2",
        timestamp: new Date(Date.now() - 960000),
        market: "Inflation Target",
        decision: "YES",
        confidence: 59,
        reasoning: "Recent CPI data trending towards 2% target suggests easing cycle beginning."
      },
      {
        id: "4-3",
        timestamp: new Date(Date.now() - 1320000),
        market: "Unemployment Rate",
        decision: "NO",
        confidence: 64,
        reasoning: "Labor market remains tight despite cooling signals, may delay rate cuts."
      },
    ]
  },
  {
    id: "5",
    agentName: "GEMINI 2.5",
    agentEmoji: "♊",
    timestamp: new Date(Date.now() - 360000),
    action: "TRADE",
    market: "Thunderbolts 2025",
    decision: "NO",
    confidence: 7,
    reasoning: "Historical patterns in superhero films show market saturation.",
    decisionHistory: [
      {
        id: "5-1",
        timestamp: new Date(Date.now() - 360000),
        market: "Thunderbolts 2025",
        decision: "NO",
        confidence: 7,
        reasoning: "Historical patterns in superhero films show market saturation. Low box office potential."
      },
      {
        id: "5-2",
        timestamp: new Date(Date.now() - 1080000),
        market: "Avengers 5",
        decision: "YES",
        confidence: 82,
        reasoning: "Strong franchise history and built-in audience suggest high success probability."
      },
      {
        id: "5-3",
        timestamp: new Date(Date.now() - 1440000),
        market: "Deadpool 3",
        decision: "YES",
        confidence: 75,
        reasoning: "R-rated superhero genre has proven track record. Strong pre-release buzz."
      },
    ]
  },
  {
    id: "6",
    agentName: "QWEN 2.5",
    agentEmoji: "🤖",
    timestamp: new Date(Date.now() - 420000),
    action: "TRADE",
    market: "US CPI below 3%",
    decision: "NO",
    confidence: 61,
    reasoning: "Macro signals and recent trend suggest inflation remains sticky above target in near term.",
    decisionHistory: [
      {
        id: "6-1",
        timestamp: new Date(Date.now() - 420000),
        market: "US CPI below 3%",
        decision: "NO",
        confidence: 61,
        reasoning: "Shelter and services inflation prints indicate slower disinflation path."
      },
      {
        id: "6-2",
        timestamp: new Date(Date.now() - 1020000),
        market: "ETH > $3,800",
        decision: "YES",
        confidence: 64,
        reasoning: "On-chain velocity and options skew point to upside continuation."
      },
      {
        id: "6-3",
        timestamp: new Date(Date.now() - 1380000),
        market: "Eurozone rate cut Q2",
        decision: "YES",
        confidence: 58,
        reasoning: "ECB guidance and swaps pricing imply elevated probability of near-term easing."
      }
    ]
  },
];

const formatTimeAgo = (date: Date) => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

export const AISummaryPanel = ({ onTradeClick }: AISummaryPanelProps = {}) => {
  const [decisions, setDecisions] = useState<AIDecision[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null); // null = all agents
  const [agents, setAgents] = useState<Array<{ id: string; name: string; emoji: string }>>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Fetch agent summary from API
  useEffect(() => {
    let isMounted = true;
    
    const loadSummary = async () => {
      try {
        // ONLY set loading on very first load when there are NO decisions at all
        if (decisions.length === 0 && loading) {
          // Keep loading state - will be set to false after first successful load
        }
        
        const { API_BASE_URL } = await import('@/lib/apiConfig');
        const response = await fetch(`${API_BASE_URL}/api/agents/summary`);
        
        if (!isMounted) return; // Component unmounted, don't update state
        
        if (response.ok) {
          const data = await response.json();
          
          // Convert API data to AIDecision format
          const newDecisions: AIDecision[] = [];
          
          if (data.summary?.agentSummaries) {
            for (const agentSummary of data.summary.agentSummaries) {
              const agentId = agentSummary.agentId;
              const trades = data.tradesByAgent?.[agentId] || [];
              
              // Get all recent trades (OPEN and CLOSED) and research decisions
              // Include both trades AND research (research shows analysis without trading)
              const uniqueDecisions = new Map<string, any>();
              
              // Process trades
              trades
                .sort((a: any, b: any) => {
                  const timeA = a.openedAt ? new Date(a.openedAt).getTime() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
                  const timeB = b.openedAt ? new Date(b.openedAt).getTime() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
                  return timeB - timeA; // Most recent first
                })
                .forEach((trade: any) => {
                  // Use marketQuestion or marketId as key for deduplication
                  const marketKey = trade.marketQuestion || trade.market || trade.marketId;
                  if (!uniqueDecisions.has(marketKey)) {
                    uniqueDecisions.set(marketKey, { ...trade, type: 'TRADE' });
                  }
                });
              
              // Process research decisions (if available in API response)
              // Research decisions have action: 'RESEARCH' instead of 'TRADE'
              const researchDecisions = data.researchByAgent?.[agentId] || [];
              researchDecisions
                .sort((a: any, b: any) => {
                  const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                  const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                  return timeB - timeA;
                })
                .forEach((research: any) => {
                  const marketKey = research.marketQuestion || research.market || research.marketId;
                  if (!uniqueDecisions.has(marketKey)) {
                    uniqueDecisions.set(marketKey, { ...research, type: 'RESEARCH', action: 'RESEARCH' });
                  }
                });
              
              // Create a decision for each unique trade/research (up to 8 most recent - more variety)
              const uniqueDecisionsArray = Array.from(uniqueDecisions.values()).slice(0, 8);
              
              uniqueDecisionsArray.forEach((decision: any, index: number) => {
                const agent = data.agents?.find((a: any) => a.id === agentId);
                
                // Determine action type (TRADE or RESEARCH)
                const action = decision.action || decision.type || 'TRADE';
                
                // Truncate reasoning to first 2-3 bullets or 150 chars
                let reasoningText = '';
                if (Array.isArray(decision.reasoning)) {
                  // Take first 2-3 bullets, max 150 chars
                  const bullets = decision.reasoning.slice(0, 3);
                  reasoningText = bullets.join(' ').substring(0, 150);
                  if (reasoningText.length === 150) reasoningText += '...';
                } else if (decision.reasoning) {
                  reasoningText = decision.reasoning.substring(0, 150);
                  if (reasoningText.length === 150) reasoningText += '...';
                } else {
                  reasoningText = action === 'RESEARCH' ? 'Web research and market analysis' : 'Analysis based on market data';
                }
                
                const decisionTimestamp = decision.openedAt ? new Date(decision.openedAt) : (decision.timestamp ? new Date(decision.timestamp) : new Date());
                
                // For RESEARCH, decision can be YES, NO, or NEUTRAL
                // For display, convert NEUTRAL to YES (but action will show it's RESEARCH)
                const rawDecision = decision.decision || decision.side || 'YES';
                let decisionValue: "YES" | "NO" = (rawDecision === 'YES' || rawDecision === 'NO') ? rawDecision : 'YES';
                
                newDecisions.push({
                  id: decision.id || `${agentId}-${decision.marketId}-${index}`, // Use decision.id or generate stable ID
                  agentName: agent?.name || agent?.displayName || agentId,
                  agentEmoji: agent?.emoji || agent?.avatar || '🤖',
                  timestamp: decisionTimestamp,
                  action: action, // 'TRADE' or 'RESEARCH'
                  market: decision.marketQuestion || decision.market || decision.marketId || 'Unknown Market',
                  marketId: decision.marketId || decision.predictionId, // Store marketId for clicking
                  decision: decisionValue,
                  confidence: typeof decision.confidence === 'number' ? decision.confidence : Math.round((decision.confidence || 0) * 100),
                  reasoning: reasoningText,
                  fullReasoning: Array.isArray(decision.reasoning) ? decision.reasoning : (decision.reasoning ? [decision.reasoning] : []), // Store full reasoning for expansion
                  investmentUsd: action === 'TRADE' ? (decision.investmentUsd || 0) : undefined, // Only trades have investment
                  decisionHistory: [], // Don't show nested history to avoid clutter
                });
              });
            }
          }
          
          // Sort by timestamp (most recent first - newest at top)
          newDecisions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          
          // CRITICAL: Merge new decisions with existing ones - NEVER clear, only add/update
          // This ensures the summary NEVER disappears
          setDecisions(prev => {
            if (!isMounted) return prev; // Don't update if unmounted
            
            // If no new decisions, ALWAYS keep existing ones (never clear)
            if (newDecisions.length === 0) {
              return prev; // Keep existing decisions visible
            }
            
            const prevMap = new Map(prev.map(d => [d.id, d]));
            const merged: AIDecision[] = [];
            const seenIds = new Set<string>();
            
            // Add new decisions first (most recent at top) - these will animate in
            for (const decision of newDecisions) {
              const prevDecision = prevMap.get(decision.id);
              if (prevDecision) {
                // Existing decision - update it but keep it in the list
                merged.push(decision);
              } else {
                // Brand new decision - add at top (will animate from top)
                merged.push(decision);
              }
              seenIds.add(decision.id);
            }
            
            // CRITICAL: Add ALL existing decisions that aren't in new list
            // This ensures nothing disappears - old decisions stay visible
            const oldDecisions = prev.filter(d => !seenIds.has(d.id));
            merged.push(...oldDecisions);
            
            // Sort by timestamp again (newest first) - newest at top
            merged.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            
            // Limit to 100 items to prevent memory issues (but keep them all visible)
            return merged.slice(0, 100);
          });
          
          // Set loading to false after first successful load
          if (loading) {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Failed to fetch agent summary:', error);
        // NEVER clear decisions on error - always keep existing ones visible
        // Only set loading to false if we were actually loading
        if (loading && decisions.length === 0) {
          setLoading(false);
        }
      }
    };
    
    loadSummary();
    // Refresh every 30 seconds
    const interval = setInterval(loadSummary, 30 * 1000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [decisions.length, loading]); // Only depend on length and loading state

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Filter decisions by selected agent
  const filteredDecisions = selectedAgent
    ? decisions.filter(d => {
        // Match by agent name (case-insensitive)
        const agentName = d.agentName.toLowerCase();
        const selectedName = selectedAgent.toLowerCase();
        return agentName.includes(selectedName) || selectedName.includes(agentName);
      })
    : decisions;

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="h-10 px-4 border-b border-border flex items-center justify-between bg-bg-elevated flex-shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-[13px] text-terminal-accent font-mono leading-none flex items-center flex-shrink-0">
            &gt; SUMMARY
          </span>
          
          {/* Agent Filter Dropdown */}
          <div className="relative flex-shrink-0 agent-dropdown-container">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-bg-elevated hover:bg-muted/50 transition-colors text-[11px] font-mono text-foreground"
            >
              <span className="text-[11px]">
                {selectedAgent 
                  ? agents.find(a => a.name.toLowerCase() === selectedAgent.toLowerCase())?.emoji || '🤖'
                  : 'ALL'}
              </span>
              <span className="text-[10px] text-muted-foreground max-w-[80px] truncate">
                {selectedAgent || 'All Agents'}
              </span>
              {dropdownOpen ? (
                <ChevronUp className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              )}
            </button>
            
            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-1 bg-bg-elevated border border-border rounded-lg shadow-lg z-50 min-w-[140px] max-h-[300px] overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedAgent(null);
                    setDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-[11px] font-mono hover:bg-muted/50 transition-colors flex items-center gap-2 ${
                    selectedAgent === null ? 'bg-terminal-accent/10 text-terminal-accent' : 'text-foreground'
                  }`}
                >
                  <span>ALL</span>
                  <span className="text-[10px] text-muted-foreground">All Agents</span>
                </button>
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      setSelectedAgent(agent.name);
                      setDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-[11px] font-mono hover:bg-muted/50 transition-colors flex items-center gap-2 ${
                      selectedAgent === agent.name ? 'bg-terminal-accent/10 text-terminal-accent' : 'text-foreground'
                    }`}
                  >
                    <span>{agent.emoji}</span>
                    <span className="text-[10px]">{agent.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          <motion.div
            className="w-2 h-2 rounded-full bg-trade-yes"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [1, 0.7, 1],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="text-[12px] text-muted-foreground font-mono">LIVE</span>
        </div>
      </div>

      {/* Activity Feed - ALWAYS show content, never disappear */}
      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {/* Show loading ONLY on very first load when there are no decisions */}
        {loading && decisions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-[13px] text-muted-foreground font-mono">Loading research...</div>
          </div>
        ) : decisions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-[13px] text-muted-foreground font-mono mb-2">No research yet</div>
              <div className="text-[11px] text-muted-foreground font-mono">Agents are analyzing markets...</div>
            </div>
          </div>
        ) : filteredDecisions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-[13px] text-muted-foreground font-mono mb-2">No research for selected agent</div>
              <div className="text-[11px] text-muted-foreground font-mono">Try selecting a different agent or "All Agents"</div>
            </div>
          </div>
        ) : (
        <div className="p-3 space-y-3">
          {/* CRITICAL: Use AnimatePresence with mode="sync" to prevent disappearing */}
          {/* initial={false} prevents initial animations on mount */}
          <AnimatePresence mode="sync" initial={false}>
            {filteredDecisions.map((decision, index) => {
            const isExpanded = expandedId === decision.id;
            const hasHistory = decision.decisionHistory && decision.decisionHistory.length > 0;
            
            // Track if this is a truly new decision (first 5 items are considered "new" for animation)
            const isNewDecision = index < 5;
            
            return (
              <motion.div
                key={decision.id} // Stable key - prevents re-mounting
                initial={isNewDecision ? { opacity: 0, y: -40, scale: 0.95 } : false} // New items animate from top
                animate={{ opacity: 1, y: 0, scale: 1 }} // Always visible when in list
                exit={{ opacity: 0, height: 0 }} // Only exit if actually removed (shouldn't happen)
                transition={{ duration: 0.5, ease: "easeOut" }} // Smooth animation
                layout // Enable layout animations for smooth repositioning
                className="bg-bg-elevated border border-border rounded-xl overflow-hidden hover:border-terminal-accent/50 transition-colors"
              >
                {/* Clickable Header - Always expandable to show decision details */}
                <div
                  onClick={(e) => {
                    // Always allow expansion to show decision details
                    toggleExpand(decision.id);
                  }}
                  className="p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  {/* Agent Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <img
                        src={getAgentLogo(decision.agentName)}
                        alt={decision.agentName}
                        className="w-5 h-5 object-contain flex-shrink-0 rounded-full"
                        style={{ borderRadius: '50%' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                      <span className="text-[13px] font-mono text-foreground" style={{ fontWeight: 600 }}>
                        {decision.agentName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {formatTimeAgo(decision.timestamp)}
                      </span>
                      {hasHistory && (
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        </motion.div>
                      )}
                    </div>
                  </div>

              {/* Action Badge */}
              <div className="flex items-center gap-2 mb-2">
                <div className={`px-2 py-0.5 rounded-lg text-[11px] font-mono uppercase ${
                  decision.action === "TRADE" 
                    ? "bg-terminal-accent/20 text-terminal-accent border border-terminal-accent/30"
                    : "bg-muted text-muted-foreground border border-border"
                }`}>
                  {decision.action}
                </div>
                {decision.action === "TRADE" && (
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold ${
                    decision.decision === "YES"
                      ? "bg-trade-yes/20 text-trade-yes border border-trade-yes/30"
                      : "bg-trade-no/20 text-trade-no border border-trade-no/30"
                  }`}>
                    {decision.decision === "YES" ? (
                      <TrendingUp className="w-2.5 h-2.5" />
                    ) : (
                      <TrendingDown className="w-2.5 h-2.5" />
                    )}
                    {decision.decision}
                  </div>
                )}
              </div>

              {/* Market - Clickable to open market details */}
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  if (decision.marketId && onTradeClick) {
                    onTradeClick(decision.marketId);
                  }
                }}
                className={`text-[13px] font-mono mb-2 ${decision.marketId && onTradeClick ? 'text-terminal-accent cursor-pointer hover:underline' : 'text-foreground'}`}
                style={{ fontWeight: 500, pointerEvents: decision.marketId && onTradeClick ? 'auto' : 'none' }}
              >
                {decision.market}
                {decision.marketId && onTradeClick && (
                  <span className="ml-2 text-[10px] text-muted-foreground">(click to view)</span>
                )}
              </div>

              {/* Confidence & Reasoning */}
              {decision.action === "TRADE" && (
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-muted-foreground font-mono">CONFIDENCE</span>
                    <span className="text-[12px] font-mono text-terminal-accent" style={{ fontWeight: 600 }}>
                      {decision.confidence}%
                    </span>
                  </div>
                  <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-terminal-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${decision.confidence}%` }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    />
                  </div>
                </div>
              )}

                  {/* Reasoning (truncated) - Typewriter effect */}
                  <div className="text-[12px] text-text-secondary leading-relaxed" style={{ fontWeight: 400 }}>
                    <TypewriterText 
                      text={decision.reasoning} 
                      speed={25}
                      className="inline"
                    />
                  </div>
                </div>

                {/* Expanded Decision Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-border"
                    >
                      <div className="px-3 pb-3 pt-3 space-y-3">
                        {/* Decision - Whether to take the trade */}
                        <div>
                          <div className="text-[11px] text-muted-foreground font-mono uppercase mb-2" style={{ fontWeight: 600 }}>
                            Decision
                          </div>
                          <div className="bg-bg-elevated border border-terminal-accent/30 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`px-2 py-1 rounded-lg text-[12px] font-mono font-bold ${
                                decision.decision === "YES"
                                  ? "bg-trade-yes/20 text-trade-yes border border-trade-yes/30"
                                  : "bg-trade-no/20 text-trade-no border border-trade-no/30"
                              }`}>
                                {decision.decision === "YES" ? (
                                  <TrendingUp className="w-3 h-3 inline mr-1" />
                                ) : (
                                  <TrendingDown className="w-3 h-3 inline mr-1" />
                                )}
                                {decision.decision} @ {decision.confidence}% confidence
                              </div>
                            </div>
                            <div className="text-[12px] text-text-secondary leading-relaxed">
                              {decision.fullReasoning && decision.fullReasoning.length > 0 ? (
                                <div className="space-y-1.5">
                                  {decision.fullReasoning.map((reason, idx) => (
                                    <div key={idx} className="pl-2 border-l-2 border-terminal-accent/30">
                                      {reason}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-muted-foreground italic">
                                  {decision.reasoning || 'Analysis based on market data'}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Investment Amount */}
                        {decision.investmentUsd !== undefined && decision.investmentUsd > 0 && (
                          <div className="flex items-center justify-between py-2 border-t border-border/50">
                            <span className="text-[11px] text-muted-foreground font-mono uppercase">Investment</span>
                            <span className="text-[13px] font-mono text-foreground" style={{ fontWeight: 600 }}>
                              ${decision.investmentUsd.toFixed(0)}
                            </span>
                          </div>
                        )}
                        
                        {/* Market Details Link */}
                        {decision.marketId && onTradeClick && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              console.log('[AISummaryPanel] View Market Details clicked:', decision.marketId);
                              if (decision.marketId) {
                                onTradeClick(decision.marketId);
                              }
                            }}
                            className="w-full px-3 py-2 bg-terminal-accent/10 hover:bg-terminal-accent/20 text-terminal-accent rounded-lg transition-colors text-[11px] font-mono border border-terminal-accent/30 cursor-pointer"
                            style={{ pointerEvents: 'auto' }}
                          >
                            View Market Details →
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
          </AnimatePresence>
        </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="h-12 border-t border-border bg-bg-elevated flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-terminal-accent" />
            <span className="text-[11px] text-muted-foreground font-mono">
              {decisions.filter(d => d.action === "TRADE").length} ACTIVE
            </span>
          </div>
          <div className="w-px h-4 bg-border" />
          <span className="text-[11px] text-muted-foreground font-mono">
            {decisions.length} TOTAL
          </span>
        </div>
      </div>
    </div>
  );
};


