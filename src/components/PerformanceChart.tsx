import { useState, useMemo } from "react";
import { Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Customized } from "recharts";
import { TechnicalView } from "./TechnicalView";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, ZoomIn, ZoomOut } from "lucide-react";

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

  // Deduplicate payload entries by dataKey (Area and Line both contribute, so we get duplicates)
  const seen = new Set<string>();
  const uniquePayload = payload.filter((entry: any) => {
    if (seen.has(entry.dataKey)) {
      return false;
    }
    seen.add(entry.dataKey);
    return true;
  });

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
      {uniquePayload.map((entry: any, index: number) => {
        const agent = agents.find(a => a.id === entry.dataKey);
        if (!agent) return null;
        // Use agent color from agents array (more reliable than entry.color)
        const agentColor = agent.color || entry.color;
        return (
          <div
            key={entry.dataKey}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: index < uniquePayload.length - 1 ? "6px" : "0",
            }}
          >
            <div
              style={{
                width: "12px",
                height: "12px",
                backgroundColor: agentColor,
                borderRadius: "3px",
                flexShrink: 0,
                border: `1px solid ${agentColor}`,
                boxShadow: `0 0 4px ${agentColor}40`,
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
const createLineEndpoints = (selectedAgent: string | null) => (props: any) => {
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
        // Only show endpoint if agent is visible (all agents or selected agent)
        const isVisible = selectedAgent === null || selectedAgent === agent.id;
        if (!isVisible) return null;
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

interface PerformanceChartProps {
  predictions?: Array<{ id: string; agentName?: string }>;
  selectedMarketId?: string | null;
}

export const PerformanceChart = ({ predictions = [], selectedMarketId = null }: PerformanceChartProps = {}) => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"chart" | "technical">("chart");
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = normal, >1 = zoomed in, <1 = zoomed out

  // Filter agents to only show those trading the selected market
  const filteredAgents = useMemo(() => {
    if (!selectedMarketId || !predictions || predictions.length === 0) {
      // If no market selected, show all agents
      return agents;
    }

    // Find the selected market
    const selectedMarket = predictions.find(p => p.id === selectedMarketId);
    if (!selectedMarket || !selectedMarket.agentName) {
      // If market not found or has no agent, show all agents
      return agents;
    }

    // Only show agents that are trading this specific market
    const tradingAgentName = selectedMarket.agentName.toUpperCase();
    return agents.filter(agent => {
      // Match agent names (case-insensitive)
      // Agent names in predictions are like "GROK 4", "QWEN 2.5", "DEEPSEEK V3", etc.
      const agentNameUpper = agent.name.toUpperCase();
      const agentIdUpper = agent.id.toUpperCase();
      const shortNameUpper = agent.shortName?.toUpperCase() || '';
      
      // Check if trading agent name contains agent identifier
      return tradingAgentName.includes(agentIdUpper) ||
             tradingAgentName.includes(shortNameUpper) ||
             tradingAgentName.includes(agentNameUpper.split(' ')[0]) || // Match first word (e.g., "GROK" from "GROK 4")
             agentNameUpper.includes(tradingAgentName.split(' ')[0]); // Match first word of trading agent
    });
  }, [selectedMarketId, predictions]);

  // Calculate base Y-axis domain for proper scaling
  const { baseMinValue, baseMaxValue } = useMemo(() => {
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
      baseMinValue: Math.max(0, Math.floor(min - padding)),
      baseMaxValue: Math.ceil(max + padding),
    };
  }, []);

  // Calculate zoomed Y-axis domain
  const { minValue, maxValue } = useMemo(() => {
    const range = baseMaxValue - baseMinValue;
    const center = (baseMaxValue + baseMinValue) / 2;
    const zoomedRange = range / zoomLevel;
    return {
      minValue: Math.max(0, Math.floor(center - zoomedRange / 2)),
      maxValue: Math.ceil(center + zoomedRange / 2),
    };
  }, [baseMinValue, baseMaxValue, zoomLevel]);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 1.5, 5)); // Max 5x zoom
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev / 1.5, 0.5)); // Min 0.5x zoom (zoom out)
  };

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
      <div className="h-10 flex items-center justify-between px-2 sm:px-4 border-b border-border bg-bg-elevated min-w-0 overflow-hidden">
        <span className="text-[10px] sm:text-xs text-terminal-accent font-mono leading-none flex items-center flex-shrink-0 whitespace-nowrap">
          <span className="hidden sm:inline">&gt; PERFORMANCE_INDEX</span>
          <span className="sm:hidden">&gt; PERF</span>
        </span>
        <div className="flex gap-1 sm:gap-2 items-center min-w-0 flex-shrink">
          {/* Zoom Controls - only show in chart view */}
          {viewMode === "chart" && (
            <div className="flex gap-0.5 sm:gap-1 items-center border-r border-border pr-1 sm:pr-2 mr-1 sm:mr-2 flex-shrink-0">
              <button
                onClick={handleZoomOut}
                className="text-[9px] sm:text-xs px-1 sm:px-1.5 py-0.5 sm:py-1 border border-border rounded-full hover:bg-muted transition-colors flex items-center justify-center"
                title="Zoom Out"
              >
                <ZoomOut className="h-2.5 sm:h-3 w-2.5 sm:w-3" />
              </button>
              <button
                onClick={handleZoomIn}
                className="text-[9px] sm:text-xs px-1 sm:px-1.5 py-0.5 sm:py-1 border border-border rounded-full hover:bg-muted transition-colors flex items-center justify-center"
                title="Zoom In"
              >
                <ZoomIn className="h-2.5 sm:h-3 w-2.5 sm:w-3" />
              </button>
            </div>
          )}
          {/* View Mode Toggle */}
          <div className="flex gap-0.5 sm:gap-1 flex-shrink-0">
            <button
              onClick={() => setViewMode("chart")}
              className={`text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 border border-border rounded-full whitespace-nowrap ${
                viewMode === "chart" ? 'bg-muted' : 'hover:bg-muted'
              } transition-colors`}
            >
              CHART
            </button>
            <button
              onClick={() => setViewMode("technical")}
              className={`text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 border border-border rounded-full whitespace-nowrap ${
                viewMode === "technical" ? 'bg-muted' : 'hover:bg-muted'
              } transition-colors`}
            >
              TECH
            </button>
          </div>
          
          {/* Agent Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-0.5 sm:py-1 text-[9px] sm:text-xs font-medium text-foreground hover:bg-muted/50 transition-colors border border-border bg-background rounded-full min-w-0 overflow-hidden">
              <span className="truncate max-w-[60px] sm:max-w-none">{selectedAgent || "All"}</span>
              <ChevronDown className="h-2.5 sm:h-3 w-2.5 sm:w-3 opacity-50 flex-shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-background border-border rounded-xl">
              <DropdownMenuItem
                onClick={() => setSelectedAgent(null)}
                className={`cursor-pointer text-sm ${!selectedAgent ? 'bg-muted text-primary font-medium' : ''}`}
              >
                All Agents
              </DropdownMenuItem>
              {filteredAgents.map((agent) => (
                <DropdownMenuItem
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent.id === selectedAgent ? null : agent.id)}
                  className={`cursor-pointer text-sm ${selectedAgent === agent.id ? 'bg-muted text-primary font-medium' : ''}`}
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
                {/* Gradient definitions for each agent area */}
                {agents.map((agent) => {
                  const isVisible = selectedAgent === null || selectedAgent === agent.id;
                  if (!isVisible) return null;
                  
                  return (
                    <linearGradient key={`gradient-${agent.id}`} id={`gradient-${agent.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={agent.color} stopOpacity={0.3} />
                      <stop offset="50%" stopColor={agent.color} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={agent.color} stopOpacity={0} />
                    </linearGradient>
                  );
                })}
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
              
              {/* Agent Areas and Lines - render areas first, then lines on top */}
              {agents.map((agent) => {
                const isVisible = selectedAgent === null || selectedAgent === agent.id;
                
                // Only render if visible
                if (!isVisible) return null;
                
                return (
                  <Area
                    key={`area-${agent.id}`}
                    type="monotone"
                    dataKey={agent.id}
                    fill={`url(#gradient-${agent.id})`}
                    stroke="none"
                    isAnimationActive={true}
                    animationDuration={1500}
                    animationEasing="ease-out"
                  />
                );
              })}
              {agents.map((agent) => {
                const isVisible = selectedAgent === null || selectedAgent === agent.id;
                
                // Only render line if visible
                if (!isVisible) return null;
                
                return (
                  <Line
                    key={agent.id}
                    type="monotone"
                    dataKey={agent.id}
                    stroke={agent.color}
                    strokeWidth={selectedAgent === agent.id ? 2.5 : 2}
                    dot={false}
                    activeDot={{
                      r: 6,
                      fill: agent.color,
                      strokeWidth: 2,
                      stroke: "#050608",
                    }}
                    isAnimationActive={true}
                    animationDuration={1500}
                    animationEasing="ease-out"
                    animationBegin={0}
                  />
                );
              })}
              
              {/* Custom Line Endpoints */}
              <Customized component={createLineEndpoints(selectedAgent)} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <TechnicalView />
      )}
    </div>
  );
};
