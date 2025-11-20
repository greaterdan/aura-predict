import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { Brain, TrendingUp, TrendingDown, Activity, ChevronDown, ChevronUp, Globe } from "lucide-react";
import { TypewriterText } from "./TypewriterText";

const SUMMARY_CACHE_KEY = 'agent-summary-cache-v2';
const MAX_DECISIONS = 50;

const cardVariants = {
  hidden: { opacity: 0, y: -12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: "easeOut" },
  },
};

const DEFAULT_AGENT_OPTIONS = [
  { id: "grok", name: "GROK 4", emoji: "🔥" },
  { id: "gpt5", name: "GPT-5", emoji: "✨" },
  { id: "deepseek", name: "DEEPSEEK V3", emoji: "🔮" },
  { id: "gemini", name: "GEMINI 2.5", emoji: "♊" },
  { id: "claude", name: "CLAUDE 4.5", emoji: "🧠" },
  { id: "qwen", name: "QWEN 2.5", emoji: "🤖" },
];

const BACKEND_TO_FRONTEND_AGENT_ID: Record<string, string> = {
  "GROK_4": "grok",
  "GPT_5": "gpt5",
  "DEEPSEEK_V3": "deepseek",
  "GEMINI_2_5": "gemini",
  "CLAUDE_4_5": "claude",
  "QWEN_2_5": "qwen",
};

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

const hydrateCachedDecisions = (cached: any[]): AIDecision[] => {
  if (!Array.isArray(cached)) return [];
  return cached
    .map(item => ({
      ...item,
      timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
    }))
    .filter(item => item.id && item.agentName);
};

const serializeDecisionsForCache = (decisions: AIDecision[]) =>
  decisions.map(decision => ({
    ...decision,
    timestamp: decision.timestamp.toISOString(),
  }));

interface AIDecision {
  id: string;
  agentId?: string;
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
  webResearchSummary?: Array<{
    title: string;
    snippet: string;
    url: string;
    source: string;
  }>;
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
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string | null>(null); // null = all agents
  const [agents, setAgents] = useState<Array<{ id: string; name: string; emoji: string }>>(DEFAULT_AGENT_OPTIONS);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const hasLoadedRef = useRef(false);
  const decisionsRef = useRef<AIDecision[]>([]);
  const newDecisionIdsRef = useRef<Set<string>>(new Set());
  const newDecisionOrderRef = useRef<Map<string, number>>(new Map());

  // Restore cached decisions instantly when component mounts
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const cached = window.sessionStorage.getItem(SUMMARY_CACHE_KEY);
      if (cached) {
        const hydrated = hydrateCachedDecisions(JSON.parse(cached)).slice(0, MAX_DECISIONS);
        if (hydrated.length > 0) {
          decisionsRef.current = hydrated;
          setDecisions(hydrated);
          if (!hasLoadedRef.current) {
            hasLoadedRef.current = true;
            setLoading(false);
          }
        }
      }
    } catch (error) {
      console.warn('[AISummaryPanel] Failed to restore cached summary', error);
    }
  }, []);

  // Persist decisions to cache and keep ref in sync
  useEffect(() => {
    decisionsRef.current = decisions;
    if (typeof window === 'undefined') return;
    if (decisions.length === 0) {
      window.sessionStorage.removeItem(SUMMARY_CACHE_KEY);
      return;
    }
    try {
      const serialized = serializeDecisionsForCache(decisions.slice(0, MAX_DECISIONS));
      window.sessionStorage.setItem(SUMMARY_CACHE_KEY, JSON.stringify(serialized));
    } catch (error) {
      console.warn('[AISummaryPanel] Failed to cache summary', error);
    }
  }, [decisions]);

  // Automatically clear the "new" highlight once items have animated in
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (newDecisionIdsRef.current.size === 0) return;
    const timeout = window.setTimeout(() => {
      newDecisionIdsRef.current.clear();
      newDecisionOrderRef.current.clear();
    }, 2000);
    return () => window.clearTimeout(timeout);
  }, [decisions]);


  // Fetch agent summary from API
  useEffect(() => {
    let isMounted = true;
    
    const loadSummary = async () => {
      try {
        const { API_BASE_URL } = await import('@/lib/apiConfig');
        const response = await fetch(`${API_BASE_URL}/api/agents/summary`);
        
        if (!isMounted) return; // Component unmounted, don't update state
        
        if (response.ok) {
          const data = await response.json();
          
          // Convert API data to AIDecision format
          const newDecisions: AIDecision[] = [];
          
  if (Array.isArray(data.agents)) {
    setAgents(prevAgents => {
      const merged = new Map<string, { id: string; name: string; emoji: string }>();
      DEFAULT_AGENT_OPTIONS.forEach(agent => merged.set(agent.id, agent));
      data.agents.forEach((agent: any) => {
        if (!agent?.id) return;
        const normalizedId = String(agent.id).toLowerCase();
        merged.set(normalizedId, {
          id: normalizedId,
          name: agent.name || agent.displayName || normalizedId.toUpperCase(),
          emoji: agent.emoji || agent.avatar || merged.get(normalizedId)?.emoji || '🤖',
        });
      });
      return Array.from(merged.values());
    });
  }
          
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
                const frontendAgentId = BACKEND_TO_FRONTEND_AGENT_ID[agentId] || agentId.toLowerCase();
                const agentMeta =
                  data.agents?.find((a: any) => a?.id && String(a.id).toLowerCase() === frontendAgentId) ||
                  DEFAULT_AGENT_OPTIONS.find(agent => agent.id === frontendAgentId);
                
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
                  agentId: frontendAgentId,
                  agentName: agentMeta?.name || agentSummary.agentName || agentId,
                  agentEmoji: agentMeta?.emoji || '🤖',
                  timestamp: decisionTimestamp,
                  action: action, // 'TRADE' or 'RESEARCH'
                  market: decision.marketQuestion || decision.market || decision.marketId || 'Unknown Market',
                  marketId: decision.marketId || decision.predictionId, // Store marketId for clicking
                  decision: decisionValue,
                  confidence: typeof decision.confidence === 'number' ? decision.confidence : Math.round((decision.confidence || 0) * 100),
                  reasoning: reasoningText,
                  fullReasoning: Array.isArray(decision.reasoning) ? decision.reasoning : (decision.reasoning ? [decision.reasoning] : []), // Store full reasoning for expansion
                  investmentUsd: action === 'TRADE' ? (decision.investmentUsd || 0) : undefined, // Only trades have investment
                  webResearchSummary: Array.isArray(decision.webResearchSummary) ? decision.webResearchSummary : [],
                  decisionHistory: [], // Don't show nested history to avoid clutter
                });
              });
            }
          }
          
          // Sort by timestamp (most recent first - newest at top)
          newDecisions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

          // Track which decisions are genuinely new so they can animate one-by-one
          const previousMap = new Map(decisionsRef.current.map(decision => [decision.id, decision]));
          const freshIds = new Set<string>();
          const freshOrder = new Map<string, number>();
          newDecisions.forEach(decision => {
            const existing = previousMap.get(decision.id);
            if (!existing || existing.timestamp.getTime() !== decision.timestamp.getTime() || existing.reasoning !== decision.reasoning) {
              freshOrder.set(decision.id, freshOrder.size);
              freshIds.add(decision.id);
            }
          });
          newDecisionIdsRef.current = freshIds;
          newDecisionOrderRef.current = freshOrder;
          
          // CRITICAL: Merge new decisions with existing ones - NEVER clear, only add/update
          // This ensures the summary NEVER disappears
          setDecisions(prev => {
            if (!isMounted) return prev; // Don't update if unmounted
            
            // If no new decisions, ALWAYS keep existing ones (never clear)
            if (newDecisions.length === 0) {
              return prev; // Keep existing decisions visible
            }
            
            const merged = [...newDecisions];
            const seenIds = new Set(newDecisions.map(d => d.id));
            const remaining = prev.filter(d => !seenIds.has(d.id));
            merged.push(...remaining);
            merged.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            return merged.slice(0, MAX_DECISIONS);
          });
          
          if (!hasLoadedRef.current) {
            hasLoadedRef.current = true;
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Failed to fetch agent summary:', error);
        // NEVER clear decisions on error - always keep existing ones visible
        // Only set loading to false if we were actually loading
        if (!hasLoadedRef.current) {
          hasLoadedRef.current = true;
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
  }, []); // Run once on mount

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);
  
  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const filteredDecisions = selectedAgentFilter
    ? decisions.filter(d => {
        const selectedId = selectedAgentFilter.toLowerCase();
        if (d.agentId) {
          return d.agentId.toLowerCase() === selectedId;
        }
        const agentName = (d.agentName || '').toLowerCase();
        return agentName.includes(selectedId);
      })
    : decisions;
  const selectedAgentMeta = selectedAgentFilter
    ? agents.find(agent => agent.id === selectedAgentFilter)
    : null;

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
              {selectedAgentMeta ? (
                <img
                  src={getAgentLogo(selectedAgentMeta.name)}
                  alt={selectedAgentMeta.name}
                  className="w-4 h-4 rounded-full object-contain"
                />
              ) : (
                <span className="text-[11px]">ALL</span>
              )}
              <span className="text-[10px] text-muted-foreground max-w-[80px] truncate">
                {selectedAgentMeta?.name || 'All Agents'}
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
                    setSelectedAgentFilter(null);
                    setDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-[11px] font-mono hover:bg-muted/50 transition-colors ${
                    selectedAgentFilter === null ? 'bg-terminal-accent/10 text-terminal-accent' : 'text-foreground'
                  }`}
                >
                  <span className="text-[10px]">All Agents</span>
                </button>
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      setSelectedAgentFilter(agent.id);
                      setDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-[11px] font-mono hover:bg-muted/50 transition-colors flex items-center gap-2 ${
                      selectedAgentFilter === agent.id ? 'bg-terminal-accent/10 text-terminal-accent' : 'text-foreground'
                    }`}
                  >
                    <img
                      src={getAgentLogo(agent.name)}
                      alt={agent.name}
                      className="w-4 h-4 rounded-full object-contain"
                    />
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
              opacity: [1, 0.5, 1],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
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
          {/* CRITICAL: Use AnimatePresence with popLayout so entries push the rest down smoothly */}
          {/* initial={false} prevents the whole list from replaying entrance animations on mount */}
          <AnimatePresence mode="popLayout" initial={false}>
            {filteredDecisions.map((decision, index) => {
            const isExpanded = expandedId === decision.id;
            const hasHistory = decision.decisionHistory && decision.decisionHistory.length > 0;
            
            // Track only decisions that truly just arrived for entrance animation
            const isNewDecision = newDecisionIdsRef.current.has(decision.id);
            const orderPosition = newDecisionOrderRef.current.get(decision.id) ?? 0;
            const animationDelay = isNewDecision ? Math.min(orderPosition * 0.35, 1.4) : 0;
            
            return (
              <motion.div
                key={decision.id}
                variants={cardVariants}
                initial={isNewDecision ? "hidden" : "visible"}
                animate="visible"
                exit="hidden"
                transition={{
                  duration: isNewDecision ? 0.3 : 0.2,
                  delay: animationDelay,
                  ease: "easeOut",
                }}
                className="bg-bg-elevated border border-border rounded-xl overflow-hidden hover:border-terminal-accent/50 transition-colors will-change-transform"
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
                  {decision.webResearchSummary && decision.webResearchSummary.length > 0 && (
                    <div className="mt-2 p-2 bg-terminal-accent/5 border border-terminal-accent/30 rounded-lg">
                      <div className="flex items-center gap-1 text-terminal-accent text-[10px] font-mono uppercase tracking-[0.1em] mb-1">
                        <Globe className="w-3 h-3" />
                        Web Signals
                      </div>
                      <div className="text-[11px] text-foreground leading-relaxed">
                        <span className="font-semibold">{decision.webResearchSummary[0].source}:</span>{" "}
                        {decision.webResearchSummary[0].snippet || decision.webResearchSummary[0].title}
                      </div>
                    </div>
                  )}
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
                        
                        {decision.webResearchSummary && decision.webResearchSummary.length > 0 && (
                          <div>
                            <div className="text-[11px] text-muted-foreground font-mono uppercase mb-2" style={{ fontWeight: 600 }}>
                              Web Research Highlights
                            </div>
                            <div className="space-y-1.5">
                              {decision.webResearchSummary.map((source, idx) => (
                                <div key={`${decision.id}-expanded-web-${idx}`} className="bg-bg-elevated border border-terminal-accent/20 rounded-lg p-2">
                                  <div className="flex items-center justify-between gap-2 text-[12px] font-semibold text-foreground">
                                    <span>{source.source}</span>
                                    {source.url && (
                                      <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] font-mono uppercase text-terminal-accent hover:underline"
                                      >
                                        View
                                      </a>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                                    {source.snippet || source.title}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
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
                            View Market →
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
