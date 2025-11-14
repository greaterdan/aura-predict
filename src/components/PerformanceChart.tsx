import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TechnicalView } from "./TechnicalView";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

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
  { id: "GROK", name: "GROK", color: "#4EB5FF" },       // accent-info blue
  { id: "OPENAI", name: "OPENAI", color: "#FF9CED" },   // soft magenta
  { id: "DEEPSEEK", name: "DEEPSEEK", color: "#F4A24E" }, // orange
  { id: "GEMINI", name: "GEMINI", color: "#9BE87E" },   // greenish
];

export const PerformanceChart = () => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"chart" | "technical">("chart");

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-bg-card border border-border p-3 text-xs shadow-xl">
          <div className="text-text-secondary mb-2 font-medium">{payload[0].payload.time}</div>
          {payload.map((entry: any) => (
            <div key={entry.name} className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2" style={{ backgroundColor: entry.color }} />
              <span className="font-mono text-text-secondary">{entry.name}:</span>
              <span className="font-semibold text-foreground">${entry.value.toFixed(0)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col bg-bg-elevated border border-border">
      {/* Chart Header */}
      <div className="h-10 flex items-center justify-between px-4 border-b border-border bg-bg-elevated">
        <span className="text-xs text-terminal-accent font-mono leading-none flex items-center">&gt; PERFORMANCE_INDEX</span>
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
          
          {/* Agent Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors border border-border bg-background">
              {selectedAgent || "All Agents"}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-background border-border">
              <DropdownMenuItem
                onClick={() => setSelectedAgent(null)}
                className={`cursor-pointer ${!selectedAgent ? 'bg-muted text-primary font-medium' : ''}`}
              >
                All Agents
              </DropdownMenuItem>
              {agents.map((agent) => (
                <DropdownMenuItem
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent.id === selectedAgent ? null : agent.id)}
                  className={`cursor-pointer ${selectedAgent === agent.id ? 'bg-muted text-primary font-medium' : ''}`}
                >
                  {agent.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content Area */}
      {viewMode === "chart" ? (
        <>
          {/* Chart Area */}
          <div className="flex-1 p-4" style={{ background: 'linear-gradient(180deg, #090B11 0%, #050608 100%)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={mockChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--grid-lines))" vertical={false} />
            <XAxis 
              dataKey="time" 
              stroke="hsl(var(--text-muted))"
              tick={{ fill: 'hsl(var(--text-muted))', fontSize: 11 }}
              axisLine={{ stroke: 'hsl(var(--grid-lines))' }}
            />
            <YAxis 
              stroke="hsl(var(--text-muted))"
              tick={{ fill: 'hsl(var(--text-muted))', fontSize: 11 }}
              axisLine={{ stroke: 'hsl(var(--grid-lines))' }}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            {agents.map((agent) => (
              <Line
                key={agent.id}
                type="monotone"
                dataKey={agent.id}
                stroke={agent.color}
                strokeWidth={selectedAgent === agent.id ? 2.5 : selectedAgent === null ? 2 : 1}
                opacity={selectedAgent === agent.id || selectedAgent === null ? 1 : 0.2}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-xs bg-bg-elevated">
        {agents.map((agent) => {
          const latestValue = mockChartData[mockChartData.length - 1][agent.id as keyof ChartDataPoint];
          return (
            <div key={agent.id} className="flex items-center gap-2">
              <div className="w-3 h-px" style={{ backgroundColor: agent.color }} />
              <span className="font-mono text-text-secondary">{agent.name}</span>
              <span className="font-semibold text-foreground">${latestValue}</span>
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
