import { motion } from "framer-motion";
import { useState } from "react";

interface AgentPosition {
  id: string;
  name: string;
  emoji: string;
  pnl: number;
  openMarkets: number;
  lastTrade: string;
  isActive: boolean;
}

interface ActivePositionsProps {
  agents: AgentPosition[];
  selectedAgent: string | null;
  onAgentClick: (agentId: string) => void;
}

type MetricView = 'overview' | 'performance' | 'prediction' | 'behavior';

export const ActivePositions = ({ agents, selectedAgent, onAgentClick }: ActivePositionsProps) => {
  const [metricView, setMetricView] = useState<MetricView>('overview');

  // Calculate metrics
  const totalPnL = agents.reduce((sum, agent) => sum + agent.pnl, 0);
  const totalMarkets = agents.reduce((sum, agent) => sum + agent.openMarkets, 0);
  const activeAgents = agents.filter(agent => agent.isActive).length;
  const profitableAgents = agents.filter(agent => agent.pnl > 0).length;
  const winRate = agents.length > 0 ? (profitableAgents / agents.length) * 100 : 0;

  // Advanced metrics (mock data - would come from real calculations)
  const realizedPnL = totalPnL * 0.75; // 75% realized
  const unrealizedPnL = totalPnL * 0.25; // 25% unrealized
  const maxDrawdown = -18.4;
  const sharpeRatio = 1.8;
  const avgHoldTime = 3.4;
  const calibrationScore = 0.92;
  const brierScore = 0.17;
  const avgEdge = 6.3;
  const tradeFrequency = 37;
  const divergenceIndex = 32;
  const consensusLevel = 18;
  const capitalUtilization = 74;

  const cycleMetricView = () => {
    const views: MetricView[] = ['overview', 'performance', 'prediction', 'behavior'];
    const currentIndex = views.indexOf(metricView);
    const nextIndex = (currentIndex + 1) % views.length;
    setMetricView(views[nextIndex]);
  };

  const renderMetrics = () => {
    switch (metricView) {
      case 'overview':
        return (
          <>
            <div className="flex flex-col">
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-[0.08em] mb-0.5" style={{ fontWeight: 600 }}>
                TOTAL P&L
              </div>
              <div className={`text-lg font-bold ${totalPnL >= 0 ? 'text-trade-yes' : 'text-trade-no'}`} style={{ fontWeight: 700 }}>
                {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(1)}%
              </div>
            </div>

            <div className="flex flex-col">
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-[0.08em] mb-0.5" style={{ fontWeight: 600 }}>
                MARKETS
              </div>
              <div className="text-lg font-bold text-foreground" style={{ fontWeight: 700 }}>
                {totalMarkets}
              </div>
            </div>

            <div className="flex flex-col">
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-[0.08em] mb-0.5" style={{ fontWeight: 600 }}>
                WIN RATE
              </div>
              <div className="text-lg font-bold text-terminal-accent" style={{ fontWeight: 700 }}>
                {winRate.toFixed(0)}%
              </div>
            </div>

            <div className="flex flex-col">
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-[0.08em] mb-0.5" style={{ fontWeight: 600 }}>
                ACTIVE
              </div>
              <div className="flex items-center gap-2">
                <div className="text-lg font-bold text-foreground" style={{ fontWeight: 700 }}>
                  {activeAgents}/{agents.length}
                </div>
                {activeAgents > 0 && (
                  <div className="w-2 h-2 rounded-full bg-trade-yes animate-pulse" />
                )}
              </div>
            </div>
          </>
        );

      case 'performance':
        return (
          <>
            <div className="flex flex-col">
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-[0.08em] mb-0.5" style={{ fontWeight: 600 }}>
                REALIZED
              </div>
              <div className={`text-lg font-bold ${realizedPnL >= 0 ? 'text-trade-yes' : 'text-trade-no'}`} style={{ fontWeight: 700 }}>
                {realizedPnL >= 0 ? '+' : ''}{realizedPnL.toFixed(1)}%
              </div>
            </div>

            <div className="flex flex-col">
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-[0.08em] mb-0.5" style={{ fontWeight: 600 }}>
                UNREALIZED
              </div>
              <div className={`text-lg font-bold ${unrealizedPnL >= 0 ? 'text-trade-yes' : 'text-trade-no'}`} style={{ fontWeight: 700 }}>
                {unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnL.toFixed(1)}%
              </div>
            </div>

            <div className="flex flex-col">
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-[0.08em] mb-0.5" style={{ fontWeight: 600 }}>
                MAX DRAWDOWN
              </div>
              <div className="text-lg font-bold text-trade-no" style={{ fontWeight: 700 }}>
                {maxDrawdown.toFixed(1)}%
              </div>
            </div>

            <div className="flex flex-col">
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-[0.08em] mb-0.5" style={{ fontWeight: 600 }}>
                R/V RATIO
              </div>
              <div className="text-lg font-bold text-terminal-accent" style={{ fontWeight: 700 }}>
                {sharpeRatio.toFixed(1)}
              </div>
            </div>

            <div className="flex flex-col">
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-[0.08em] mb-0.5" style={{ fontWeight: 600 }}>
                AVG HOLD
              </div>
              <div className="text-lg font-bold text-foreground" style={{ fontWeight: 700 }}>
                {avgHoldTime.toFixed(1)}d
              </div>
            </div>
          </>
        );

      case 'prediction':
        return (
          <>
            <div className="flex flex-col">
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-[0.08em] mb-0.5" style={{ fontWeight: 600 }}>
                CALIBRATION
              </div>
              <div className="text-lg font-bold text-trade-yes" style={{ fontWeight: 700 }}>
                {calibrationScore.toFixed(2)}
              </div>
            </div>

            <div className="flex flex-col">
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-[0.08em] mb-0.5" style={{ fontWeight: 600 }}>
                BRIER SCORE
              </div>
              <div className="text-lg font-bold text-terminal-accent" style={{ fontWeight: 700 }}>
                {brierScore.toFixed(2)}
              </div>
            </div>

            <div className="flex flex-col">
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-[0.08em] mb-0.5" style={{ fontWeight: 600 }}>
                AVG EDGE
              </div>
              <div className="text-lg font-bold text-trade-yes" style={{ fontWeight: 700 }}>
                +{avgEdge.toFixed(1)} pts
              </div>
            </div>

            <div className="flex flex-col">
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-[0.08em] mb-0.5" style={{ fontWeight: 600 }}>
                WIN RATE
              </div>
              <div className="text-lg font-bold text-foreground" style={{ fontWeight: 700 }}>
                {winRate.toFixed(0)}%
              </div>
            </div>
          </>
        );

      case 'behavior':
        return (
          <>
            <div className="flex flex-col">
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-[0.08em] mb-0.5" style={{ fontWeight: 600 }}>
                TRADES/24H
              </div>
              <div className="text-lg font-bold text-foreground" style={{ fontWeight: 700 }}>
                {tradeFrequency}
              </div>
            </div>

            <div className="flex flex-col">
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-[0.08em] mb-0.5" style={{ fontWeight: 600 }}>
                DIVERGENCE
              </div>
              <div className="text-lg font-bold text-terminal-accent" style={{ fontWeight: 700 }}>
                {divergenceIndex}%
              </div>
            </div>

            <div className="flex flex-col">
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-[0.08em] mb-0.5" style={{ fontWeight: 600 }}>
                CONSENSUS
              </div>
              <div className="text-lg font-bold text-foreground" style={{ fontWeight: 700 }}>
                {consensusLevel}%
              </div>
            </div>

            <div className="flex flex-col">
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-[0.08em] mb-0.5" style={{ fontWeight: 600 }}>
                UTILIZATION
              </div>
              <div className="text-lg font-bold text-trade-yes" style={{ fontWeight: 700 }}>
                {capitalUtilization}%
              </div>
            </div>
          </>
        );
    }
  };

  const getViewLabel = () => {
    switch (metricView) {
      case 'overview': return 'OVERVIEW';
      case 'performance': return 'PERFORMANCE & RISK';
      case 'prediction': return 'PREDICTION QUALITY';
      case 'behavior': return 'AGENT BEHAVIOR';
    }
  };

  return (
    <div className="h-16 bg-bg-card border-t border-border">
      <div className="flex items-center h-full px-2.5 gap-2.5">
        {/* AI Agents Section */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {agents.map((agent, index) => (
            <motion.button
              key={agent.id}
              onClick={() => onAgentClick(agent.id)}
              className={`flex-shrink-0 w-[130px] h-12 p-1.5 flex items-center gap-1.5 border transition-colors ${
                selectedAgent === agent.id
                  ? 'border-terminal-accent bg-muted'
                  : 'border-border bg-bg-elevated hover:bg-muted'
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Agent Icon with Status */}
              <div className="relative">
                <div className="text-lg">{agent.emoji}</div>
                {agent.isActive && (
                  <motion.div
                    className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full bg-trade-yes"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-foreground" style={{ fontWeight: 500 }}>{agent.name}</span>
                    <span className={`text-[9px] ${agent.isActive ? 'text-trade-yes' : 'text-text-muted'}`} style={{ fontWeight: 400 }}>
                      {agent.isActive ? 'ACTIVE' : 'IDLE'}
                    </span>
                  </div>
                  <span className={`text-[11px] ${agent.pnl >= 0 ? 'text-trade-yes' : 'text-trade-no'}`} style={{ fontWeight: 600 }}>
                    {agent.pnl >= 0 ? '+' : ''}{agent.pnl.toFixed(1)}%
                  </span>
                </div>
                <div className="text-[9px] text-text-secondary truncate" style={{ fontWeight: 400 }}>
                  {agent.openMarkets} markets • {agent.lastTrade.substring(0, 20)}...
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Vertical Separator */}
        <div className="h-8 w-px bg-border flex-shrink-0" />

        {/* Metrics Section - Clickable */}
        <motion.button
          onClick={cycleMetricView}
          className="flex items-center gap-4 flex-shrink-0 px-2.5 py-1.5 hover:bg-muted/30 transition-colors rounded border border-transparent hover:border-border group"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          {renderMetrics()}
          
          {/* View Indicator */}
          <div className="ml-2 flex flex-col items-center gap-0.5">
            <div className="text-[7px] text-terminal-accent font-mono uppercase tracking-wider opacity-60 group-hover:opacity-100 transition-opacity">
              {getViewLabel()}
            </div>
            <div className="flex gap-0.5">
              {(['overview', 'performance', 'prediction', 'behavior'] as MetricView[]).map((view) => (
                <div
                  key={view}
                  className={`w-1 h-1 rounded-full transition-all ${
                    view === metricView ? 'bg-terminal-accent' : 'bg-border'
                  }`}
                />
              ))}
            </div>
          </div>
        </motion.button>
      </div>
    </div>
  );
};
