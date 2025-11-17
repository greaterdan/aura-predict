import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { PredictionNodeData } from "@/components/PredictionNode";
import { PredictionBubbleField } from "@/components/PredictionBubbleField";
import { PerformanceChart } from "@/components/PerformanceChart";
import { SystemStatusBar } from "@/components/SystemStatusBar";
import { ActivePositions } from "@/components/ActivePositions";
import { TradesPanel } from "@/components/TradesPanel";
import { AISummaryPanel } from "@/components/AISummaryPanel";
import { NewsFeed } from "@/components/NewsFeed";
import { AgentBuilder } from "@/components/AgentBuilder";
import { getOrCreateWallet } from "@/lib/wallet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ChevronDown, Search, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
// All market fetching is now done server-side via /api/predictions

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

// Mock predictions removed - all data comes from server

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
  const [predictions, setPredictions] = useState<PredictionNodeData[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [showAgentBuilder, setShowAgentBuilder] = useState(false);
  const [custodialWallet, setCustodialWallet] = useState<{ publicKey: string; privateKey: string } | null>(null);
  // Panel visibility state - both open by default
  const [isPerformanceOpen, setIsPerformanceOpen] = useState(true);
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);
  // News feed toggle state
  const [showNewsFeed, setShowNewsFeed] = useState(false);
  // Store saved panel sizes to restore when reopened
  // Load from localStorage on mount, default to 30/40/30 (dashboard gets most space)
  // Initialize all panel sizes together to ensure they add up to 100%
  const getInitialPanelSizes = () => {
    const savedLeft = localStorage.getItem('savedLeftPanelSize');
    const savedRight = localStorage.getItem('savedRightPanelSize');
    let left = savedLeft ? parseFloat(savedLeft) : 30;
    let right = savedRight ? parseFloat(savedRight) : 30;
    
    // Validate: if saved values don't make sense, reset to defaults (30/40/30)
    const middle = 100 - left - right;
    if (left < 15 || left > 50 || right < 15 || right > 50 || middle < 30 || middle > 70) {
      // Reset to default: 30/40/30 (dashboard gets most space)
      left = 30;
      right = 30;
      localStorage.setItem('savedLeftPanelSize', '30');
      localStorage.setItem('savedRightPanelSize', '30');
    }
    
    return { left, right, middle: 100 - left - right };
  };
  
  const initialSizes = getInitialPanelSizes();
  const [savedLeftPanelSize, setSavedLeftPanelSize] = useState(initialSizes.left);
  const [savedRightPanelSize, setSavedRightPanelSize] = useState(initialSizes.right);
  // Current panel sizes - initialize from saved values
  const [leftPanelSize, setLeftPanelSize] = useState(initialSizes.left);
  const [rightPanelSize, setRightPanelSize] = useState(initialSizes.right);
  // Middle panel size - dynamically calculated based on side panels
  const [middlePanelSize, setMiddlePanelSize] = useState(initialSizes.middle);

  // Clear any conflicting localStorage from autoSaveId on mount
  useEffect(() => {
    // Clear the autoSaveId localStorage that might have bad values
    localStorage.removeItem('react-resizable-panels:panel-layout');
  }, []);

  // Persist saved panel sizes to localStorage
  useEffect(() => {
    localStorage.setItem('savedLeftPanelSize', savedLeftPanelSize.toString());
  }, [savedLeftPanelSize]);

  useEffect(() => {
    localStorage.setItem('savedRightPanelSize', savedRightPanelSize.toString());
  }, [savedRightPanelSize]);

  // Fetch predictions from server (all processing is server-side)
  useEffect(() => {
    const loadPredictions = async () => {
      console.log('🚀 Loading predictions for category:', selectedCategory);
      setLoadingMarkets(true);
      try {
        // Call server endpoint - server handles ALL fetching, filtering, and transformation
        // Request ALL markets - no limit
        const response = await fetch(`http://localhost:3002/api/predictions?category=${encodeURIComponent(selectedCategory)}&limit=100000`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.predictions && Array.isArray(data.predictions)) {
          console.log(`✅ Loaded ${data.predictions.length} predictions from server`);
          console.log(`📊 Server stats: ${data.totalFetched} fetched, ${data.totalTransformed} transformed`);
          setPredictions(data.predictions);
        } else {
          console.error('❌ Invalid response format from server');
          setPredictions([]);
        }
      } catch (error) {
        console.error('❌ Error loading predictions:', error);
        console.error('❌ Make sure server is running: npm run server');
        setPredictions([]);
      } finally {
        setLoadingMarkets(false);
        console.log('✅ Prediction loading complete');
      }
    };

    loadPredictions();
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
    // Don't start dragging if clicking on interactive elements or resizing panels
    if (e.button === 0 && !isResizingRef.current) {
      // Check if clicking on a button, link, or input
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, select, textarea')) {
        return;
      }
      setIsDragging(true);
      setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
      e.preventDefault();
    }
  };

  // Global mouse move handler for smooth dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPanPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, dragStart]);

  // Handle pan move (local handler for immediate feedback)
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
    // Don't stop dragging on mouse leave - use global handlers instead
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

  // Filter predictions by search query only (category filtering is done server-side)
  const filteredPredictions = useMemo(() => {
    if (searchQuery.trim() === "") {
      return predictions; // No search query, return all
    }
    
    const filtered = predictions.filter(p => {
      return p.question.toLowerCase().includes(searchQuery.toLowerCase().trim());
    });
    
    console.log(`🔍 Search filter: ${predictions.length} total → ${filtered.length} after search: "${searchQuery}"`);
    return filtered;
  }, [predictions, searchQuery]);

  // For "All Markets" - show ALL predictions, no limit
  // For other categories - show ALL too, no limit
  const limitedPredictions = useMemo(() => {
    // Show ALL filtered predictions - no limit
    console.log(`🎯 Limited predictions: ${filteredPredictions.length} (no limit applied)`);
    return filteredPredictions;
  }, [filteredPredictions]);


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

  // Handle panel toggles - preserve sizes when closing/opening
  // CRITICAL: When one panel closes, the other panel MUST keep its exact size
  const leftPanelRef = useRef<{ id: string; size: number }>({ id: 'left', size: 30 });
  const rightPanelRef = useRef<{ id: string; size: number }>({ id: 'right', size: 30 });
  
  // Track if we're currently resizing to prevent glitching
  const isResizingRef = useRef(false);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Track which panel is being directly resized (to prevent interference)
  const isDirectlyResizingLeftRef = useRef(false);
  const isDirectlyResizingRightRef = useRef(false);
  // REMOVED: All inversion logic and refs for Summary panel
  // Summary now drags normally just like Performance - no special handling needed

  // Calculate middle panel size based on which panels are open
  // CRITICAL: Skip updates during resize to prevent interference between panels
  useEffect(() => {
    // SKIP if any panel is being directly resized - this prevents interference
    if (isDirectlyResizingLeftRef.current || isDirectlyResizingRightRef.current || isResizingRef.current) {
      return; // DO NOT update middle panel during resize - panels must be independent
    }
    
    // Only update when panels are toggled (opened/closed), not during resize
    let newMiddleSize: number;
    if (isPerformanceOpen && isSummaryOpen) {
      // Both panels open - middle takes remaining space
      newMiddleSize = 100 - leftPanelSize - rightPanelSize;
    } else if (isPerformanceOpen && !isSummaryOpen) {
      // Only Performance open - middle takes FULL SPACE minus Performance
      newMiddleSize = 100 - leftPanelSize;
    } else if (!isPerformanceOpen && isSummaryOpen) {
      // Only Summary open - middle takes FULL SPACE minus Summary
      newMiddleSize = 100 - rightPanelSize;
    } else {
      // Both closed - middle takes 100% FULL SCREEN!
      newMiddleSize = 100;
    }
    
    const finalSize = Math.max(20, Math.min(100, newMiddleSize));
    setMiddlePanelSize(finalSize);
  }, [isPerformanceOpen, isSummaryOpen]);


  const handleTogglePerformance = () => {
    const newState = !isPerformanceOpen;
    setIsPerformanceOpen(newState);
    if (newState) {
      // Opening Performance - always restore to default size (30%)
      const defaultSize = 30;
      setLeftPanelSize(defaultSize);
      setSavedLeftPanelSize(defaultSize);
      leftPanelRef.current.size = defaultSize;
      // Update localStorage immediately to override any saved values
      localStorage.setItem('savedLeftPanelSize', '30');
      // Clear react-resizable-panels localStorage to prevent interference
      localStorage.removeItem('react-resizable-panels:panel-layout');
      // Immediately update middle panel size
      const newMiddle = isSummaryOpen 
        ? 100 - defaultSize - rightPanelSize
        : 100 - defaultSize;
      setMiddlePanelSize(Math.max(20, Math.min(100, newMiddle)));
      // DO NOT touch Summary refs - keep panels independent
    } else {
      // Closing Performance - collapse to 0
      setLeftPanelSize(0);
      leftPanelRef.current.size = 0;
      // Immediately expand middle panel to full space minus summary
      const newMiddle = isSummaryOpen 
        ? 100 - rightPanelSize
        : 100;
      setMiddlePanelSize(Math.max(20, Math.min(100, newMiddle)));
      // DO NOT touch Summary refs - keep panels independent
    }
  };

  const handleToggleSummary = () => {
    const newState = !isSummaryOpen;
    setIsSummaryOpen(newState);
    if (newState) {
      // Opening Summary - always restore to default size (30%)
      const defaultSize = 30;
      setRightPanelSize(defaultSize);
      setSavedRightPanelSize(defaultSize);
      rightPanelRef.current.size = defaultSize;
      // Update localStorage immediately to override any saved values
      localStorage.setItem('savedRightPanelSize', '30');
      // Clear react-resizable-panels localStorage to prevent interference
      localStorage.removeItem('react-resizable-panels:panel-layout');
      // Immediately update middle panel size
      const newMiddle = isPerformanceOpen 
        ? 100 - leftPanelSize - defaultSize
        : 100 - defaultSize;
      setMiddlePanelSize(Math.max(20, Math.min(100, newMiddle)));
    } else {
      // Closing Summary - collapse to 0
      setRightPanelSize(0);
      rightPanelRef.current.size = 0;
      // Immediately expand middle panel to full space minus performance
      const newMiddle = isPerformanceOpen 
        ? 100 - leftPanelSize
        : 100;
      setMiddlePanelSize(Math.max(20, Math.min(100, newMiddle)));
    }
  };

  const handleToggleNewsFeed = () => {
    // Toggle news feed - if Summary panel is closed, open it first
    if (!isSummaryOpen) {
      setIsSummaryOpen(true);
      const defaultSize = 30;
      setRightPanelSize(defaultSize);
      setSavedRightPanelSize(defaultSize);
      rightPanelRef.current.size = defaultSize;
      localStorage.setItem('savedRightPanelSize', '30');
      localStorage.removeItem('react-resizable-panels:panel-layout');
      const newMiddle = isPerformanceOpen 
        ? 100 - leftPanelSize - defaultSize
        : 100 - defaultSize;
      setMiddlePanelSize(Math.max(20, Math.min(100, newMiddle)));
    }
    // Toggle news feed state
    setShowNewsFeed(!showNewsFeed);
  };

  return (
    <div className="h-screen w-full bg-background flex flex-col overflow-hidden">
      {/* Top Status Bar */}
      <SystemStatusBar 
        onToggleAgentBuilder={() => setShowAgentBuilder(!showAgentBuilder)}
        onTogglePerformance={handleTogglePerformance}
        onToggleSummary={handleToggleSummary}
        onToggleNewsFeed={handleToggleNewsFeed}
        isPerformanceOpen={isPerformanceOpen}
        isSummaryOpen={isSummaryOpen}
        showNewsFeed={showNewsFeed}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden w-full" style={{ margin: 0, padding: 0 }}>
        <ResizablePanelGroup 
          key={`group-${isPerformanceOpen}-${isSummaryOpen}`}
          direction="horizontal" 
          className="flex-1 w-full"
          style={{ margin: 0, padding: 0, width: '100%' }}
        >
          {/* LEFT: Performance Chart */}
          <ResizablePanel 
            defaultSize={isPerformanceOpen ? 30 : 0}
            onResize={(size) => {
              // Mark as resizing IMMEDIATELY to prevent any interference
              isResizingRef.current = true;
              isDirectlyResizingLeftRef.current = true;
              
              // ONLY update Performance panel - DO NOT touch Summary panel state
              if (isPerformanceOpen && size >= 10) {
                // Clamp to valid range - max is initial/default size (30%)
                const clampedSize = Math.max(15, Math.min(30, size));
                setLeftPanelSize(clampedSize);
                // Save the size so it restores to the same size when reopened
                setSavedLeftPanelSize(clampedSize);
                leftPanelRef.current.size = clampedSize; // Update ref
                
                // DO NOT update middlePanelSize here - let the library handle it naturally
                // Updating it causes interference with other panels
              }
              
              // Clear resizing flag after a short delay
              if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current);
              }
              resizeTimeoutRef.current = setTimeout(() => {
                if (isDirectlyResizingLeftRef.current) {
                  isResizingRef.current = false;
                  isDirectlyResizingLeftRef.current = false;
                }
              }, 150);
            }}
            minSize={15} 
            maxSize={30} 
            collapsible={true}
            collapsedSize={0}
            className={`${isPerformanceOpen ? 'border-r border-border' : ''} overflow-hidden relative`}
          >
            {isPerformanceOpen && leftPanelSize >= 10 && <PerformanceChart />}
          </ResizablePanel>

          {/* Only show handle when Performance panel is open */}
          {isPerformanceOpen && <ResizableHandle withHandle />}

          {/* MIDDLE: Prediction Nodes / Dashboard - EXPANDS TO FULL SPACE */}
          {/* Middle panel dynamically expands to fill available space */}
          <ResizablePanel 
            key={`middle-${isPerformanceOpen}-${isSummaryOpen}`}
            defaultSize={middlePanelSize}
            onResize={(size) => {
              // CRITICAL: Completely skip if ANY side panel is being dragged
              // This ensures panels are TOTALLY INDEPENDENT
              if (isDirectlyResizingLeftRef.current || isDirectlyResizingRightRef.current) {
                return; // DO NOT PROCESS - panels must be completely independent
              }
              
              // Only process middle panel resize when manually dragging middle panel handle
              // Mark as resizing
              isResizingRef.current = true;
              
              // Only allow manual resizing when both panels are open
              if (isPerformanceOpen && isSummaryOpen) {
                setMiddlePanelSize(size);
                // When middle panel is resized, adjust side panels proportionally
                // BUT only update sizes, don't touch Summary refs to maintain independence
                const availableSpace = 100 - size;
                const totalSidePanels = leftPanelSize + rightPanelSize;
                if (totalSidePanels > 0) {
                  const leftRatio = leftPanelSize / totalSidePanels;
                  const rightRatio = rightPanelSize / totalSidePanels;
                  const newLeftSize = availableSpace * leftRatio;
                  const newRightSize = availableSpace * rightRatio;
                  
                  // IMPORTANT: Clamp sizes to valid range - max is initial/default size (30%)
                  const clampedLeftSize = Math.max(15, Math.min(30, newLeftSize));
                  const clampedRightSize = Math.max(15, Math.min(30, newRightSize));
                  
                  setLeftPanelSize(clampedLeftSize);
                  setRightPanelSize(clampedRightSize);
                  // Save the sizes so they restore to the same size when reopened
                  setSavedLeftPanelSize(clampedLeftSize);
                  setSavedRightPanelSize(clampedRightSize);
                  // CRITICAL: DO NOT update Summary refs - this breaks independence
                  // Summary panel manages its own refs independently
                }
              }
              
              // Clear resizing flag after a delay
              if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current);
              }
              resizeTimeoutRef.current = setTimeout(() => {
                // Only clear if no side panels are being dragged
                if (!isDirectlyResizingLeftRef.current && !isDirectlyResizingRightRef.current) {
                  isResizingRef.current = false;
                }
              }, 200);
            }}
            minSize={20} 
            maxSize={100}
            className={`relative ${isSummaryOpen ? 'border-r border-border' : ''} flex flex-col bg-background`}
            style={{ position: 'relative', overflow: 'hidden', zIndex: zoomLevel > 1 ? 10 : 1, padding: 0, margin: 0, width: '100%' }}
          >
          {/* Market Category Dropdown - EDGE TO EDGE - NO MARGINS OR PADDING ON CONTAINER */}
          <div className="border-b border-border flex flex-col bg-bg-elevated" style={{ width: '100%', margin: 0, padding: 0, marginLeft: 0, marginRight: 0 }}>
            <div className="h-10 flex items-center justify-between px-4">
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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Polymarket Link Button - Always visible */}
                    <a
                      href={
                        selectedPrediction.marketSlug
                          ? `https://polymarket.com/event/${selectedPrediction.marketSlug}`
                          : selectedPrediction.conditionId
                          ? `https://polymarket.com/condition/${selectedPrediction.conditionId}`
                          : `https://polymarket.com/search?q=${encodeURIComponent(selectedPrediction.question)}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center p-2 text-foreground hover:text-terminal-accent hover:bg-muted/80 rounded transition-all border border-border hover:border-terminal-accent/50"
                      title={`Open on Polymarket${selectedPrediction.marketSlug ? `: ${selectedPrediction.marketSlug}` : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('🔗 Opening Polymarket link:', {
                          marketSlug: selectedPrediction.marketSlug,
                          conditionId: selectedPrediction.conditionId,
                          question: selectedPrediction.question,
                          url: selectedPrediction.marketSlug
                            ? `https://polymarket.com/event/${selectedPrediction.marketSlug}`
                            : selectedPrediction.conditionId
                            ? `https://polymarket.com/condition/${selectedPrediction.conditionId}`
                            : `https://polymarket.com/search?q=${encodeURIComponent(selectedPrediction.question)}`
                        });
                      }}
                    >
                      <ExternalLink className="h-4 w-4" strokeWidth={2} />
                    </a>
                    <button
                      onClick={() => handleShowTrades(selectedPrediction)}
                      className="px-3 py-1.5 text-[11px] font-semibold bg-terminal-accent text-black rounded hover:bg-terminal-accent/90 transition-colors whitespace-nowrap"
                      style={{ fontWeight: 600 }}
                    >
                      See Trades
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Prediction Map Container - FULL SPACE */}
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
              width: '100%',
              height: '100%',
              position: 'relative',
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

            {/* Prediction Bubble Field with Zoom/Pan - FULL SPACE */}
            <div 
              className="absolute inset-0"
              style={{ 
                transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                pointerEvents: isDragging ? 'none' : 'auto',
                width: '100%',
                height: '100%',
                overflow: 'visible',
                willChange: 'transform',
                transformOrigin: 'center center',
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

          {/* Only show handle when Summary panel is open */}
          {isSummaryOpen && <ResizableHandle withHandle />}

          {/* RIGHT: AI Summary Panel or Agent Builder */}
          <ResizablePanel 
            key={`summary-${isSummaryOpen}`}
            defaultSize={isSummaryOpen ? 30 : 0}
            onResize={(size) => {
              // Mark as resizing IMMEDIATELY to prevent interference
              isResizingRef.current = true;
              isDirectlyResizingRightRef.current = true;
              
              // Only allow resizing when panel is open
              // NO INVERSION - drag normally just like Performance panel
              if (isSummaryOpen && size >= 10) {
                // Clamp to valid range - max is initial/default size (30%)
                const clampedSize = Math.max(15, Math.min(30, size));
                
                // Update state directly - no inversion, no refs, just like Performance
                setRightPanelSize(clampedSize);
                setSavedRightPanelSize(clampedSize);
                rightPanelRef.current.size = clampedSize;
                
                // DO NOT update middlePanelSize here - let the library handle it naturally
                // Updating it causes interference with other panels
              }
              
              // Clear resizing flag after a delay
              if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current);
              }
              resizeTimeoutRef.current = setTimeout(() => {
                if (isDirectlyResizingRightRef.current) {
                  isResizingRef.current = false;
                  isDirectlyResizingRightRef.current = false;
                }
              }, 150);
            }}
            minSize={15} 
            maxSize={30} 
            collapsible={true}
            collapsedSize={0}
            className={`${isSummaryOpen ? 'border-l border-border' : ''} overflow-hidden relative`}
          >
            {isSummaryOpen && rightPanelSize >= 10 && (
              showAgentBuilder && custodialWallet ? (
                <AgentBuilder
                  walletAddress={custodialWallet.publicKey}
                  privateKey={custodialWallet.privateKey}
                  onDeploy={() => {
                    // Refresh or show success message
                    setShowAgentBuilder(false);
                  }}
                />
              ) : showNewsFeed ? (
                <NewsFeed />
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


