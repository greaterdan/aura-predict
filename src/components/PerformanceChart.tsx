import { useState, useMemo, useEffect, useRef } from "react";
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, ReferenceLine, Customized } from "recharts";
import { TechnicalView } from "./TechnicalView";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, ZoomIn, ZoomOut, DollarSign } from "lucide-react";

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

const BACKEND_TO_CHART_ID: Record<string, keyof ChartDataPoint> = {
  'GROK_4': 'GROK',
  'GEMINI_2_5': 'GEMINI',
  'DEEPSEEK_V3': 'DEEPSEEK',
  'CLAUDE_4_5': 'CLAUDE',
  'GPT_5': 'GPT5',
  'QWEN_2_5': 'QWEN',
};

const BACKEND_TO_FRONTEND_ID: Record<string, string> = {
  'GROK_4': 'grok',
  'GEMINI_2_5': 'gemini',
  'DEEPSEEK_V3': 'deepseek',
  'CLAUDE_4_5': 'claude',
  'GPT_5': 'gpt5',
  'QWEN_2_5': 'qwen',
};

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

// Line Endpoints Component - Agents positioned at end of each line
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
        
        // Pill dimensions - simpler design matching image
        const connectorLength = 8;
        const pillX = xPos + connectorLength;
        const pillHeight = 24;
        const logoSize = 16;
        const pillPadding = { left: 6, right: 8, top: 3, bottom: 3 };
        
        // Calculate pill width based on content
        // Logo (16) + gap (6) + text width estimate (~60px for "$1250.00") + padding
        const textWidth = `${value.toFixed(2)}`.length * 7 + 20; // rough estimate
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
                  background: "rgba(5, 6, 8, 0.9)",
                  border: "none",
                  borderRadius: "4px",
                  height: `${pillHeight}px`,
                  fontSize: "11px",
                  fontWeight: 400,
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
                <span>${value.toFixed(2)}</span>
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
  const predictionProbabilityMap = useMemo(() => {
    const map = new Map<string, number>();
    if (Array.isArray(predictions)) {
      predictions.forEach((prediction) => {
        if (!prediction || !prediction.id) return;
        const rawProb = typeof prediction.probability === 'number' ? prediction.probability : 0;
        const normalized = rawProb > 1 ? rawProb / 100 : rawProb;
        const clamped = Math.max(0, Math.min(1, normalized));
        map.set(prediction.id, clamped);
      });
    }
    return map;
  }, [predictions]);
  
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
  
  // PERSISTENT chart data - use ref to maintain across unmounts, state for rendering
  // CRITICAL: Use module-level ref to persist across ALL component instances
  const chartDataRef = useRef<ChartDataPoint[]>(getInitialChartData());
  const [chartData, setChartData] = useState<ChartDataPoint[]>(() => {
    // Initialize from ref if available, otherwise use initial data
    const refData = chartDataRef.current;
    if (refData.length > 0 && refData[0].DEEPSEEK !== STARTING_CAPITAL) {
      // We have real data, use it
      return [...refData];
    }
    return getInitialChartData();
  });
  const [isLoading, setIsLoading] = useState(() => {
    // Only show loading if we don't have real data
    return chartDataRef.current.length === 0 || chartDataRef.current[0].DEEPSEEK === STARTING_CAPITAL;
  });
  const lastAgentPnlRef = useRef<Map<string, number>>(new Map());
  const animationDisabled = true;
  
  // CRITICAL: Restore chart data from ref whenever component mounts or becomes visible
  // This ensures data persists even if component was unmounted
  useEffect(() => {
    const refData = chartDataRef.current;
    // Only restore if we have real data (not just initial data)
    if (refData.length > 0 && refData[0].DEEPSEEK !== STARTING_CAPITAL) {
      if (chartData.length === 0 || chartData[0].DEEPSEEK === STARTING_CAPITAL) {
        console.log('[Chart] Restoring chart data from ref:', refData.length, 'points');
        setChartData([...refData]);
        setIsLoading(false);
      }
    }
  }, [chartData.length]);
  
  // Fetch real agent portfolio data and update chart
  // CRITICAL: This effect should run regardless of component visibility
  useEffect(() => {
    let isMounted = true;
    const loadChartData = async () => {
      try {
        const { API_BASE_URL } = await import('@/lib/apiConfig');
        const response = await fetch(`${API_BASE_URL}/api/agents/summary`);
        
        if (!response.ok) {
          console.error('Failed to fetch agent summary:', response.status, response.statusText);
          return;
        }
        
        const data = await response.json();
        
        // Build chart data from agent portfolios - ONLY based on actual profit/loss
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

          const tradesByAgent: Record<string, any[]> = data.tradesByAgent || {};
          const agentsByFrontendId = new Map<string, any>();
          if (Array.isArray(data.agents)) {
            data.agents.forEach((agent: any) => {
              if (agent?.id) {
                agentsByFrontendId.set(agent.id.toLowerCase(), agent);
              }
            });
          }

          const getProbabilityForTrade = (trade: any): number => {
            const fallback = typeof trade.currentProbability === 'number'
              ? trade.currentProbability
              : typeof trade.entryProbability === 'number'
                ? trade.entryProbability
                : typeof trade.confidence === 'number'
                  ? Math.max(0, Math.min(1, trade.confidence / 100))
                  : 0.5;
            if (!trade) {
              return fallback;
            }
            const liveProb =
              (trade.predictionId && predictionProbabilityMap.get(trade.predictionId)) ??
              (trade.marketId && predictionProbabilityMap.get(trade.marketId)) ??
              fallback;
            return liveProb;
          };

          const computeAgentCapital = (backendId: string) => {
            const trades = tradesByAgent[backendId] || [];
            if (!Array.isArray(trades) || trades.length === 0) {
              const frontendId = BACKEND_TO_FRONTEND_ID[backendId] || backendId.toLowerCase();
              const fallbackAgent = agentsByFrontendId.get(frontendId);
              const fallbackPnl = fallbackAgent?.pnl || 0;
              return STARTING_CAPITAL + fallbackPnl;
            }
            let realizedPnl = 0;
            let unrealizedPnl = 0;
            trades.forEach((trade: any) => {
              const decision = trade.decision || trade.side;
              const investment = trade.investmentUsd || 0;
              if (trade.status === 'CLOSED') {
                if (typeof trade.pnl === 'number') {
                  realizedPnl += trade.pnl;
                }
                return;
              }
              if (!decision || !investment) {
                return;
              }
              const entryProb = typeof trade.entryProbability === 'number'
                ? trade.entryProbability
                : typeof trade.confidence === 'number'
                  ? Math.max(0, Math.min(1, trade.confidence / 100))
                  : 0.5;
              const currentProb = getProbabilityForTrade(trade);
              const probDelta = decision === 'YES'
                ? (currentProb - entryProb)
                : (entryProb - currentProb);
              unrealizedPnl += probDelta * investment;
            });
            return STARTING_CAPITAL + realizedPnl + unrealizedPnl;
          };
          
          // Calculate capital for each agent based ONLY on actual profit/loss from trades
          let hasChanges = false;
          Object.entries(BACKEND_TO_CHART_ID).forEach(([backendId, chartKey]) => {
            const capital = computeAgentCapital(backendId);
            if (typeof capital === 'number' && !isNaN(capital) && isFinite(capital)) {
              // Ensure capital is never below 0
              newDataPoint[chartKey] = Math.max(0, capital);
              const prevPnl = lastAgentPnlRef.current.get(chartKey);
              const currentPnl = capital - STARTING_CAPITAL;
              const changed = prevPnl === undefined || Math.abs(prevPnl - currentPnl) > 0.01; // Only update if change > 1 cent
              if (changed) {
                hasChanges = true;
              }
              lastAgentPnlRef.current.set(chartKey, currentPnl);
            } else {
              // If calculation failed, use last known value or starting capital
              const lastPnl = lastAgentPnlRef.current.get(chartKey);
              newDataPoint[chartKey] = lastPnl !== undefined 
                ? STARTING_CAPITAL + lastPnl 
                : STARTING_CAPITAL;
            }
          });
          
          if (!isMounted) {
            return;
          }
          
          // Update chart data - ONLY if PnL actually changed (prevent unnecessary updates)
          setChartData(prev => {
            if (!isMounted) {
              return prev;
            }
            
            // If no changes, return previous data (don't add duplicate point)
            if (!hasChanges && prev.length > 0) {
              return prev;
            }
            
            // If this is the first load, replace initial data ONLY if we don't have existing data
            if (isLoading) {
              setIsLoading(false);
              // Only use new data if we don't have existing data in ref
              if (chartDataRef.current.length === 0 || chartDataRef.current[0].DEEPSEEK === STARTING_CAPITAL) {
                const firstData = [newDataPoint];
                chartDataRef.current = firstData; // Persist to ref
                return firstData;
              } else {
                // We have existing data, keep it and just update
                return prev;
              }
            }
            
            // Only append if there are actual changes
            // Check if last point is too recent (within 5 seconds) - prevent duplicate points
            const lastPoint = prev[prev.length - 1];
            const timeSinceLastPoint = newDataPoint.timestamp && lastPoint?.timestamp 
              ? newDataPoint.timestamp - lastPoint.timestamp 
              : Infinity;
            
            let updated: ChartDataPoint[];
            if (timeSinceLastPoint < 5000 && prev.length > 0) {
              // Update last point instead of adding new one (if within 5 seconds)
              updated = [...prev.slice(0, -1), newDataPoint];
            } else {
              // Add new point
              updated = [...prev, newDataPoint];
            }

            // Sort by timestamp and keep last 20 points for clean chart view
            updated.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            const finalData = updated.slice(-20);
            chartDataRef.current = finalData; // Persist to ref for next mount
            return finalData;
          });
      } catch (error) {
        console.error('Failed to fetch chart data:', error);
        // Keep showing initial data if API fails
      }
    };
    
    // Load immediately on mount
    loadChartData();
    // Update chart every 30 seconds - CONTINUE UPDATING EVEN IF COMPONENT IS HIDDEN
    // This ensures chart data stays fresh when panel is reopened
    const interval = setInterval(() => {
      if (isMounted) {
        loadChartData();
      }
    }, 30 * 1000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
    // Remove isLoading from deps - we want this to run continuously
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predictionProbabilityMap]);

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
    <div className="h-full flex flex-col bg-background">
      {/* Chart Header */}
      <div className="h-10 flex items-center justify-between px-2 sm:px-4 border-b border-border bg-background min-w-0 overflow-hidden">
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
          {/* Dollar Sign Icon - Top Right */}
          <div className="absolute top-4 right-4 z-10 pointer-events-none">
            <DollarSign className="w-5 h-5 text-muted-foreground opacity-50" />
          </div>
          
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 160, bottom: 30, left: 50 }}
              style={{ backgroundColor: "transparent" }}
            >
              <CartesianGrid
                stroke="#242935"
                strokeWidth={1}
                vertical={false}
                horizontal={true}
              />
              
              {/* Reference Line - Faint white dashed */}
              <ReferenceLine
                y={STARTING_CAPITAL}
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth={1}
                strokeDasharray="5 5"
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
              
              {/* Clean Lines Only - No Areas */}
              {agents.map((agent) => {
                const isVisible = selectedAgent === null || selectedAgent === agent.id;
                
                if (!isVisible) return null;
                
                return (
                  <Line
                    key={agent.id}
                    type="linear"
                    connectNulls
                    dataKey={agent.id}
                    stroke={agent.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{
                      r: 4,
                      fill: agent.color,
                      strokeWidth: 2,
                      stroke: "#050608",
                    }}
                    isAnimationActive={false}
                  />
                );
              })}
              
              {/* Agents at End of Lines */}
              <Customized component={createLineEndpoints(selectedAgent, chartData)} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <TechnicalView selectedAgentId={selectedAgentId} />
      )}
    </div>
  );
};
