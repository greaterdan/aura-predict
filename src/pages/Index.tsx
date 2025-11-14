import { useState, useEffect } from "react";
import { PredictionNode, PredictionNodeData } from "@/components/PredictionNode";
import { PerformanceChart } from "@/components/PerformanceChart";
import { SystemStatusBar } from "@/components/SystemStatusBar";
import { ActivePositions } from "@/components/ActivePositions";
import { TradesPanel } from "@/components/TradesPanel";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  emoji: string;
  isActive: boolean;
  pnl: number;
  openMarkets: number;
  lastTrade: string;
}

const mockAgents: Agent[] = [
  { id: "grok", name: "GROK", emoji: "🤖", isActive: false, pnl: 42.5, openMarkets: 12, lastTrade: "YES on Trump 2024 @ $0.67" },
  { id: "openai", name: "OPENAI", emoji: "🧠", isActive: true, pnl: 68.3, openMarkets: 15, lastTrade: "NO on Thunderbolts @ $0.004" },
  { id: "deepseek", name: "DEEPSEEK", emoji: "🔮", isActive: false, pnl: -12.8, openMarkets: 8, lastTrade: "YES on ETH $3,500 @ $0.72" },
  { id: "gemini", name: "GEMINI", emoji: "♊", isActive: false, pnl: 91.2, openMarkets: 18, lastTrade: "YES on SBF >20yrs @ $0.88" },
];

const mockPredictions: PredictionNodeData[] = [
  {
    id: "1",
    question: "Will Thunderbolts be the top grossing movie of 2025?",
    probability: 7,
    position: "NO",
    price: 0.004,
    change: -2.5,
    agentName: "GEMINI",
    agentEmoji: "♊",
    reasoning: "Historical patterns in superhero films show market saturation. Competition from other major franchises and quality concerns suggest limited box office potential.",
  },
  {
    id: "2",
    question: "Will Trump win the 2024 election?",
    probability: 67,
    position: "YES",
    price: 0.67,
    change: 3.2,
    agentName: "GROK",
    agentEmoji: "🤖",
    reasoning: "Current polling data and swing state dynamics indicate favorable conditions. Economic indicators and campaign momentum support moderate-to-high probability.",
  },
  {
    id: "3",
    question: "Will ETH close above $3,500 this week?",
    probability: 72,
    position: "YES",
    price: 0.72,
    change: 5.8,
    agentName: "DEEPSEEK",
    agentEmoji: "🔮",
    reasoning: "Strong bullish signals in market momentum. On-chain metrics show increasing network activity and institutional adoption patterns.",
  },
  {
    id: "4",
    question: "Will SBF get more than 20 years in prison?",
    probability: 88,
    position: "YES",
    price: 0.88,
    change: 1.2,
    agentName: "GEMINI",
    agentEmoji: "♊",
    reasoning: "Legal precedent for financial fraud cases of this magnitude strongly suggests lengthy sentence. Federal guidelines support assessment.",
  },
  {
    id: "5",
    question: "Will AI surpass human intelligence by 2030?",
    probability: 45,
    position: "NO",
    price: 0.55,
    change: -1.8,
    agentName: "OPENAI",
    agentEmoji: "🧠",
    reasoning: "While AI capabilities advance rapidly, achieving AGI that surpasses human intelligence faces significant technical hurdles unlikely resolved in this timeframe.",
  },
];

const Index = () => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [agents, setAgents] = useState(mockAgents);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [tradesPanelOpen, setTradesPanelOpen] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionNodeData | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedCategory, setSelectedCategory] = useState<string>("All Markets");

  // Simulate AI trading activity
  useEffect(() => {
    const interval = setInterval(() => {
      const randomAgentIndex = Math.floor(Math.random() * mockAgents.length);
      
      setAgents(prev => prev.map((agent, idx) => ({
        ...mockAgents[idx], // Preserve all properties from mockAgents
        isActive: idx === randomAgentIndex
      })));

      setTimeout(() => {
        setAgents(prev => prev.map((agent, idx) => ({
          ...mockAgents[idx], // Preserve all properties
          isActive: false
        })));
      }, 1500);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const handleAgentClick = (agentId: string) => {
    setSelectedAgent(selectedAgent === agentId ? null : agentId);
  };

  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(selectedNode === nodeId ? null : nodeId);
  };

  const handleShowTrades = (prediction: PredictionNodeData) => {
    setSelectedPrediction(prediction);
    setTradesPanelOpen(true);
  };

  // Handle mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    setZoomLevel(prev => Math.max(0.5, Math.min(2, prev + delta)));
  };

  // Handle pan start
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true);
      setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
    }
  };

  // Handle pan move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPanPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  // Handle pan end
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const marketCategories = [
    "All Markets",
    "Trending",
    "Breaking",
    "New",
    "Politics",
    "Sports",
    "Finance",
    "Crypto",
    "Geopolitics",
    "Earnings",
    "Tech",
    "World",
    "Elections"
  ];

  const getCategoryForPrediction = (question: string) => {
    const q = question.toLowerCase();
    if (q.includes("trump") || q.includes("election")) return "Elections";
    if (q.includes("sbf") || q.includes("prison")) return "Politics";
    if (q.includes("movie") || q.includes("thunderbolts")) return "Breaking";
    if (q.includes("eth") || q.includes("crypto") || q.includes("bitcoin")) return "Crypto";
    if (q.includes("ai") || q.includes("intelligence")) return "Tech";
    if (q.includes("geopolitic")) return "Geopolitics";
    if (q.includes("earnings") || q.includes("revenue")) return "Earnings";
    if (q.includes("finance") || q.includes("stock")) return "Finance";
    if (q.includes("sport")) return "Sports";
    return "World";
  };

  const filteredPredictions = mockPredictions.filter(p => {
    const agentMatch = selectedAgent 
      ? p.agentName === mockAgents.find(a => a.id === selectedAgent)?.name
      : true;
    
    const categoryMatch = selectedCategory === "All Markets"
      ? true
      : getCategoryForPrediction(p.question) === selectedCategory;
    
    return agentMatch && categoryMatch;
  });

  const nodePositions = [
    { x: 80, y: 50 },
    { x: 420, y: 50 },
    { x: 80, y: 320 },
    { x: 420, y: 320 },
    { x: 250, y: 185 },
  ];

  return (
    <div className="h-screen w-full bg-background flex flex-col overflow-hidden">
      {/* Top Status Bar */}
      <SystemStatusBar />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Prediction Nodes */}
        <div className="w-1/2 relative border-r border-border overflow-hidden flex flex-col bg-background">
          {/* Market Category Dropdown */}
          <div className="px-4 py-2 border-b border-border flex items-center justify-between bg-bg-elevated">
            <div className="flex items-center gap-3">
              <span className="text-xs text-terminal-accent font-mono">&gt; DASHBOARD</span>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors border border-border bg-background">
                  {selectedCategory}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48 bg-background border-border">
                  {marketCategories.map((category) => (
                    <DropdownMenuItem
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`cursor-pointer ${selectedCategory === category ? 'bg-muted text-primary font-medium' : ''}`}
                    >
                      {category}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {filteredPredictions.length} {filteredPredictions.length === 1 ? 'Market' : 'Markets'}
            </span>
          </div>

          {/* Prediction Map Container */}
          <div 
            className="flex-1 relative overflow-hidden"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            {/* Subtle grid background */}
            <div 
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage: `
                  linear-gradient(hsl(var(--border)) 1px, transparent 1px),
                  linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px',
              }}
            />

            {/* Prediction Nodes with Zoom */}
            <div 
              className="relative h-full origin-center"
              style={{ 
                transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                pointerEvents: isDragging ? 'none' : 'auto',
                transition: isDragging ? 'none' : 'transform 0.2s ease-out',
              }}
            >
              {filteredPredictions.map((prediction, index) => (
                <PredictionNode
                  key={prediction.id}
                  data={prediction}
                  position={nodePositions[index]}
                  isHighlighted={selectedNode === prediction.id || (selectedAgent ? prediction.agentName === mockAgents.find(a => a.id === selectedAgent)?.name : false)}
                  onClick={() => handleNodeClick(prediction.id)}
                  onShowTrades={() => handleShowTrades(prediction)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Performance Chart */}
        <div className="w-1/2">
          <PerformanceChart />
        </div>
      </div>

      {/* Bottom Active Positions */}
      <ActivePositions 
        agents={agents}
        selectedAgent={selectedAgent}
        onAgentClick={handleAgentClick}
      />

      {/* Trades Panel */}
      <TradesPanel
        isOpen={tradesPanelOpen}
        onClose={() => setTradesPanelOpen(false)}
        predictionTitle={selectedPrediction?.question || ""}
        trades={[]}
      />
    </div>
  );
};

export default Index;
