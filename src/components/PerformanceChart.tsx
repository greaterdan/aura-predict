import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TechnicalView } from "./TechnicalView";

interface ChartDataPoint {
  time: string;
  GROK: number;
  OPENAI: number;
  DEEPSEEK: number;
  GEMINI: number;
}

const mockChartData: ChartDataPoint[] = [
  { time: "00:00", GROK: 1000, OPENAI: 1000, DEEPSEEK: 1000, GEMINI: 1000 },
  { time: "04:00", GROK: 1120, OPENAI: 1180, DEEPSEEK: 980, GEMINI: 1250 },
  { time: "08:00", GROK: 1280, OPENAI: 1420, DEEPSEEK: 890, GEMINI: 1480 },
  { time: "12:00", GROK: 1450, OPENAI: 1620, DEEPSEEK: 840, GEMINI: 1680 },
  { time: "16:00", GROK: 1590, OPENAI: 1880, DEEPSEEK: 780, GEMINI: 1920 },
  { time: "20:00", GROK: 1720, OPENAI: 2120, DEEPSEEK: 740, GEMINI: 2180 },
];

const agents = [
  { id: "GROK", name: "GROK", color: "#9ca3af" },
  { id: "OPENAI", name: "OPENAI", color: "#6b9e7d" },
  { id: "DEEPSEEK", name: "DEEPSEEK", color: "#8b91a8" },
  { id: "GEMINI", name: "GEMINI", color: "#9d8b6b" },
];

export const PerformanceChart = () => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"chart" | "technical">("chart");

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border p-2 text-xs">
          <div className="text-muted-foreground mb-1">{payload[0].payload.time}</div>
          {payload.map((entry: any) => (
            <div key={entry.name} className="flex items-center gap-2">
              <div className="w-2 h-2" style={{ backgroundColor: entry.color }} />
              <span className="font-mono">{entry.name}:</span>
              <span className="font-bold">${entry.value.toFixed(0)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col bg-card border border-border">
      {/* Chart Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="text-xs text-terminal-accent font-mono">&gt; PERFORMANCE_INDEX</div>
        <div className="flex gap-2">
          {/* View Mode Toggle */}
          <div className="flex gap-1 mr-2">
            <button
              onClick={() => setViewMode("chart")}
              className={`text-xs px-2 py-1 border border-border ${
                viewMode === "chart" ? 'bg-muted' : 'hover:bg-muted'
              } transition-colors`}
            >
              CHART
            </button>
            <button
              onClick={() => setViewMode("technical")}
              className={`text-xs px-2 py-1 border border-border ${
                viewMode === "technical" ? 'bg-muted' : 'hover:bg-muted'
              } transition-colors`}
            >
              TECHNICAL
            </button>
          </div>
          
          {/* Agent Filters */}
          <div className="flex gap-1">
          <button
            onClick={() => setSelectedAgent(null)}
            className={`text-xs px-2 py-1 border border-border ${
              !selectedAgent ? 'bg-muted' : 'hover:bg-muted'
            } transition-colors`}
          >
            All Agents
          </button>
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent.id === selectedAgent ? null : agent.id)}
              className={`text-xs px-2 py-1 border border-border ${
                selectedAgent === agent.id ? 'bg-muted' : 'hover:bg-muted'
              } transition-colors`}
            >
              {agent.name}
            </button>
          ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      {viewMode === "chart" ? (
        <>
          {/* Chart Area */}
          <div className="flex-1 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={mockChartData}>
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(15, 23, 42, 0.8)" />
                <stop offset="100%" stopColor="rgba(15, 23, 42, 0.4)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis 
              dataKey="time" 
              stroke="#475569"
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={{ stroke: '#1e293b' }}
            />
            <YAxis 
              stroke="#475569"
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={{ stroke: '#1e293b' }}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            {agents.map((agent) => (
              <Line
                key={agent.id}
                type="monotone"
                dataKey={agent.id}
                stroke={agent.color}
                strokeWidth={selectedAgent === agent.id ? 3 : selectedAgent === null ? 2 : 1}
                opacity={selectedAgent === agent.id || selectedAgent === null ? 1 : 0.2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-xs">
        {agents.map((agent) => {
          const latestValue = mockChartData[mockChartData.length - 1][agent.id as keyof ChartDataPoint];
          return (
            <div key={agent.id} className="flex items-center gap-2">
              <div className="w-3 h-px" style={{ backgroundColor: agent.color }} />
              <span className="font-mono text-muted-foreground">{agent.name}</span>
              <span className="font-bold">${latestValue}</span>
            </div>
            );
          })}
        </div>
      </>
      ) : (
        <TechnicalView />
      )}
    </div>
  );
};
