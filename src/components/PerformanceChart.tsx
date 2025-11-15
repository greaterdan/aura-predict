import { useState, useMemo } from "react";
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Customized } from "recharts";
import { TechnicalView } from "./TechnicalView";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

interface ChartDataPoint {
  time: string;
  DEEPSEEK: number;
  CLAUDE: number;
  QWEN: number;
  GEMINI: number;
  GROK: number;
  GPT5: number;
}

const mockChartData: ChartDataPoint[] = [
  { time: "00:00", DEEPSEEK: 1000, CLAUDE: 1000, QWEN: 1000, GEMINI: 1000, GROK: 1000, GPT5: 1000 },
  { time: "04:00", DEEPSEEK: 1120, CLAUDE: 1180, QWEN: 1050, GEMINI: 1250, GROK: 980, GPT5: 950 },
  { time: "08:00", DEEPSEEK: 1280, CLAUDE: 1420, QWEN: 1120, GEMINI: 1480, GROK: 890, GPT5: 870 },
  { time: "12:00", DEEPSEEK: 1450, CLAUDE: 1620, QWEN: 1180, GEMINI: 1680, GROK: 840, GPT5: 800 },
  { time: "16:00", DEEPSEEK: 1590, CLAUDE: 1880, QWEN: 1240, GEMINI: 1920, GROK: 780, GPT5: 750 },
  { time: "20:00", DEEPSEEK: 1720, CLAUDE: 2120, QWEN: 1316, GEMINI: 2180, GROK: 740, GPT5: 710 },
];

const AGENT_LOGO: Record<string, string> = {
  GROK: "/grok.png",
  GEMINI: "/GEMENI.png",
  DEEPSEEK: "/Deepseek-logo-icon.svg",
  CLAUDE: "/Claude_AI_symbol.svg",
  GPT5: "/GPT.png",
  QWEN: "/Qwen_logo.svg",
};

const agents = [
  { id: "GROK", name: "GROK", shortName: "GROK", color: "#F4E6A6", logoKey: "GROK" },
  { id: "GEMINI", name: "Gemini 2.5", shortName: "GEMINI", color: "#8AA4FF", logoKey: "GEMINI" },
  { id: "DEEPSEEK", name: "DeepSeek V3", shortName: "DEEPSEEK", color: "#4BD2A4", logoKey: "DEEPSEEK" },
  { id: "CLAUDE", name: "Claude 4.5", shortName: "CLAUDE", color: "#F79A4F", logoKey: "CLAUDE" },
  { id: "GPT5", name: "GPT-5", shortName: "GPT-5", color: "#C8C8FF", logoKey: "GPT5" },
  { id: "QWEN", name: "Qwen 2.5", shortName: "QWEN", color: "#6b9e7d", logoKey: "QWEN" },
];

// Custom Tooltip Component
const MultiAgentTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div
      style={{
        backgroundColor: "#0B0F17",
        border: "1px solid #262933",
        borderRadius: "8px",
        padding: "10px 12px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
      }}
    >
      <div style={{ color: "#C6CBD9", fontSize: "12px", marginBottom: "8px", fontWeight: 500 }}>
        {label}
      </div>
      {payload.map((entry: any, index: number) => {
        const agent = agents.find(a => a.id === entry.dataKey);
        if (!agent) return null;
        return (
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: index < payload.length - 1 ? "6px" : "0",
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                backgroundColor: entry.color,
                borderRadius: "2px",
                flexShrink: 0,
              }}
            />
            <span style={{ color: "#C6CBD9", fontSize: "12px", minWidth: "80px" }}>
              {agent.shortName}
            </span>
            <span style={{ color: "#FFFFFF", fontSize: "13px", fontWeight: 600 }}>
              ${entry.value.toFixed(0)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// Line Endpoints Component - renders pills at end of each line
const LineEndpoints = (props: any) => {
  const { xAxisMap, yAxisMap, offset, width, height } = props;
  const xAxis = xAxisMap?.[Object.keys(xAxisMap || {})[0]];
  const yAxis = yAxisMap?.[Object.keys(yAxisMap || {})[0]];
  
  if (!xAxis || !yAxis || !mockChartData || mockChartData.length === 0) return null;
  
  const lastDataPoint = mockChartData[mockChartData.length - 1];
  const chartWidth = xAxis.width || width - offset.left - offset.right;
  const chartLeft = offset.left;
  const chartTop = offset.top;
  
  // Get Y domain from axis or calculate from data
  const yDomain = yAxis.domain || (() => {
    let min = Infinity;
    let max = -Infinity;
    mockChartData.forEach((point) => {
      agents.forEach((agent) => {
        const value = point[agent.id as keyof ChartDataPoint] as number;
        if (value !== undefined && value !== null) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      });
    });
    const padding = (max - min) * 0.1;
    return [Math.max(0, Math.floor(min - padding)), Math.ceil(max + padding)];
  })();
  
  const chartHeight = yAxis.height || height - offset.top - offset.bottom;
  
  // Manual scale calculation
  const scaleY = (value: number) => {
    const [min, max] = yDomain;
    if (max === min) return chartTop + chartHeight / 2;
    const ratio = (max - value) / (max - min);
    return chartTop + ratio * chartHeight;
  };
  
  return (
    <g>
      {agents.map((agent) => {
        const value = lastDataPoint[agent.id as keyof ChartDataPoint] as number;
        if (value === undefined || value === null) return null;
        
        // Calculate X position (right edge of chart)
        const xPos = chartLeft + chartWidth;
        
        // Calculate Y position based on value
        const yPos = scaleY(value);
        
        // Pill dimensions
        const connectorLength = 8;
        const pillX = xPos + connectorLength;
        const pillHeight = 26;
        const logoSize = 18;
        const pillPadding = { left: 4, right: 10, top: 4, bottom: 4 };
        
        // Calculate pill width based on content
        // Logo (18) + gap (6) + text width estimate (~50px for "$1250") + padding
        const textWidth = `${value.toFixed(0)}`.length * 7 + 15; // rough estimate
        const pillWidth = logoSize + 6 + textWidth + pillPadding.left + pillPadding.right;
        
        // Clamp pill to not overflow
        const maxX = chartLeft + chartWidth + 140; // margin.right
        const clampedPillX = Math.min(pillX, maxX - pillWidth);
        
        return (
          <g key={agent.id}>
            {/* Tiny horizontal connector line */}
            <line
              x1={xPos}
              y1={yPos}
              x2={xPos + connectorLength}
              y2={yPos}
              stroke={agent.color}
              strokeWidth={1}
            />
            
            {/* Pill using foreignObject for HTML rendering */}
            <foreignObject
              x={clampedPillX}
              y={yPos - pillHeight / 2}
              width={pillWidth}
              height={pillHeight}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: `${pillPadding.top}px ${pillPadding.right}px ${pillPadding.bottom}px ${pillPadding.left}px`,
                  background: "rgba(5, 6, 8, 0.95)",
                  border: `1px solid ${agent.color}`,
                  borderRadius: "9999px",
                  height: `${pillHeight}px`,
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#ffffff",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  whiteSpace: "nowrap",
                }}
              >
                {/* Agent Logo */}
                <img
                  src={AGENT_LOGO[agent.logoKey]}
                  alt={agent.name}
                  width={logoSize}
                  height={logoSize}
                  style={{
                    borderRadius: "50%",
                    flexShrink: 0,
                  }}
                  onError={(e) => {
                    // Fallback if image doesn't load
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                {/* Latest Value */}
                <span>${value.toFixed(0)}</span>
              </div>
            </foreignObject>
          </g>
        );
      })}
    </g>
  );
};

export const PerformanceChart = () => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"chart" | "technical">("chart");

  // Calculate Y-axis domain for proper scaling
  const { minValue, maxValue } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    mockChartData.forEach((point) => {
      agents.forEach((agent) => {
        const value = point[agent.id as keyof ChartDataPoint] as number;
        if (value !== undefined && value !== null) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      });
    });
    // Add some padding
    const padding = (max - min) * 0.1;
    return {
      minValue: Math.max(0, Math.floor(min - padding)),
      maxValue: Math.ceil(max + padding),
    };
  }, []);

  // Generate Y-axis ticks
  const yAxisTicks = useMemo(() => {
    const numTicks = 5;
    const step = (maxValue - minValue) / (numTicks - 1);
    return Array.from({ length: numTicks }, (_, i) => minValue + step * i);
  }, [minValue, maxValue]);
  
  // Store domain values for LineEndpoints
  const yDomain = [minValue, maxValue];

  return (
    <div className="h-full flex flex-col bg-bg-elevated">
      {/* Chart Header */}
      <div className="h-10 flex items-center justify-between px-4 border-b border-border bg-bg-elevated">
        <span className="text-xs text-terminal-accent font-mono leading-none flex items-center">&gt; PERFORMANCE_INDEX</span>
        <div className="flex gap-2">
          {/* View Mode Toggle */}
          <div className="flex gap-1 mr-2">
            <button
              onClick={() => setViewMode("chart")}
              className={`text-xs px-2 py-1 border border-border rounded-full ${
                viewMode === "chart" ? 'bg-muted' : 'hover:bg-muted'
              } transition-colors`}
            >
              CHART
            </button>
            <button
              onClick={() => setViewMode("technical")}
              className={`text-xs px-2 py-1 border border-border rounded-full ${
                viewMode === "technical" ? 'bg-muted' : 'hover:bg-muted'
              } transition-colors`}
            >
              TECHNICAL
            </button>
          </div>
          
          {/* Agent Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors border border-border bg-background rounded-full">
              {selectedAgent || "All Agents"}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-background border-border rounded-xl">
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
        <div className="flex-1 relative" style={{ backgroundColor: "#050608" }}>
          {/* Lower Band Gradient Overlay */}
          <div
            className="absolute bottom-0 left-0 right-0 pointer-events-none z-0"
            style={{
              height: "40%",
              background: "linear-gradient(to bottom, transparent 0%, #1D120F 40%, #050608 100%)",
              opacity: 0.6,
            }}
          />
          
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={mockChartData}
              margin={{ top: 20, right: 140, bottom: 30, left: 50 }}
              style={{ backgroundColor: "transparent" }}
            >
              <defs>
                <linearGradient id="lowerBandGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1D120F" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#050608" stopOpacity={0} />
                </linearGradient>
              </defs>
              
              <CartesianGrid
                stroke="#242935"
                strokeWidth={1}
                vertical={false}
                horizontal={true}
              />
              
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "#C6CBD9",
                  fontSize: 11,
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              />
              
              <YAxis
                domain={[minValue, maxValue]}
                axisLine={false}
                tickLine={false}
                ticks={yAxisTicks}
                tick={{
                  fill: "#C6CBD9",
                  fontSize: 11,
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
                tickFormatter={(value) => `$${value.toFixed(0)}`}
              />
              
              <Tooltip
                content={<MultiAgentTooltip />}
                cursor={{ stroke: "#3A404B", strokeWidth: 1, strokeDasharray: "none" }}
              />
              
              {/* Agent Lines */}
              {agents.map((agent) => {
                const isVisible = selectedAgent === null || selectedAgent === agent.id;
                
                return (
                  <Line
                    key={agent.id}
                    type="monotone"
                    dataKey={agent.id}
                    stroke={agent.color}
                    strokeWidth={selectedAgent === agent.id ? 2.5 : 2}
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: agent.color,
                      strokeWidth: 0,
                    }}
                    isAnimationActive={true}
                    animationDuration={300}
                  />
                );
              })}
              
              {/* Custom Line Endpoints */}
              <Customized component={LineEndpoints} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <TechnicalView />
      )}
    </div>
  );
};
