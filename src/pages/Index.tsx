import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { PredictionNodeData } from "@/components/PredictionNode";
import { PredictionBubbleField } from "@/components/PredictionBubbleField";
import { PerformanceChart } from "@/components/PerformanceChart";
import { SystemStatusBar } from "@/components/SystemStatusBar";
import { ActivePositions } from "@/components/ActivePositions";
import { MarketDetailsModal } from "@/components/MarketDetailsModal";
import { MarketDetailsPanel } from "@/components/MarketDetailsPanel";
import { AISummaryPanel } from "@/components/AISummaryPanel";
import { NewsFeed } from "@/components/NewsFeed";
import { AgentBuilder } from "@/components/AgentBuilder";
import { getOrCreateWallet } from "@/lib/wallet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronDown, Search, ExternalLink, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [marketModalOpen, setMarketModalOpen] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionNodeData | null>(null);
  // Removed zoom/pan - bubbles now fill full screen and can only be dragged individually
  const [selectedCategory, setSelectedCategory] = useState<string>("All Markets");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [predictions, setPredictions] = useState<PredictionNodeData[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [bubbleLimit, setBubbleLimit] = useState<number>(50);
  
  // Filter state
  const [filters, setFilters] = useState({
    minVolume: '',
    maxVolume: '',
    minLiquidity: '',
    maxLiquidity: '',
    minPrice: '',
    maxPrice: '',
    minProbability: '',
    maxProbability: '',
    sortBy: 'volume' as 'volume' | 'liquidity' | 'price' | 'probability' | 'none',
    sortOrder: 'desc' as 'asc' | 'desc',
  });
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
          // Only update if market IDs actually changed to prevent unnecessary re-renders
          setPredictions(prevPredictions => {
            const prevIds = new Set(prevPredictions.map(p => p.id).filter(Boolean));
            const newPredictions = data.predictions as PredictionNodeData[];
            const newIds = new Set(newPredictions.map(p => p.id).filter(Boolean));
            
            // Check if market IDs changed
            const idsChanged = 
              prevIds.size !== newIds.size ||
              ![...newIds].every(id => prevIds.has(id));
            
            // If only prices/data changed (same IDs), merge new data with existing positions
            if (!idsChanged && prevPredictions.length === newPredictions.length) {
              // Map new data to existing predictions, preserving order
              return newPredictions.map((newPred) => {
                const existing = prevPredictions.find(p => p.id === newPred.id);
                if (existing) {
                  // Keep existing prediction, just update price/data fields
                  return {
                    ...existing,
                    price: newPred.price,
                    probability: newPred.probability,
                    change: newPred.change,
                    volume: newPred.volume,
                    liquidity: newPred.liquidity,
                    // Update other data fields but keep position/styling
                  };
                }
                return newPred;
              });
            }
            
            // Market IDs changed - return new predictions
            return newPredictions;
          });
        } else {
          setPredictions([]);
        }
      } catch (error) {
        // Don't clear predictions on error - keep existing ones
        console.error('Error loading predictions:', error);
      } finally {
        setLoadingMarkets(false);
      }
    };

    // Load immediately
    loadPredictions();

    // Auto-refresh markets and prices every 30 seconds
    const refreshInterval = setInterval(() => {
      loadPredictions();
    }, 30 * 1000); // 30 seconds

    return () => clearInterval(refreshInterval);
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

  const handleBubbleClick = (prediction: PredictionNodeData) => {
    setSelectedPrediction(prediction);
    // Show in side panel instead of modal
    // Ensure performance panel is open to show the details
    if (!isPerformanceOpen) {
      setIsPerformanceOpen(true);
    }
  };

  const handleCloseMarketDetails = () => {
    setSelectedPrediction(null);
    setSelectedNode(null);
  };

  // Pan/zoom handlers removed - bubbles now fill full screen and can only be dragged individually

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

  // Filter predictions by search query and filters
  const filteredPredictions = useMemo(() => {
    let filtered = predictions;
    
    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(prediction => 
        prediction.question.toLowerCase().includes(query) ||
        prediction.category?.toLowerCase().includes(query) ||
        prediction.agentName?.toLowerCase().includes(query)
      );
    }
    
    // Apply volume filters
    if (filters.minVolume) {
      const minVol = parseFloat(filters.minVolume);
      if (!isNaN(minVol)) {
        filtered = filtered.filter(p => {
          const vol = typeof p.volume === 'string' ? parseFloat(p.volume) : (p.volume || 0);
          return vol >= minVol;
        });
      }
    }
    if (filters.maxVolume) {
      const maxVol = parseFloat(filters.maxVolume);
      if (!isNaN(maxVol)) {
        filtered = filtered.filter(p => {
          const vol = typeof p.volume === 'string' ? parseFloat(p.volume) : (p.volume || 0);
          return vol <= maxVol;
        });
      }
    }
    
    // Apply liquidity filters
    if (filters.minLiquidity) {
      const minLiq = parseFloat(filters.minLiquidity);
      if (!isNaN(minLiq)) {
        filtered = filtered.filter(p => {
          const liq = typeof p.liquidity === 'string' ? parseFloat(p.liquidity) : (p.liquidity || 0);
          return liq >= minLiq;
        });
      }
    }
    if (filters.maxLiquidity) {
      const maxLiq = parseFloat(filters.maxLiquidity);
      if (!isNaN(maxLiq)) {
        filtered = filtered.filter(p => {
          const liq = typeof p.liquidity === 'string' ? parseFloat(p.liquidity) : (p.liquidity || 0);
          return liq <= maxLiq;
        });
      }
    }
    
    // Apply price filters
    if (filters.minPrice) {
      const minPrice = parseFloat(filters.minPrice);
      if (!isNaN(minPrice)) {
        filtered = filtered.filter(p => (p.price || 0) >= minPrice);
      }
    }
    if (filters.maxPrice) {
      const maxPrice = parseFloat(filters.maxPrice);
      if (!isNaN(maxPrice)) {
        filtered = filtered.filter(p => (p.price || 0) <= maxPrice);
      }
    }
    
    // Apply probability filters
    if (filters.minProbability) {
      const minProb = parseFloat(filters.minProbability);
      if (!isNaN(minProb)) {
        filtered = filtered.filter(p => (p.probability || 0) >= minProb);
      }
    }
    if (filters.maxProbability) {
      const maxProb = parseFloat(filters.maxProbability);
      if (!isNaN(maxProb)) {
        filtered = filtered.filter(p => (p.probability || 0) <= maxProb);
      }
    }
    
    // Apply sorting
    if (filters.sortBy !== 'none') {
      filtered = [...filtered].sort((a, b) => {
        let aVal = 0;
        let bVal = 0;
        
        switch (filters.sortBy) {
          case 'volume':
            aVal = typeof a.volume === 'string' ? parseFloat(a.volume) : (a.volume || 0);
            bVal = typeof b.volume === 'string' ? parseFloat(b.volume) : (b.volume || 0);
            break;
          case 'liquidity':
            aVal = typeof a.liquidity === 'string' ? parseFloat(a.liquidity) : (a.liquidity || 0);
            bVal = typeof b.liquidity === 'string' ? parseFloat(b.liquidity) : (b.liquidity || 0);
            break;
          case 'price':
            aVal = a.price || 0;
            bVal = b.price || 0;
            break;
          case 'probability':
            aVal = a.probability || 0;
            bVal = b.probability || 0;
            break;
        }
        
        if (filters.sortOrder === 'asc') {
          return aVal - bVal;
        } else {
          return bVal - aVal;
        }
      });
    }
    
    return filtered;
  }, [predictions, searchQuery, filters]);

  // Apply bubble limit to filtered predictions
  const limitedPredictions = useMemo(() => {
    // Apply the selected bubble limit (0 means show all)
    if (bubbleLimit > 0 && bubbleLimit < filteredPredictions.length) {
      return filteredPredictions.slice(0, bubbleLimit);
    }
    return filteredPredictions;
  }, [filteredPredictions, bubbleLimit]);


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
    // If Summary is already showing (and no other view is active), close the panel
    if (isSummaryOpen && !showNewsFeed && !showAgentBuilder) {
      setIsSummaryOpen(false);
      setRightPanelSize(0);
      rightPanelRef.current.size = 0;
      const newMiddle = isPerformanceOpen 
        ? 100 - leftPanelSize
        : 100;
      setMiddlePanelSize(Math.max(20, Math.min(100, newMiddle)));
      return;
    }
    
    // Opening Summary - switch to Summary view (close other views)
    setShowNewsFeed(false);
    setShowAgentBuilder(false);
    setIsSummaryOpen(true);
    const defaultSize = 30;
    setRightPanelSize(defaultSize);
    setSavedRightPanelSize(defaultSize);
    if (rightPanelRef.current) {
      rightPanelRef.current.size = defaultSize;
    }
    localStorage.setItem('savedRightPanelSize', '30');
    localStorage.removeItem('react-resizable-panels:panel-layout');
    const newMiddle = isPerformanceOpen 
      ? 100 - leftPanelSize - defaultSize
      : 100 - defaultSize;
    setMiddlePanelSize(Math.max(20, Math.min(100, newMiddle)));
  };

  const handleToggleAgentBuilder = () => {
    // If Agent Builder is already showing, close the panel
    if (showAgentBuilder && isSummaryOpen && !showNewsFeed) {
      setShowAgentBuilder(false);
      setIsSummaryOpen(false);
      setRightPanelSize(0);
      if (rightPanelRef.current) {
        rightPanelRef.current.size = 0;
      }
      const newMiddle = isPerformanceOpen 
        ? 100 - leftPanelSize
        : 100;
      setMiddlePanelSize(Math.max(20, Math.min(100, newMiddle)));
      return;
    }
    
    // Opening Agent Builder - switch to Agent Builder view (close other views)
    setShowNewsFeed(false);
    setShowAgentBuilder(true);
    setIsSummaryOpen(true); // Always open summary panel when showing agent builder
    const defaultSize = 30;
    setRightPanelSize(defaultSize);
    setSavedRightPanelSize(defaultSize);
    if (rightPanelRef.current) {
      rightPanelRef.current.size = defaultSize;
    }
    localStorage.setItem('savedRightPanelSize', '30');
    localStorage.removeItem('react-resizable-panels:panel-layout');
    const newMiddle = isPerformanceOpen 
      ? 100 - leftPanelSize - defaultSize
      : 100 - defaultSize;
    setMiddlePanelSize(Math.max(20, Math.min(100, newMiddle)));
  };

  const handleToggleNewsFeed = () => {
    // If News Feed is already showing and panel is open, close it
    if (showNewsFeed && isSummaryOpen) {
      setIsSummaryOpen(false);
      setShowNewsFeed(false);
      setShowAgentBuilder(false);
      setRightPanelSize(0);
      if (rightPanelRef.current) {
        rightPanelRef.current.size = 0;
      }
      const newMiddle = isPerformanceOpen 
        ? 100 - leftPanelSize
        : 100;
      setMiddlePanelSize(Math.max(20, Math.min(100, newMiddle)));
      return;
    }
    
    // Opening News Feed - switch to News Feed view (close other views)
    setShowNewsFeed(true);
    setShowAgentBuilder(false);
    setIsSummaryOpen(true); // Always open summary panel when showing news feed
    const defaultSize = 30;
    setRightPanelSize(defaultSize);
    setSavedRightPanelSize(defaultSize);
    if (rightPanelRef.current) {
      rightPanelRef.current.size = defaultSize;
    }
    localStorage.setItem('savedRightPanelSize', '30');
    localStorage.removeItem('react-resizable-panels:panel-layout');
    const newMiddle = isPerformanceOpen 
      ? 100 - leftPanelSize - defaultSize
      : 100 - defaultSize;
    setMiddlePanelSize(Math.max(20, Math.min(100, newMiddle)));
  };

  return (
    <div className="h-screen w-full bg-background flex flex-col overflow-hidden">
      {/* Top Status Bar */}
      <SystemStatusBar 
        onToggleAgentBuilder={handleToggleAgentBuilder}
        onTogglePerformance={handleTogglePerformance}
        onToggleSummary={handleToggleSummary}
        onToggleNewsFeed={handleToggleNewsFeed}
        isPerformanceOpen={isPerformanceOpen}
        isSummaryOpen={isSummaryOpen}
        showNewsFeed={showNewsFeed}
        showAgentBuilder={showAgentBuilder}
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
            {isPerformanceOpen && leftPanelSize >= 10 && (
              selectedPrediction ? (
                <MarketDetailsPanel
                  market={selectedPrediction}
                  onClose={handleCloseMarketDetails}
                />
              ) : (
              <PerformanceChart 
                predictions={predictions}
                selectedMarketId={selectedNode}
              />
              )
            )}
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
            style={{ position: 'relative', overflow: 'hidden', zIndex: 1, padding: 0, margin: 0, width: '100%' }}
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
                
                {/* Filter Button */}
                <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex items-center gap-2 px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors border border-border bg-background rounded-full h-8"
                    >
                      <Filter className="h-3 w-3" />
                      Filters
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-background border-border">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-bold">Market Filters</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                      {/* Volume Filters */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Volume</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Min Volume ($)</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={filters.minVolume}
                              onChange={(e) => setFilters({...filters, minVolume: e.target.value})}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Max Volume ($)</Label>
                            <Input
                              type="number"
                              placeholder="No limit"
                              value={filters.maxVolume}
                              onChange={(e) => setFilters({...filters, maxVolume: e.target.value})}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Liquidity Filters */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Liquidity</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Min Liquidity ($)</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={filters.minLiquidity}
                              onChange={(e) => setFilters({...filters, minLiquidity: e.target.value})}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Max Liquidity ($)</Label>
                            <Input
                              type="number"
                              placeholder="No limit"
                              value={filters.maxLiquidity}
                              onChange={(e) => setFilters({...filters, maxLiquidity: e.target.value})}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Price Filters */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Price</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Min Price ($)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="1"
                              placeholder="0.00"
                              value={filters.minPrice}
                              onChange={(e) => setFilters({...filters, minPrice: e.target.value})}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Max Price ($)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="1"
                              placeholder="1.00"
                              value={filters.maxPrice}
                              onChange={(e) => setFilters({...filters, maxPrice: e.target.value})}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Probability Filters */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Probability</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Min Probability (%)</Label>
                            <Input
                              type="number"
                              step="1"
                              min="0"
                              max="100"
                              placeholder="0"
                              value={filters.minProbability}
                              onChange={(e) => setFilters({...filters, minProbability: e.target.value})}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Max Probability (%)</Label>
                            <Input
                              type="number"
                              step="1"
                              min="0"
                              max="100"
                              placeholder="100"
                              value={filters.maxProbability}
                              onChange={(e) => setFilters({...filters, maxProbability: e.target.value})}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Sort Options */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Sort By</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Sort Field</Label>
                            <Select
                              value={filters.sortBy}
                              onValueChange={(value: any) => setFilters({...filters, sortBy: value})}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="volume">Volume</SelectItem>
                                <SelectItem value="liquidity">Liquidity</SelectItem>
                                <SelectItem value="price">Price</SelectItem>
                                <SelectItem value="probability">Probability</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Order</Label>
                            <Select
                              value={filters.sortOrder}
                              onValueChange={(value: any) => setFilters({...filters, sortOrder: value})}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="desc">Descending</SelectItem>
                                <SelectItem value="asc">Ascending</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center justify-between pt-4 border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFilters({
                              minVolume: '',
                              maxVolume: '',
                              minLiquidity: '',
                              maxLiquidity: '',
                              minPrice: '',
                              maxPrice: '',
                              minProbability: '',
                              maxProbability: '',
                              sortBy: 'none',
                              sortOrder: 'desc',
                            });
                          }}
                          className="text-xs"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Clear All
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setFilterDialogOpen(false)}
                          className="text-xs"
                        >
                          Apply Filters
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                
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
                
                {/* Bubble Limit Slider */}
                <div className="flex items-center gap-2 px-3 py-1 h-8 bg-background border border-border rounded-full min-w-[180px]">
                  <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[35px]">
                    {bubbleLimit === 0 ? 'All' : `${bubbleLimit}`}
                  </span>
                  <div className="flex-1 relative">
                    <input
                      type="range"
                      min="50"
                      max="1000"
                      step="50"
                      value={bubbleLimit === 0 ? 1000 : bubbleLimit}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        setBubbleLimit(value === 1000 ? 0 : value);
                      }}
                      className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, hsl(var(--terminal-accent)) 0%, hsl(var(--terminal-accent)) ${((bubbleLimit === 0 ? 1000 : bubbleLimit) - 50) / (1000 - 50) * 100}%, hsl(var(--muted)) ${((bubbleLimit === 0 ? 1000 : bubbleLimit) - 50) / (1000 - 50) * 100}%, hsl(var(--muted)) 100%)`
                      }}
                    />
                    <style>{`
                      input[type="range"]::-webkit-slider-thumb {
                        appearance: none;
                        width: 12px;
                        height: 12px;
                        border-radius: 50%;
                        background: hsl(var(--terminal-accent));
                        cursor: pointer;
                        border: 2px solid hsl(var(--background));
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
                      }
                      input[type="range"]::-moz-range-thumb {
                        width: 12px;
                        height: 12px;
                        border-radius: 50%;
                        background: hsl(var(--terminal-accent));
                        cursor: pointer;
                        border: 2px solid hsl(var(--background));
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
                      }
                      input[type="range"]:hover::-webkit-slider-thumb {
                        transform: scale(1.1);
                        transition: transform 0.2s;
                      }
                      input[type="range"]:hover::-moz-range-thumb {
                        transform: scale(1.1);
                        transition: transform 0.2s;
                      }
                    `}</style>
                  </div>
                  <button
                    onClick={() => setBubbleLimit(bubbleLimit === 0 ? 150 : 0)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/50 whitespace-nowrap"
                  >
                    {bubbleLimit === 0 ? 'Limit' : 'All'}
                  </button>
                </div>
              </div>
              <span className="text-xs text-muted-foreground font-mono ml-3">
                {filteredPredictions.length} {filteredPredictions.length === 1 ? 'Market' : 'Markets'}
              </span>
            </div>

          </div>

          {/* Prediction Map Container - FULL SPACE - CLIP TO BOUNDS */}
          <div 
            className="flex-1 relative"
            style={{ 
              width: '100%',
              height: '100%',
              position: 'relative',
              overflow: 'hidden', // CRITICAL: Clip bubbles to prevent navbar overlap
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

            {/* Prediction Bubble Field - FULL SPACE - NO ZOOM/PAN */}
              <PredictionBubbleField
                markets={limitedPredictions}
                onBubbleClick={(market) => handleBubbleClick(market)}
                selectedNodeId={selectedNode}
                selectedAgent={selectedAgent}
                agents={mockAgents}
              />
          </div>
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
              showAgentBuilder ? (
                custodialWallet ? (
                  <AgentBuilder
                    walletAddress={custodialWallet.publicKey}
                    privateKey={custodialWallet.privateKey}
                    onDeploy={() => {
                      // Refresh or show success message
                      setShowAgentBuilder(false);
                    }}
                  />
                ) : (
                  <AgentBuilder
                    walletAddress=""
                    privateKey=""
                    onDeploy={() => {
                      setShowAgentBuilder(false);
                    }}
                  />
                )
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

      {/* Market Details Modal - Replaced by side panel */}
      {/* Modal removed - details now show in left side panel */}
    </div>
  );
};

export default Index;


