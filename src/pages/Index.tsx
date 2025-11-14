import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AIAvatar } from "@/components/AIAvatar";
import { PredictionBubble, Prediction } from "@/components/PredictionBubble";
import { TradeDashboard, TradeHistory } from "@/components/TradeDashboard";
import { LiveFeedBar } from "@/components/LiveFeedBar";
import { NeuralConnection } from "@/components/NeuralConnection";
import { BarChart3 } from "lucide-react";

const mockPredictions: Prediction[] = [
  {
    id: "1",
    question: "Will Thunderbolts be the top grossing movie of 2025?",
    confidence: 93,
    position: "NO",
    price: 0.004,
    change: -2.5,
    reasoning: "The analysis begins with historical patterns in movie gross earnings, focusing primarily on the genre, competition, and market trends. Superhero and major franchise films have historically performed well at the box office, suggesting a potentially strong showing for 'Thunderbolts' given its Marvel brand.",
    volume24h: 4400,
    timestamp: "7D AGO",
  },
  {
    id: "2",
    question: "Will Trump win the 2024 election?",
    confidence: 67,
    position: "YES",
    price: 0.67,
    change: 3.2,
    reasoning: "Based on current polling data, historical election patterns, and demographic trends, there's a moderate-to-high probability of success. However, the race remains competitive with several swing states in play.",
    volume24h: 125000,
    timestamp: "2H AGO",
  },
  {
    id: "3",
    question: "Is ETH above $3,500 by December?",
    confidence: 72,
    position: "YES",
    price: 0.72,
    change: 5.8,
    reasoning: "Market momentum indicators show strong bullish signals. On-chain metrics demonstrate increasing network activity and institutional adoption patterns similar to previous bull cycles.",
    volume24h: 89000,
    timestamp: "1H AGO",
  },
  {
    id: "4",
    question: "Will SBF get >20 years in prison?",
    confidence: 88,
    position: "YES",
    price: 0.88,
    change: 1.2,
    reasoning: "Legal precedent for financial fraud cases of this magnitude, combined with the scale of victim impact and absence of remorse, strongly suggests a lengthy sentence exceeding 20 years.",
    volume24h: 34000,
    timestamp: "5D AGO",
  },
  {
    id: "5",
    question: "Will AI surpass human intelligence by 2030?",
    confidence: 45,
    position: "NO",
    price: 0.55,
    change: -1.8,
    reasoning: "While AI capabilities are advancing rapidly, achieving artificial general intelligence (AGI) that truly surpasses human intelligence across all domains faces significant technical and theoretical hurdles unlikely to be resolved in this timeframe.",
    volume24h: 67000,
    timestamp: "12H AGO",
  },
];

const mockTrades: TradeHistory[] = [
  {
    id: "t1",
    question: "Will Thunderbolts be the top grossing movie of 2025?",
    position: "NO",
    buyPrice: 0.006,
    currentPrice: 0.004,
    profitLoss: 40.0,
    timestamp: "7D AGO",
    confidence: 93,
  },
  {
    id: "t2",
    question: "Will Trump win the 2024 election?",
    position: "YES",
    buyPrice: 0.64,
    currentPrice: 0.67,
    profitLoss: 12.5,
    timestamp: "2D AGO",
    confidence: 67,
  },
  {
    id: "t3",
    question: "Is ETH above $3,500 by December?",
    position: "YES",
    buyPrice: 0.68,
    currentPrice: 0.72,
    profitLoss: 18.8,
    timestamp: "1D AGO",
    confidence: 72,
  },
];

const feedItems = [
  { id: "f1", text: "AI executed trade: YES on Trump 2024 at $0.67", type: "live" as const },
  { id: "f2", text: "New prediction: ETH price target $3,500", type: "live" as const },
  { id: "f3", text: "Market update: Thunderbolts confidence drops to 93%", type: "completed" as const },
  { id: "f4", text: "AI analyzing: SBF sentencing outcomes", type: "live" as const },
];

const Index = () => {
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [aiActive, setAiActive] = useState(false);
  const [activeConnection, setActiveConnection] = useState<{ start: { x: number; y: number }, end: { x: number; y: number } } | null>(null);

  useEffect(() => {
    // Simulate AI trading activity
    const interval = setInterval(() => {
      setAiActive(true);
      
      // Pick a random prediction bubble position
      const randomX = Math.random() * (window.innerWidth - 300) + 150;
      const randomY = Math.random() * (window.innerHeight - 300) + 150;
      
      setActiveConnection({
        start: { x: 100, y: window.innerHeight - 100 },
        end: { x: randomX + 130, y: randomY + 130 }
      });

      setTimeout(() => {
        setAiActive(false);
        setActiveConnection(null);
      }, 1500);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen w-full bg-background overflow-hidden">
      {/* Live feed bar */}
      <LiveFeedBar items={feedItems} />

      {/* Main content area */}
      <div className="pt-16 h-screen relative">
        {/* Background grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:40px_40px] opacity-20" />

        {/* Prediction bubbles */}
        <div className="relative w-full h-full">
          <PredictionBubble
            prediction={mockPredictions[0]}
            position={{ x: 200, y: 150 }}
          />
          <PredictionBubble
            prediction={mockPredictions[1]}
            position={{ x: 600, y: 250 }}
          />
          <PredictionBubble
            prediction={mockPredictions[2]}
            position={{ x: 1000, y: 180 }}
          />
          <PredictionBubble
            prediction={mockPredictions[3]}
            position={{ x: 350, y: 450 }}
          />
          <PredictionBubble
            prediction={mockPredictions[4]}
            position={{ x: 850, y: 500 }}
          />
        </div>

        {/* Neural connection lines */}
        {activeConnection && (
          <NeuralConnection
            startPos={activeConnection.start}
            endPos={activeConnection.end}
            isActive={true}
          />
        )}

        {/* AI Avatar */}
        <AIAvatar isActive={aiActive} />

        {/* Dashboard toggle button */}
        <motion.button
          onClick={() => setDashboardOpen(!dashboardOpen)}
          className="fixed top-24 right-6 w-12 h-12 rounded-full bg-card border-2 border-accent/40 shadow-glow flex items-center justify-center hover:bg-accent/10 transition-colors z-40"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <BarChart3 className="w-5 h-5 text-accent" />
        </motion.button>

        {/* Trade Dashboard */}
        <TradeDashboard
          isOpen={dashboardOpen}
          onClose={() => setDashboardOpen(false)}
          trades={mockTrades}
        />

        {/* Instructions overlay */}
        <motion.div
          className="fixed bottom-8 right-8 max-w-xs bg-card/80 backdrop-blur-lg border border-border rounded-xl p-4 shadow-soft"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <h3 className="font-bold text-sm mb-2">Interactive Predictions</h3>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Drag bubbles to rearrange</li>
            <li>• Hover for AI reasoning</li>
            <li>• Watch neural connections</li>
            <li>• Open dashboard for history</li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
