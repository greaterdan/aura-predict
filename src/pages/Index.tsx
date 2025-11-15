import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { PredictionNodeData } from "@/components/PredictionNode";
import { PredictionBubbleField } from "@/components/PredictionBubbleField";
import { PerformanceChart } from "@/components/PerformanceChart";
import { SystemStatusBar } from "@/components/SystemStatusBar";
import { ActivePositions } from "@/components/ActivePositions";
import { TradesPanel } from "@/components/TradesPanel";
import { AISummaryPanel } from "@/components/AISummaryPanel";
import { AgentBuilder } from "@/components/AgentBuilder";
import { getOrCreateWallet } from "@/lib/wallet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { fetchPolymarketMarkets, fetchFeaturedMarkets, transformPolymarketToPrediction, mapPolymarketCategory, fetchMarketsByCategory } from "@/lib/polymarketApi";

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
  { id: "grok", name: "GROK 4", emoji: "🔥", isActive: false, pnl: -63.0, openMarkets: 139, lastTrade: "NO on AI Sentience @ $0.40" },
  { id: "gpt5", name: "GPT-5", emoji: "✨", isActive: true, pnl: -83.7, openMarkets: 60, lastTrade: "YES on Quantum Chip @ $0.24" },
  { id: "deepseek", name: "DEEPSEEK V3", emoji: "🔮", isActive: false, pnl: 16.4, openMarkets: 23, lastTrade: "YES on ETH $3,500 @ $0.72" },
  { id: "gemini", name: "GEMINI 2.5", emoji: "♊", isActive: false, pnl: -30.2, openMarkets: 101, lastTrade: "NO on Mars Mission @ $0.39" },
  { id: "claude", name: "CLAUDE 4.5", emoji: "🧠", isActive: false, pnl: 16.2, openMarkets: 158, lastTrade: "YES on Fed Rate Cut @ $0.66" },
  { id: "qwen", name: "QWEN 2.5", emoji: "🤖", isActive: false, pnl: 7.9, openMarkets: 219, lastTrade: "NO on Trump 2028 @ $0.34" },
];

const mockPredictions: PredictionNodeData[] = [
  {
    id: "1",
    question: "Will Thunderbolts be the top grossing movie of 2025?",
    probability: 7,
    position: "NO",
    price: 0.004,
    change: -2.5,
    agentName: "GEMINI 2.5",
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
    agentName: "GROK 4",
    agentEmoji: "🔥",
    reasoning: "Current polling data and swing state dynamics indicate favorable conditions. Economic indicators and campaign momentum support moderate-to-high probability.",
  },
  {
    id: "3",
    question: "Will ETH close above $3,500 this week?",
    probability: 72,
    position: "YES",
    price: 0.72,
    change: 5.8,
    agentName: "DEEPSEEK V3",
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
    agentName: "GEMINI 2.5",
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
    agentName: "GPT-5",
    agentEmoji: "✨",
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
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [leftPanelSize, setLeftPanelSize] = useState(33);
  const [rightPanelSize, setRightPanelSize] = useState(33);
  const [predictions, setPredictions] = useState<PredictionNodeData[]>(mockPredictions);
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [showAgentBuilder, setShowAgentBuilder] = useState(false);
  const [custodialWallet, setCustodialWallet] = useState<{ publicKey: string; privateKey: string } | null>(null);

  // Fetch markets from Polymarket API
  useEffect(() => {
    const loadMarkets = async () => {
      console.log('🚀 Loading markets for category:', selectedCategory);
      setLoadingMarkets(true);
      try {
        let markets: any[] = [];
        
        // Determine which markets to fetch based on category
        if (selectedCategory === "All Markets") {
          // Fetch ALL markets - NO FILTERING for "All Markets"
          console.log('📡 Fetching ALL markets (no filtering)...');
          const response = await fetchPolymarketMarkets(2000, undefined, undefined, true); // Fetch ALL ACTIVE markets
          markets = response.markets || response.data || [];
          console.log(`📊 Received ${markets.length} markets from API - showing ALL of them`);
          
          // NO FILTERING - show everything that can be transformed
        } else if (selectedCategory === "Trending" || selectedCategory === "Breaking" || selectedCategory === "New") {
          // Fetch featured/trending markets for special categories
          console.log('📡 Fetching featured markets...');
          markets = await fetchFeaturedMarkets();
          console.log(`📊 Received ${markets.length} featured markets`);
        } else {
          // Fetch by specific category
          console.log(`📡 Fetching markets for category: ${selectedCategory}`);
          markets = await fetchMarketsByCategory(selectedCategory);
          console.log(`📊 Received ${markets.length} markets for category`);
        }

        console.log('🔄 Transforming markets to predictions...');
        console.log(`📦 Starting with ${markets.length} markets to transform`);
        
        // Transform Polymarket markets to PredictionNodeData
        const transformedPredictions: PredictionNodeData[] = [];
        let transformSuccessCount = 0;
        let transformFailCount = 0;
        
        // Use ALL markets - transform EVERYTHING
        for (let index = 0; index < markets.length; index++) {
          const market = markets[index];
          // Distribute markets across agents
          const agentIndex = index % mockAgents.length;
          const agent = mockAgents[agentIndex];
          
          const prediction = transformPolymarketToPrediction(market, agent.name);
          if (prediction) {
            transformSuccessCount++;
            transformedPredictions.push(prediction);
          } else {
            transformFailCount++;
            // Log first few failures to debug
            if (transformFailCount <= 10) {
              console.warn(`⚠️ Failed to transform market ${index + 1}:`, {
                question: market.question || 'NO QUESTION',
                hasTokens: !!market.tokens,
                tokenCount: market.tokens?.length || 0,
                active: market.active,
                closed: market.closed,
                archived: market.archived
              });
            }
          }
          
          // Log progress every 100 markets
          if ((index + 1) % 100 === 0) {
            console.log(`📊 Progress: ${index + 1}/${markets.length} processed, ${transformSuccessCount} succeeded`);
          }
        }
        
        console.log(`✅ Transformation complete: ${transformSuccessCount} succeeded, ${transformFailCount} failed out of ${markets.length} total`);

        // Use transformed predictions if available, otherwise fall back to mock
        if (transformedPredictions.length > 0) {
          console.log(`✅ Successfully loaded ${transformedPredictions.length} predictions from Polymarket API`);
          setPredictions(transformedPredictions);
        } else {
          // Fallback to mock data if API fails or returns no results
          console.warn('⚠️ No markets found from API, using mock data');
          console.warn('⚠️ This usually means:');
          console.warn('   1. API endpoints are incorrect');
          console.warn('   2. CORS issues (API blocked by browser)');
          console.warn('   3. API requires authentication');
          console.warn('   4. API response format is different');
          setPredictions(mockPredictions);
        }
      } catch (error) {
        console.error('❌ Error loading markets:', error);
        console.error('Falling back to mock data');
        // Fallback to mock data on error
        setPredictions(mockPredictions);
      } finally {
        setLoadingMarkets(false);
        console.log('✅ Market loading complete');
      }
    };

    loadMarkets();
  }, [selectedCategory]);

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
    const clickedPrediction = predictions.find(p => p.id === nodeId);
    if (selectedNode === nodeId) {
      // Deselect if clicking the same node
      setSelectedNode(null);
      setSelectedPrediction(null);
    } else {
      // Select the clicked node
      setSelectedNode(nodeId);
      setSelectedPrediction(clickedPrediction || null);
    }
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

  const getCategoryForPrediction = (prediction: PredictionNodeData) => {
    // Try to get category from the prediction data if available
    // Otherwise use question-based categorization
    const q = prediction.question.toLowerCase();
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

  const filteredPredictions = predictions.filter(p => {
    // Don't filter by agent - show all bubbles, just highlight matching ones
    // const agentMatch = selectedAgent 
    //   ? p.agentName === mockAgents.find(a => a.id === selectedAgent)?.name
    //   : true;
    
    const categoryMatch = selectedCategory === "All Markets"
      ? true
      : getCategoryForPrediction(p) === selectedCategory;
    
    const searchMatch = searchQuery.trim() === ""
      ? true
      : p.question.toLowerCase().includes(searchQuery.toLowerCase().trim());
    
    return categoryMatch && searchMatch; // Removed agentMatch filter
  });

  // For "All Markets" - show ALL predictions, no limit
  // For other categories - limit for performance
  const limitedPredictions = useMemo(() => {
    if (selectedCategory === "All Markets") {
      // Show ALL markets - no limit
      return filteredPredictions;
    }
    // Sort by probability (largest first) and limit to 500 for other categories
    const sorted = [...filteredPredictions].sort((a, b) => b.probability - a.probability);
    return sorted.slice(0, 500);
  }, [filteredPredictions, selectedCategory]);


  // Get custodial wallet from localStorage when logged in
  useEffect(() => {
    const checkWallet = () => {
      const storedEmail = localStorage.getItem('userEmail');
      const storedWallet = localStorage.getItem('walletAddress');
      if (storedEmail || storedWallet) {
        const userId = storedEmail || storedWallet || 'default';
        const wallet = getOrCreateWallet(userId);
        setCustodialWallet({
          publicKey: wallet.publicKey,
          privateKey: wallet.privateKey,
        });
      } else {
        setCustodialWallet(null);
      }
    };
    checkWallet();
    // Check periodically
    const interval = setInterval(checkWallet, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen w-full bg-background flex flex-col overflow-hidden">
      {/* Top Status Bar */}
      <SystemStatusBar onToggleAgentBuilder={() => setShowAgentBuilder(!showAgentBuilder)} />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* LEFT: Performance Chart */}
          <ResizablePanel 
            size={leftPanelSize}
            onResize={setLeftPanelSize}
            minSize={5} 
            maxSize={60} 
            collapsible={true}
            collapsedSize={5}
            className="border-r border-border overflow-hidden relative"
          >
            {leftPanelSize >= 10 && <PerformanceChart />}
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* MIDDLE: Prediction Nodes / Dashboard */}
          <ResizablePanel defaultSize={34} minSize={20} maxSize={60} className="relative border-r border-border flex flex-col bg-background" style={{ position: 'relative', overflow: 'hidden', zIndex: zoomLevel > 1 ? 10 : 1 }}>
          {/* Market Category Dropdown */}
          <div className="px-4 border-b border-border flex flex-col bg-bg-elevated">
            <div className="h-10 flex items-center justify-between">
              <span className="text-xs text-terminal-accent font-mono leading-none flex items-center">
                &gt; DASHBOARD
                {loadingMarkets && <span className="ml-2 text-[10px] text-muted-foreground">(Loading markets...)</span>}
              </span>
              <div className="flex items-center gap-3 flex-1 ml-3">
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors border border-border bg-background rounded-full">
                    {selectedCategory}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 bg-background border-border z-50 rounded-xl">
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
                
                {/* Search Bar */}
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Search markets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-9 pr-3 text-xs bg-background border-border focus:border-terminal-accent transition-colors rounded-full"
                  />
                </div>
              </div>
              <span className="text-xs text-muted-foreground font-mono ml-3">
                {filteredPredictions.length} {filteredPredictions.length === 1 ? 'Market' : 'Markets'}
              </span>
            </div>

            {/* Selected Prediction Details Panel */}
            {selectedPrediction && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="border-t border-border bg-bg-elevated py-2 px-4 overflow-hidden"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`text-[11px] px-2 py-0.5 rounded font-mono uppercase font-bold whitespace-nowrap ${
                      selectedPrediction.position === "YES" 
                        ? 'bg-trade-yes/25 text-trade-yes border border-trade-yes/60' 
                        : 'bg-trade-no/25 text-trade-no border border-trade-no/60'
                    }`}>
                      {selectedPrediction.position}
                    </span>
                    <span className="text-[12px] font-mono font-bold text-foreground whitespace-nowrap" style={{ fontWeight: 700 }}>
                      {selectedPrediction.probability}%
                    </span>
                    <span className="text-[11px] text-foreground font-medium truncate flex-1" style={{ fontWeight: 500 }}>
                      {selectedPrediction.question}
                    </span>
                    <div className="flex items-center gap-3 text-[10px] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <img
                          src={((): string => {
                            const agentUpper = selectedPrediction.agentName.toUpperCase();
                            if (agentUpper.includes("GROK")) return "/grok.png";
                            if (agentUpper.includes("GEMINI")) return "/GEMENI.png";
                            if (agentUpper.includes("DEEPSEEK")) return "/Deepseek-logo-icon.svg";
                            if (agentUpper.includes("CLAUDE")) return "/Claude_AI_symbol.svg";
                            if (agentUpper.includes("GPT") || agentUpper.includes("OPENAI")) return "/GPT.png";
                            if (agentUpper.includes("QWEN")) return "/Qwen_logo.svg";
                            return "/placeholder.svg";
                          })()}
                          alt={selectedPrediction.agentName}
                          className="w-4 h-4 object-contain flex-shrink-0 rounded-full"
                          style={{ borderRadius: '50%' }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/placeholder.svg";
                          }}
                        />
                        <span className="font-mono text-foreground font-medium" style={{ fontWeight: 500 }}>{selectedPrediction.agentName}</span>
                      </div>
                      <span className="font-mono text-foreground font-medium" style={{ fontWeight: 500 }}>${selectedPrediction.price.toFixed(2)}</span>
                      <span className={`font-mono font-semibold ${selectedPrediction.change >= 0 ? 'text-trade-yes' : 'text-trade-no'}`} style={{ fontWeight: 600 }}>
                        {selectedPrediction.change >= 0 ? '+' : ''}{selectedPrediction.change.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleShowTrades(selectedPrediction)}
                    className="px-3 py-1.5 text-[11px] font-semibold bg-terminal-accent text-black rounded hover:bg-terminal-accent/90 transition-colors whitespace-nowrap flex-shrink-0"
                    style={{ fontWeight: 600 }}
                  >
                    See Trades
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Prediction Map Container */}
          <div 
            className={`flex-1 relative ${tradesPanelOpen ? 'pointer-events-none opacity-50' : ''}`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            style={{ 
              cursor: isDragging ? 'grabbing' : 'grab',
              overflow: 'hidden',
            }}
          >
            {/* Subtle grid background */}
            <div 
              className="absolute inset-0 opacity-5 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(hsl(var(--border)) 1px, transparent 1px),
                  linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px',
              }}
            />

            {/* Prediction Bubble Field with Zoom/Pan */}
            <div 
              className="absolute origin-center"
              style={{ 
                transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                pointerEvents: isDragging ? 'none' : 'auto',
                width: `${100 / zoomLevel}%`,
                height: `${100 / zoomLevel}%`,
                top: '50%',
                left: '50%',
                marginTop: `-${50 / zoomLevel}%`,
                marginLeft: `-${50 / zoomLevel}%`,
                overflow: 'visible',
                willChange: 'transform',
              }}
            >
              <PredictionBubbleField
                markets={limitedPredictions}
                onBubbleClick={(market) => handleNodeClick(market.id)}
                selectedNodeId={selectedNode}
                selectedAgent={selectedAgent}
                agents={mockAgents}
              />
            </div>
          </div>

          {/* Trades Panel - Slide up from bottom, half screen */}
          {tradesPanelOpen && selectedPrediction && (
            <motion.div
              className="absolute bottom-0 left-0 right-0 h-1/2 z-50 bg-bg-elevated border-t border-border flex flex-col"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              <TradesPanel
                isOpen={tradesPanelOpen}
                onClose={() => setTradesPanelOpen(false)}
                predictionTitle={selectedPrediction.question}
                trades={[]}
              />
            </motion.div>
          )}
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* RIGHT: AI Summary Panel or Agent Builder */}
          <ResizablePanel 
            size={rightPanelSize}
            onResize={setRightPanelSize}
            minSize={5} 
            maxSize={60} 
            collapsible={true}
            collapsedSize={5}
            className="overflow-hidden relative"
          >
            {rightPanelSize >= 10 && (
              showAgentBuilder && custodialWallet ? (
                <AgentBuilder
                  walletAddress={custodialWallet.publicKey}
                  privateKey={custodialWallet.privateKey}
                  onDeploy={() => {
                    // Refresh or show success message
                    setShowAgentBuilder(false);
                  }}
                />
              ) : (
                <AISummaryPanel />
              )
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Bottom Active Positions */}
      <ActivePositions 
        agents={agents}
        selectedAgent={selectedAgent}
        onAgentClick={handleAgentClick}
      />

    </div>
  );
};

export default Index;


