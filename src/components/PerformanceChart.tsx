import { useState, useMemo, useEffect } from "react";
import { Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Customized, ReferenceLine } from "recharts";
import { TechnicalView } from "./TechnicalView";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, ZoomIn, ZoomOut } from "lucide-react";

interface ChartDataPoint {
  time: string;
  timestamp?: number; // Full timestamp for sorting
  DEEPSEEK: number;
  CLAUDE: number;
  QWEN: number;
  GEMINI: number;
  GROK: number;
  GPT5: number;
}

// All agents start with $3,000 USD
const STARTING_CAPITAL = 3000;

// Initial chart data - all agents start at $3,000
// This will be replaced with real data from the API
const getInitialChartData = (): ChartDataPoint[] => {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  return [
    { 
      time: timeStr,
      timestamp: now.getTime(),
      DEEPSEEK: STARTING_CAPITAL, 
      CLAUDE: STARTING_CAPITAL, 
      QWEN: STARTING_CAPITAL, 
      GEMINI: STARTING_CAPITAL, 
      GROK: STARTING_CAPITAL, 
      GPT5: STARTING_CAPITAL 
    },
  ];
};

const AGENT_LOGO: Record<string, string> = {
  GROK: "/grok.png",
  GEMINI: "/GEMENI.png",
  DEEPSEEK: "/deepseek.png",
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
const createLineEndpoints = (selectedAgent: string | null, chartData: ChartDataPoint[]) => (props: any) => {
  const { xAxisMap, yAxisMap, offset, width, height } = props;
  const xAxis = xAxisMap?.[Object.keys(xAxisMap || {})[0]];
  const yAxis = yAxisMap?.[Object.keys(yAxisMap || {})[0]];
  
  if (!xAxis || !yAxis || !chartData || chartData.length === 0) return null;
  
  const lastDataPoint = chartData[chartData.length - 1];
  const chartWidth = xAxis.width || width - offset.left - offset.right;
  const chartLeft = offset.left;
  const chartTop = offset.top;
  
  // Get Y domain from axis or calculate from data
  const yDomain = yAxis.domain || (() => {
    let min = Infinity;
    let max = -Infinity;
    chartData.forEach((point) => {
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
  selectedAgentId?: string | null; // Agent selected from bottom navbar
}

export const PerformanceChart = ({ predictions = [], selectedMarketId = null, selectedAgentId = null }: PerformanceChartProps = {}) => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  
  // Update selectedAgent when selectedAgentId prop changes (from bottom navbar)
  useEffect(() => {
    if (selectedAgentId !== null) {
      // Map frontend agent IDs to chart agent IDs
      const agentIdMap: Record<string, string> = {
        'grok': 'GROK',
        'gpt5': 'GPT5',
        'deepseek': 'DEEPSEEK',
        'gemini': 'GEMINI',
        'claude': 'CLAUDE',
        'qwen': 'QWEN',
      };
      const chartAgentId = agentIdMap[selectedAgentId.toLowerCase()] || selectedAgentId.toUpperCase();
      setSelectedAgent(chartAgentId);
    } else {
      setSelectedAgent(null);
    }
  }, [selectedAgentId]);
  const [viewMode, setViewMode] = useState<"chart" | "technical">("chart");
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = normal, >1 = zoomed in, <1 = zoomed out
  const [chartData, setChartData] = useState<ChartDataPoint[]>(getInitialChartData());
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch real agent portfolio data and update chart
  useEffect(() => {
    const loadChartData = async () => {
      try {
        const { API_BASE_URL } = await import('@/lib/apiConfig');
        const response = await fetch(`${API_BASE_URL}/api/agents/summary`);
        
        if (response.ok) {
          const data = await response.json();
          
          // Build chart data from agent portfolios
          const now = new Date();
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          
          const newDataPoint: ChartDataPoint = {
            time: timeStr,
            timestamp: now.getTime(), // Store full timestamp for sorting
            DEEPSEEK: STARTING_CAPITAL, // Default to starting capital
            CLAUDE: STARTING_CAPITAL,
            QWEN: STARTING_CAPITAL,
            GEMINI: STARTING_CAPITAL,
            GROK: STARTING_CAPITAL,
            GPT5: STARTING_CAPITAL,
          };
          
          // Map agent data to chart format
          if (data.agents && Array.isArray(data.agents)) {
            const agentMap: Record<string, string> = {
              'deepseek': 'DEEPSEEK',
              'claude': 'CLAUDE',
              'qwen': 'QWEN',
              'gemini': 'GEMINI',
              'grok': 'GROK',
              'gpt5': 'GPT5',
            };
            
            data.agents.forEach((agent: any) => {
              const chartKey = agentMap[agent.id] as keyof ChartDataPoint;
              if (chartKey) {
                // Calculate current capital: starting ($3,000) + PnL
                // PnL can be positive (wins) or negative (losses)
                // If no trades have been made, PnL is 0, so capital = $3,000
                const pnl = agent.pnl || 0;
                newDataPoint[chartKey] = STARTING_CAPITAL + pnl;
              }
            });
          }
          
          // Replace chart data with real data (don't append to mock data)
          setChartData(prev => {
            // If this is the first load, replace initial data
            // Otherwise, add new point and keep historical data (last 100 points for multi-day view)
            if (isLoading) {
              setIsLoading(false);
              return [newDataPoint];
            }
            // Check if this timestamp already exists (avoid duplicates)
            const existingIndex = prev.findIndex(p => 
              p.timestamp && Math.abs(p.timestamp - newDataPoint.timestamp!) < 60000 // Within 1 minute
            );
            
            let updated: ChartDataPoint[];
            if (existingIndex >= 0) {
              // Update existing point
              updated = [...prev];
              updated[existingIndex] = newDataPoint;
            } else {
              // Add new point
              updated = [...prev, newDataPoint];
            }
            
            // Sort by timestamp and keep last 20 points for clean chart view
            updated.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            return updated.slice(-20);
          });
        } else {
          console.error('Failed to fetch agent summary:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Failed to fetch chart data:', error);
        // Keep showing initial data if API fails
      }
    };
    
    // Load immediately on mount
    loadChartData();
    // Update chart every 30 seconds
    const interval = setInterval(loadChartData, 30 * 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

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
    chartData.forEach((point) => {
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
  }, [chartData]);

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

  // Generate Y-axis ticks (ensure unique values)
  const yAxisTicks = useMemo(() => {
    const numTicks = 5;
    
    // Handle edge case where min === max (all values same)
    if (minValue === maxValue) {
      // Return a few ticks around the single value
      return [Math.max(0, minValue - 100), minValue, minValue + 100];
    }
    
    const step = (maxValue - minValue) / (numTicks - 1);
    const ticks = Array.from({ length: numTicks }, (_, i) => {
      const value = minValue + step * i;
      // Round to avoid floating point precision issues
      return Math.round(value * 100) / 100;
    });
    
    // Deduplicate ticks (in case of rounding creating duplicates)
    const uniqueTicks = Array.from(new Set(ticks));
    
    // Ensure we have at least 2 ticks
    if (uniqueTicks.length < 2) {
      return [minValue, maxValue];
    }
    
    return uniqueTicks;
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
              data={chartData}
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
              <Customized component={createLineEndpoints(selectedAgent, chartData)} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <TechnicalView />
      )}
    </div>
  );
};
