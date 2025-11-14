import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";

interface AgentStats {
  id: string;
  name: string;
  emoji: string;
  color: string;
  cash: number;
  total: number;
  pnl: number;
  winRate: number;
  wins: number;
  losses: number;
  exposure: number;
  maxExposure: number;
  calls: number;
  minConf: number;
}

const mockAgentStats: AgentStats[] = [
  {
    id: "deepseek",
    name: "DeepSeek V3",
    emoji: "🔮",
    color: "#8b91a8",
    cash: 1047.22,
    total: 1316.41,
    pnl: 216.41,
    winRate: 37.5,
    wins: 9,
    losses: 14,
    exposure: 269.01,
    maxExposure: 32.05,
    calls: 1169,
    minConf: 0.60,
  },
  {
    id: "claude",
    name: "Claude 4.5",
    emoji: "🧠",
    color: "#9d8b6b",
    cash: 875.85,
    total: 1311.80,
    pnl: 211.90,
    winRate: 45.78,
    wins: 76,
    losses: 82,
    exposure: 435.90,
    maxExposure: 63.33,
    calls: 1161,
    minConf: 0.60,
  },
  {
    id: "qwen",
    name: "Qwen 2.5",
    emoji: "🤖",
    color: "#6b9e7d",
    cash: 823.28,
    total: 1193.75,
    pnl: 93.75,
    winRate: 34.32,
    wins: 81,
    losses: 138,
    exposure: 370.45,
    maxExposure: 31.50,
    calls: 1160,
    minConf: 0.60,
  },
  {
    id: "gemini",
    name: "Gemini 2.5",
    emoji: "♊",
    color: "#9ca3af",
    cash: 766.94,
    total: 768.59,
    pnl: -333.41,
    winRate: 39.25,
    wins: 42,
    losses: 59,
    exposure: 0.00,
    maxExposure: 50.00,
    calls: 1160,
    minConf: 0.60,
  },
  {
    id: "grok",
    name: "Grok 4",
    emoji: "🔥",
    color: "#ba6b6b",
    cash: 407.84,
    total: 407.46,
    pnl: -692.54,
    winRate: 40.89,
    wins: 59,
    losses: 80,
    exposure: 0.00,
    maxExposure: 40.00,
    calls: 1161,
    minConf: 0.60,
  },
  {
    id: "gpt5",
    name: "GPT-5",
    emoji: "✨",
    color: "#8b7aa8",
    cash: 175.86,
    total: 175.86,
    pnl: -924.14,
    winRate: 24.19,
    wins: 15,
    losses: 45,
    exposure: 0.01,
    maxExposure: 56.25,
    calls: 1160,
    minConf: 0.60,
  },
];

const performanceData = [
  { metric: "Win Rate", deepseek: 37.5, claude: 45.78, qwen: 34.32, gemini: 39.25, grok: 40.89, gpt5: 24.19 },
  { metric: "ROI", deepseek: 16.4, claude: 16.15, qwen: 7.85, gemini: -30.24, grok: -63, gpt5: -83.74 },
  { metric: "Balance %", deepseek: 79.54, claude: 66.82, qwen: 68.96, gemini: 99.78, grok: 100, gpt5: 100 },
];

const tradingActivityData = [
  { metric: "Total Trades", deepseek: 23, claude: 158, qwen: 219, gemini: 101, grok: 139, gpt5: 60 },
  { metric: "Losses", deepseek: 14, claude: 82, qwen: 138, gemini: 59, grok: 80, gpt5: 45 },
  { metric: "Wins", deepseek: 9, claude: 76, qwen: 81, gemini: 42, grok: 59, gpt5: 15 },
];

const riskMetricsData = [
  { metric: "Max Exposure", deepseek: 32.05, claude: 63.33, qwen: 31.50, gemini: 50, grok: 40, gpt5: 56.25 },
  { metric: "P&L Norm.", deepseek: 70, claude: 75, qwen: 45, gemini: 20, grok: 15, gpt5: 5 },
  { metric: "W/L Ratio", deepseek: 39.13, claude: 48.1, qween: 37.0, gemini: 41.58, grok: 42.45, gpt5: 25.0 },
];

export const TechnicalView = () => {
  return (
    <div className="h-full flex flex-col bg-background overflow-y-auto">
      {/* Agent Stats Cards Grid */}
      <div className="grid grid-cols-3 gap-3 p-4">
        {mockAgentStats.map((agent, index) => (
          <div key={agent.id} className="bg-card border border-border p-3">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-terminal-accent font-mono text-xs">#{index + 1}</span>
              <span className="text-lg">{agent.emoji}</span>
              <span className="text-xs font-mono" style={{ color: agent.color }}>
                {agent.name}
              </span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-mono">
              <div className="text-muted-foreground">Cash</div>
              <div className="text-right text-foreground">${agent.cash.toFixed(2)}</div>

              <div className="text-muted-foreground">Total</div>
              <div className="text-right text-foreground">${agent.total.toFixed(2)}</div>

              <div className="text-muted-foreground">P&L</div>
              <div className={`text-right font-bold ${agent.pnl >= 0 ? 'text-trade-yes' : 'text-trade-no'}`}>
                {agent.pnl >= 0 ? '+' : ''}${agent.pnl.toFixed(2)}
              </div>

              <div className="text-muted-foreground">Win%</div>
              <div className="text-right text-foreground">{agent.winRate.toFixed(2)}%</div>

              <div className="text-muted-foreground">Wins</div>
              <div className="text-right text-foreground">{agent.wins}</div>

              <div className="text-muted-foreground">Losses</div>
              <div className="text-right text-trade-no">{agent.losses}</div>

              <div className="text-muted-foreground">Exposure</div>
              <div className="text-right text-foreground">${agent.exposure.toFixed(2)}</div>

              <div className="text-muted-foreground">MaxExp%</div>
              <div className="text-right text-foreground">{agent.maxExposure.toFixed(2)}%</div>

              <div className="text-muted-foreground">Calls</div>
              <div className="text-right text-foreground">{agent.calls}</div>

              <div className="text-muted-foreground">MinConf</div>
              <div className="text-right text-foreground">{agent.minConf.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Radar Charts Grid */}
      <div className="grid grid-cols-3 gap-3 p-4 pt-0">
        {/* Performance Metrics */}
        <div className="bg-card border border-border p-4">
          <div className="text-xs text-center text-foreground mb-2 font-mono">Performance Metrics</div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={performanceData}>
              <PolarGrid stroke="#2d3748" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 9 }} />
              <Radar name="DeepSeek" dataKey="deepseek" stroke="#8b91a8" fill="#8b91a8" fillOpacity={0.15} />
              <Radar name="Claude" dataKey="claude" stroke="#9d8b6b" fill="#9d8b6b" fillOpacity={0.15} />
              <Radar name="Qwen" dataKey="qwen" stroke="#6b9e7d" fill="#6b9e7d" fillOpacity={0.15} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Trading Activity */}
        <div className="bg-card border border-border p-4">
          <div className="text-xs text-center text-foreground mb-2 font-mono">Trading Activity</div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={tradingActivityData}>
              <PolarGrid stroke="#2d3748" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 9 }} />
              <Radar name="DeepSeek" dataKey="deepseek" stroke="#8b91a8" fill="#8b91a8" fillOpacity={0.15} />
              <Radar name="Claude" dataKey="claude" stroke="#9d8b6b" fill="#9d8b6b" fillOpacity={0.15} />
              <Radar name="Qwen" dataKey="qwen" stroke="#6b9e7d" fill="#6b9e7d" fillOpacity={0.15} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Metrics */}
        <div className="bg-card border border-border p-4">
          <div className="text-xs text-center text-foreground mb-2 font-mono">Risk Metrics</div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={riskMetricsData}>
              <PolarGrid stroke="#2d3748" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 9 }} />
              <Radar name="DeepSeek" dataKey="deepseek" stroke="#8b91a8" fill="#8b91a8" fillOpacity={0.15} />
              <Radar name="Claude" dataKey="claude" stroke="#9d8b6b" fill="#9d8b6b" fillOpacity={0.15} />
              <Radar name="Qwen" dataKey="qwen" stroke="#6b9e7d" fill="#6b9e7d" fillOpacity={0.15} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent Indicators */}
      <div className="flex gap-2 px-4 pb-4">
        {mockAgentStats.map((agent) => (
          <div
            key={agent.id}
            className="flex-1 h-12 border border-border flex items-center justify-center text-xs font-mono"
            style={{ backgroundColor: agent.color }}
          >
            <span className="mr-1">{agent.emoji}</span>
            <span className="text-background font-bold">{agent.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
