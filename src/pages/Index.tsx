import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PredictionNodeData } from "@/components/PredictionNode";
import { PredictionBubbleField } from "@/components/PredictionBubbleField";
import { PerformanceChart } from "@/components/PerformanceChart";
import { SystemStatusBar } from "@/components/SystemStatusBar";
import { ActivePositions } from "@/components/ActivePositions";
import { MarketDetailsModal } from "@/components/MarketDetailsModal";
import { MarketDetailsPanel } from "@/components/MarketDetailsPanel";
import { AISummaryPanel } from "@/components/AISummaryPanel";
import { NewsFeed } from "@/components/NewsFeed";
import { Waitlist } from "@/components/Waitlist";
import { getOrCreateWallet, getCustodialWallet, storeCustodialWallet } from "@/lib/wallet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
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
  // Track if performance panel was auto-opened from a bubble click (when both panels were closed)
  const performancePanelAutoOpenedRef = useRef(false);
  const [marketModalOpen, setMarketModalOpen] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionNodeData | null>(null);
  // Removed zoom/pan - bubbles now fill full screen and can only be dragged individually
  const [selectedCategory, setSelectedCategory] = useState<string>("All Markets");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>("");
  const [predictions, setPredictions] = useState<PredictionNodeData[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [bubbleLimit, setBubbleLimit] = useState<number>(100);
  
  // Debounce search query to prevent glitching during typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 200); // 200ms delay after user stops typing - faster response
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
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
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [custodialWallet, setCustodialWallet] = useState<{ publicKey: string; privateKey: string } | null>(null);
  // Panel visibility state - both open by default
  const [isPerformanceOpen, setIsPerformanceOpen] = useState(true);
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);
  // Track if we're transitioning for animations
  const [isTransitioning, setIsTransitioning] = useState(false);
  // isResizing no longer needed - panels are overlays, dashboard never resizes
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
  // Middle panel size - no longer needed (dashboard is always 100%)

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
        // Request markets with reasonable limit for performance
        // Search is handled client-side only to prevent glitching on every keystroke
        const { API_BASE_URL } = await import('@/lib/apiConfig');
        const apiUrl = `${API_BASE_URL}/api/predictions?category=${encodeURIComponent(selectedCategory)}&limit=5000`;
        const response = await fetch(apiUrl, {
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

    // Auto-refresh markets and prices every 5 minutes (server caches for 5 minutes)
    const refreshInterval = setInterval(() => {
      loadPredictions();
    }, 5 * 60 * 1000); // 5 minutes (matches server cache)

    return () => clearInterval(refreshInterval);
  }, [selectedCategory]); // Only refetch when category changes - search is client-side only

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

  // Track if we're currently transitioning to prevent unwanted panel opens
  const isTransitioningRef = useRef(false);
  const bubbleClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleBubbleClick = (prediction: PredictionNodeData) => {
    // CRITICAL: Clear any pending click timeout
    if (bubbleClickTimeoutRef.current) {
      clearTimeout(bubbleClickTimeoutRef.current);
      bubbleClickTimeoutRef.current = null;
    }
    
    // CRITICAL: Don't open panel if we're transitioning - prevents glitching
    if (isTransitioningRef.current || isTransitioning) {
      return;
    }
    
    // CRITICAL: Add a small delay to ensure this wasn't triggered by a drag
    // This prevents the panel from opening when dragging bubbles
    bubbleClickTimeoutRef.current = setTimeout(() => {
      // Double-check we're still not transitioning
      if (isTransitioningRef.current || isTransitioning) {
        return;
      }
      
      setSelectedPrediction(prediction);
      // Show in side panel instead of modal
      // Ensure performance panel is open to show the details
      // CRITICAL: Only open if it's a genuine click, not after a drag
      if (!isPerformanceOpen) {
        // CRITICAL: Mark that panel was auto-opened from bubble click
        performancePanelAutoOpenedRef.current = true;
        
        // CRITICAL: Set transition state to prevent bubble layout recalculation
        setIsTransitioning(true);
        isTransitioningRef.current = true;
        
        // CRITICAL: Set panel size to default (30%) when opening from bubble click
        // This ensures the panel opens at the correct size, not smaller
        const defaultSize = 30;
        setIsPerformanceOpen(true);
        setLeftPanelSize(defaultSize);
        setSavedLeftPanelSize(defaultSize);
        // Update localStorage
        localStorage.setItem('savedLeftPanelSize', '30');
        localStorage.removeItem('react-resizable-panels:panel-layout');
        // Dashboard stays 100% - no size updates needed
        
        // Clear transition state after animation completes
        setTimeout(() => {
          setIsTransitioning(false);
          isTransitioningRef.current = false;
        }, 200);
      } else {
        // Panel was already open (manually opened), so don't mark as auto-opened
        performancePanelAutoOpenedRef.current = false;
      }
      bubbleClickTimeoutRef.current = null;
    }, 100); // Longer delay to catch drag events
  };

  const handleCloseMarketDetails = () => {
    setSelectedPrediction(null);
    setSelectedNode(null);
    // CRITICAL: If performance panel was auto-opened from a bubble click (when both panels were closed),
    // close it when user clicks X to return to dashboard view
    if (isPerformanceOpen && performancePanelAutoOpenedRef.current) {
      // Reset the auto-opened flag
      performancePanelAutoOpenedRef.current = false;
      
      // Set transition state to prevent bubble layout recalculation
      setIsTransitioning(true);
      isTransitioningRef.current = true;
      
      // Close the performance panel
      setIsPerformanceOpen(false);
      setLeftPanelSize(0);
      setSavedLeftPanelSize(0);
      
      // Dashboard stays 100% - no size updates needed
      
      // Clear transition state after animation completes
      setTimeout(() => {
        setIsTransitioning(false);
        isTransitioningRef.current = false;
      }, 200);
    }
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
    
    // Apply search query filter - search across multiple fields (use debounced query)
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      const queryWords = query.split(/\s+/).filter(w => w.length > 0); // Split into words for better matching
      
      filtered = filtered.filter(prediction => {
        const question = (prediction.question || '').toLowerCase();
        const category = (prediction.category || '').toLowerCase();
        const agentName = (prediction.agentName || '').toLowerCase();
        const id = (prediction.id || '').toLowerCase();
        const marketSlug = (prediction.marketSlug || '').toLowerCase();
        
        // Check if all query words appear in any field (AND logic for multi-word searches)
        // For single word, match if it appears in any field
        return queryWords.every(word => 
          question.includes(word) ||
          category.includes(word) ||
          agentName.includes(word) ||
          id.includes(word) ||
          marketSlug.includes(word)
        );
      });
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
  }, [predictions, debouncedSearchQuery, filters]);

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
      // First, try to get stored custodial wallet directly
      let wallet = getCustodialWallet();
      
      // If no custodial wallet, check if user is logged in and create/get one
      if (!wallet) {
      const storedEmail = localStorage.getItem('userEmail');
      const storedWallet = localStorage.getItem('walletAddress');
      if (storedEmail || storedWallet) {
        const userId = storedEmail || storedWallet || 'default';
          wallet = getOrCreateWallet(userId);
          // Store it as the main custodial wallet
          storeCustodialWallet(wallet);
        }
      }
      
      if (wallet) {
        setCustodialWallet({
          publicKey: wallet.publicKey,
          privateKey: wallet.privateKey,
        });
      } else {
        setCustodialWallet(null);
      }
    };
    checkWallet();
    // Check periodically - reduced frequency to prevent performance issues
    const interval = setInterval(checkWallet, 5000);
    return () => clearInterval(interval);
  }, []);

  // Panels are now overlays - dashboard never changes size, no resize logic needed


  const handleTogglePerformance = () => {
    const newState = !isPerformanceOpen;
    // CRITICAL: Reset auto-opened flag when manually toggling
    performancePanelAutoOpenedRef.current = false;
    
    setIsTransitioning(true);
    isTransitioningRef.current = true; // Set ref to prevent bubble clicks from opening panel
    setIsPerformanceOpen(newState);
    if (newState) {
      // Opening Performance - always restore to default size (30%)
      const defaultSize = 30;
      setLeftPanelSize(defaultSize);
      setSavedLeftPanelSize(defaultSize);
      // Update localStorage immediately to override any saved values
      localStorage.setItem('savedLeftPanelSize', '30');
      // Clear react-resizable-panels localStorage to prevent interference
      localStorage.removeItem('react-resizable-panels:panel-layout');
        // Dashboard stays 100% - no size updates needed
      // DO NOT touch Summary refs - keep panels independent
    } else {
      // Closing Performance - collapse to 0
      setLeftPanelSize(0);
      // Dashboard stays 100% - no size updates needed
      // DO NOT touch Summary refs - keep panels independent
    }
    // Clear transitioning state after animation completes - faster transition
    setTimeout(() => {
      setIsTransitioning(false);
      isTransitioningRef.current = false; // Clear ref after transition
    }, 150); // Faster transition - 150ms for better responsiveness
  };

  const handleToggleSummary = () => {
    setIsTransitioning(true);
    // If Summary is already showing (and no other view is active), close the panel
    if (isSummaryOpen && !showNewsFeed && !showWaitlist) {
      setIsSummaryOpen(false);
      setRightPanelSize(0);
      // Dashboard stays 100% - no size updates needed
      setTimeout(() => {
        setIsTransitioning(false);
        isTransitioningRef.current = false;
      }, 150); // Faster transition for better responsiveness
      return;
    }
    
    // Opening Summary - switch to Summary view (close other views)
    setShowNewsFeed(false);
    setShowWaitlist(false);
    setIsSummaryOpen(true);
    const defaultSize = 30;
    setRightPanelSize(defaultSize);
    setSavedRightPanelSize(defaultSize);
    localStorage.setItem('savedRightPanelSize', '30');
    localStorage.removeItem('react-resizable-panels:panel-layout');
    // Dashboard stays 100% - no size updates needed
      setTimeout(() => {
        setIsTransitioning(false);
        isTransitioningRef.current = false;
      }, 150); // Faster transition for better responsiveness
  };

  const handleToggleWaitlist = () => {
    setIsTransitioning(true);
    // If Waitlist is already showing, close the panel
    if (showWaitlist && isSummaryOpen && !showNewsFeed) {
      setShowWaitlist(false);
      setIsSummaryOpen(false);
      setRightPanelSize(0);
      // Dashboard stays 100% - no size updates needed
      setTimeout(() => {
        setIsTransitioning(false);
        isTransitioningRef.current = false;
      }, 150); // Faster transition for better responsiveness
      return;
    }
    
    // Opening Waitlist - switch to Waitlist view (close other views)
    setShowNewsFeed(false);
    setShowWaitlist(true);
    setIsSummaryOpen(true); // Always open summary panel when showing waitlist
    const defaultSize = 30;
    setRightPanelSize(defaultSize);
    setSavedRightPanelSize(defaultSize);
    localStorage.setItem('savedRightPanelSize', '30');
    localStorage.removeItem('react-resizable-panels:panel-layout');
    // Dashboard stays 100% - no size updates needed
      setTimeout(() => {
        setIsTransitioning(false);
        isTransitioningRef.current = false;
      }, 150); // Faster transition for better responsiveness
  };

  const handleToggleNewsFeed = () => {
    setIsTransitioning(true);
    // If News Feed is already showing and panel is open, close it
    if (showNewsFeed && isSummaryOpen) {
      setIsSummaryOpen(false);
      setShowNewsFeed(false);
      setShowWaitlist(false);
      setRightPanelSize(0);
      // Dashboard stays 100% - no size updates needed
      setTimeout(() => {
        setIsTransitioning(false);
        isTransitioningRef.current = false;
      }, 150); // Faster transition for better responsiveness
      return;
    }
    
    // Opening News Feed - switch to News Feed view (close other views)
    setShowNewsFeed(true);
    setShowWaitlist(false);
    setIsSummaryOpen(true); // Always open summary panel when showing news feed
    const defaultSize = 30;
    setRightPanelSize(defaultSize);
    setSavedRightPanelSize(defaultSize);
    localStorage.setItem('savedRightPanelSize', '30');
    localStorage.removeItem('react-resizable-panels:panel-layout');
    // Dashboard stays 100% - no size updates needed
      setTimeout(() => {
        setIsTransitioning(false);
        isTransitioningRef.current = false;
      }, 150); // Faster transition for better responsiveness
  };

  return (
    <div className="h-screen w-full bg-background flex flex-col overflow-hidden">
      {/* Global styles for smooth panel transitions */}
      <style>{`
        [data-panel-id] {
          transition: ${isTransitioning ? 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'} !important;
        }
        [data-panel-group] {
          transition: ${isTransitioning ? 'none' : 'none'} !important;
        }
      `}</style>
      {/* Top Status Bar */}
      <SystemStatusBar 
        onToggleWaitlist={handleToggleWaitlist}
        onTogglePerformance={handleTogglePerformance}
        onToggleSummary={handleToggleSummary}
        onToggleNewsFeed={handleToggleNewsFeed}
        isPerformanceOpen={isPerformanceOpen}
        isSummaryOpen={isSummaryOpen}
        showNewsFeed={showNewsFeed}
        showWaitlist={showWaitlist}
      />

      {/* Main Content Area - Dashboard is always 100% width/height */}
      <div className="flex-1 flex overflow-hidden w-full relative" style={{ margin: 0, padding: 0 }}>
        {/* Dashboard - Always full width/height, never changes */}
        <div 
          className="flex-1 flex flex-col w-full h-full relative"
          style={{ 
            width: '100%',
            height: '100%',
              position: 'relative', 
              margin: 0, 
            padding: 0,
            }}
          >
          {/* Market Category Dropdown - EDGE TO EDGE - NO MARGINS OR PADDING ON CONTAINER */}
          <div className="border-b border-border flex flex-col bg-bg-elevated" style={{ width: '100%', margin: 0, padding: 0, marginLeft: 0, marginRight: 0 }}>
            <div className="h-10 flex items-center justify-center px-4">
              <div className="flex items-center gap-3">
              <span className="text-xs text-terminal-accent font-mono leading-none flex items-center">
                &gt; DASHBOARD
                {loadingMarkets && <span className="ml-2 text-[10px] text-muted-foreground">(Loading markets...)</span>}
              </span>
              <div className="flex items-center gap-3">
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="flex items-center gap-1.5 px-2.5 py-1 h-8 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                      <Filter className="h-3.5 w-3.5" />
                      <span>Filters</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="start" 
                    className="w-[320px] max-h-[85vh] overflow-y-auto p-2"
                    onCloseAutoFocus={(e) => e.preventDefault()}
                  >
                    <div className="space-y-2">
                      {/* Volume Filters */}
                          <div className="space-y-1">
                        <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Volume</Label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <Input
                              type="number"
                              placeholder="Min $"
                              value={filters.minVolume}
                              onChange={(e) => setFilters({...filters, minVolume: e.target.value})}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div>
                            <Input
                              type="number"
                              placeholder="Max $"
                              value={filters.maxVolume}
                              onChange={(e) => setFilters({...filters, maxVolume: e.target.value})}
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Liquidity Filters */}
                          <div className="space-y-1">
                        <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Liquidity</Label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <Input
                              type="number"
                              placeholder="Min $"
                              value={filters.minLiquidity}
                              onChange={(e) => setFilters({...filters, minLiquidity: e.target.value})}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div>
                            <Input
                              type="number"
                              placeholder="Max $"
                              value={filters.maxLiquidity}
                              onChange={(e) => setFilters({...filters, maxLiquidity: e.target.value})}
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Price Filters */}
                          <div className="space-y-1">
                        <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Price</Label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="1"
                              placeholder="Min 0.00"
                              value={filters.minPrice}
                              onChange={(e) => setFilters({...filters, minPrice: e.target.value})}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="1"
                              placeholder="Max 1.00"
                              value={filters.maxPrice}
                              onChange={(e) => setFilters({...filters, maxPrice: e.target.value})}
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Probability Filters */}
                          <div className="space-y-1">
                        <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Probability</Label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <Input
                              type="number"
                              step="1"
                              min="0"
                              max="100"
                              placeholder="Min %"
                              value={filters.minProbability}
                              onChange={(e) => setFilters({...filters, minProbability: e.target.value})}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div>
                            <Input
                              type="number"
                              step="1"
                              min="0"
                              max="100"
                              placeholder="Max %"
                              value={filters.maxProbability}
                              onChange={(e) => setFilters({...filters, maxProbability: e.target.value})}
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Sort Options */}
                          <div className="space-y-1">
                        <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Sort</Label>
                        <div className="grid grid-cols-2 gap-1.5">
                            <Select
                              value={filters.sortBy}
                              onValueChange={(value: any) => setFilters({...filters, sortBy: value})}
                            >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Field" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="volume">Volume</SelectItem>
                                <SelectItem value="liquidity">Liquidity</SelectItem>
                                <SelectItem value="price">Price</SelectItem>
                                <SelectItem value="probability">Probability</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select
                              value={filters.sortOrder}
                              onValueChange={(value: any) => setFilters({...filters, sortOrder: value})}
                            >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Order" />
                              </SelectTrigger>
                              <SelectContent>
                              <SelectItem value="desc">Desc</SelectItem>
                              <SelectItem value="asc">Asc</SelectItem>
                              </SelectContent>
                            </Select>
                        </div>
                      </div>
                      
                      {/* Action Button */}
                      <div className="pt-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
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
                          className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Clear
                        </Button>
                      </div>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                {/* Search Bar */}
                <div className="relative max-w-xs w-64">
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
              </div>
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
              willChange: 'auto',
              // OPTIMIZATION: Prevent layout thrashing during resize
              contain: 'layout style paint',
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
            {/* OPTIMIZATION: Disable interactions during resize but keep bubbles visible */}
            <div 
              style={{ 
                width: '100%',
                height: '100%',
                pointerEvents: 'auto',
                willChange: 'auto',
              }}
            >
              <PredictionBubbleField
                markets={limitedPredictions}
                onBubbleClick={(market) => handleBubbleClick(market)}
                selectedNodeId={selectedNode}
                selectedAgent={selectedAgent}
                agents={mockAgents}
                isTransitioning={isTransitioning}
                isResizing={false}
              />
            </div>
          </div>
        </div>

        {/* LEFT: Performance Chart - Overlay */}
        {isPerformanceOpen && (
          <ResizablePanelGroup
            direction="horizontal"
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 10 }}
          >
          <ResizablePanel 
              defaultSize={leftPanelSize}
            minSize={15} 
            maxSize={30} 
              onResize={(size) => {
                setLeftPanelSize(size);
                setSavedLeftPanelSize(size);
              }}
              className="border-r border-border bg-background pointer-events-auto"
            style={{
                boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
              }}
            >
              {selectedPrediction ? (
                <MarketDetailsPanel
                  market={selectedPrediction}
                  onClose={handleCloseMarketDetails}
                />
              ) : (
                <PerformanceChart 
                  predictions={predictions}
                  selectedMarketId={selectedNode}
                />
              )}
            </ResizablePanel>
            <ResizableHandle withHandle style={{ pointerEvents: 'auto', zIndex: 50 }} />
            <ResizablePanel defaultSize={100 - leftPanelSize} minSize={70} maxSize={85} style={{ pointerEvents: 'none' }} />
          </ResizablePanelGroup>
        )}

        {/* RIGHT: AI Summary Panel - Overlay */}
        {isSummaryOpen && (
          <ResizablePanelGroup
            direction="horizontal"
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 10 }}
          >
            <ResizablePanel defaultSize={100 - rightPanelSize} minSize={70} maxSize={85} style={{ pointerEvents: 'none' }} />
            <ResizableHandle withHandle style={{ pointerEvents: 'auto', zIndex: 50 }} />
            <ResizablePanel
              defaultSize={rightPanelSize}
              minSize={15}
              maxSize={30}
              onResize={(size) => {
                setRightPanelSize(size);
                setSavedRightPanelSize(size);
                  }}
              className="border-l border-border bg-background pointer-events-auto"
                  style={{
                boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
                  }}
                >
                  {showWaitlist ? (
                    <Waitlist />
                  ) : showNewsFeed ? (
                    <NewsFeed />
                  ) : (
                    <AISummaryPanel />
                  )}
          </ResizablePanel>
        </ResizablePanelGroup>
        )}
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


