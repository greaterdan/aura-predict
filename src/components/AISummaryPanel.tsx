import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Brain, TrendingUp, TrendingDown, Activity, ChevronDown } from "lucide-react";

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

interface AIDecision {
  id: string;
  agentName: string;
  agentEmoji: string;
  timestamp: Date;
  action: string;
  market: string;
  decision: "YES" | "NO";
  confidence: number;
  reasoning: string;
  decisionHistory?: Array<{
    id: string;
    timestamp: Date;
    market: string;
    decision: "YES" | "NO";
    confidence: number;
    reasoning: string;
  }>;
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

export const AISummaryPanel = () => {
  const [decisions, setDecisions] = useState(mockDecisions);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="h-10 px-4 border-b border-border flex items-center justify-between bg-bg-elevated flex-shrink-0">
        <span className="text-[13px] text-terminal-accent font-mono leading-none flex items-center">
          &gt; SUMMARY
        </span>
        <div className="flex items-center gap-2">
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

      {/* Activity Feed */}
      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <div className="p-3 space-y-3">
          {decisions.map((decision, index) => {
            const isExpanded = expandedId === decision.id;
            const hasHistory = decision.decisionHistory && decision.decisionHistory.length > 0;
            
            return (
              <motion.div
                key={decision.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-bg-elevated border border-border rounded-xl overflow-hidden hover:border-terminal-accent/50 transition-colors"
              >
                {/* Clickable Header */}
                <div
                  onClick={() => hasHistory && toggleExpand(decision.id)}
                  className={`p-3 ${hasHistory ? 'cursor-pointer' : ''}`}
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

              {/* Market */}
              <div className="text-[13px] font-mono text-foreground mb-2" style={{ fontWeight: 500 }}>
                {decision.market}
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

                  {/* Reasoning */}
                  <div className="text-[12px] text-text-secondary leading-relaxed" style={{ fontWeight: 400 }}>
                    {decision.reasoning}
                  </div>
                </div>

                {/* Expanded Decision History */}
                <AnimatePresence>
                  {isExpanded && hasHistory && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 border-t border-border mt-2 pt-3">
                        <div className="text-[13px] text-muted-foreground font-mono uppercase mb-2" style={{ fontWeight: 600 }}>
                          Decision History
                        </div>
                        <div className="space-y-2">
                          {decision.decisionHistory!.map((historyItem, historyIndex) => (
                            <div
                              key={historyItem.id}
                              className="bg-background border border-border rounded-lg p-2.5"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[13px] font-mono text-foreground" style={{ fontWeight: 600 }}>
                                    {historyItem.market}
                                  </span>
                                  <div className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                    historyItem.decision === "YES"
                                      ? "bg-trade-yes/20 text-trade-yes border border-trade-yes/30"
                                      : "bg-trade-no/20 text-trade-no border border-trade-no/30"
                                  }`}>
                                    {historyItem.decision}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[12px] text-muted-foreground font-mono">
                                    {formatTimeAgo(historyItem.timestamp)}
                                  </span>
                                  <span className="text-[12px] font-mono text-terminal-accent" style={{ fontWeight: 600 }}>
                                    {historyItem.confidence}%
                                  </span>
                                </div>
                              </div>
                              <div className="text-[13px] text-text-secondary leading-relaxed" style={{ fontWeight: 400 }}>
                                {historyItem.reasoning}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
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

