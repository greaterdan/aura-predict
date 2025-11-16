import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { 
  Play, Square, X, Plus, 
  Zap, DollarSign, ChevronRight, ChevronLeft,
  Copy, GripVertical
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AgentBuilderProps {
  walletAddress: string;
  privateKey: string;
  onDeploy?: () => void;
}

type AgentStatus = "IDLE" | "TESTING" | "LIVE";
type Objective = "Market maker" | "Trend follower" | "Event trader";
type Model = "GROK" | "OPENAI" | "DEEPSEEK" | "GEMINI";
type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
type RuleType = "SIGNAL" | "ENTRY" | "EXIT" | "COPY_TRADE";

interface StrategyRule {
  id: string;
  type: RuleType;
  config: Record<string, any>;
}

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
}

interface Trade {
  id: string;
  time: string;
  market: string;
  side: "YES" | "NO";
  size: number;
  price: number;
  pnl: number;
}

interface LibraryAgent {
  id: string;
  name: string;
  model: Model;
  status: AgentStatus;
  pnl24h: number;
  avatar: string;
}

export const AgentBuilder = ({ walletAddress, privateKey, onDeploy }: AgentBuilderProps) => {
  const { toast } = useToast();
  
  // Header state
  const [agentName, setAgentName] = useState("");
  const [status, setStatus] = useState<AgentStatus>("IDLE");
  const [pnl, setPnl] = useState(0);
  const [marketCount, setMarketCount] = useState(0);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  
  // Step 1: Basics
  const [objective, setObjective] = useState<Objective>("Trend follower");
  const [model, setModel] = useState<Model>("GROK");
  const [description, setDescription] = useState("");
  
  // Step 2: Strategy
  const [strategyRules, setStrategyRules] = useState<StrategyRule[]>([
    { id: "1", type: "SIGNAL", config: { source: "Polymarket", query: "" } },
    { id: "2", type: "ENTRY", config: { threshold: 70 } },
    { id: "3", type: "EXIT", config: { takeProfit: 30, stopLoss: 10 } },
  ]);
  const [draggedAgent, setDraggedAgent] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  // Step 3: Risk & Capital
  const [initialCapital, setInitialCapital] = useState("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("MEDIUM");
  
  // Terminal state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [activeTab, setActiveTab] = useState<"LOGS" | "TRADES" | "POSITIONS">("LOGS");
  const [openPositions, setOpenPositions] = useState(0);
  const [exposure, setExposure] = useState(0);
  
  // Library agents
  const [libraryAgents] = useState<LibraryAgent[]>([
    { id: "1", name: "GROK-4", model: "GROK", status: "LIVE", pnl24h: 12.4, avatar: "/grok.png" },
    { id: "2", name: "GPT-5", model: "OPENAI", status: "LIVE", pnl24h: -8.3, avatar: "/GPT.png" },
    { id: "3", name: "DEEPSEEK", model: "DEEPSEEK", status: "TESTING", pnl24h: 16.2, avatar: "/Deepseek-logo-icon.svg" },
    { id: "4", name: "GEMINI", model: "GEMINI", status: "IDLE", pnl24h: -3.1, avatar: "/GEMENI.png" },
  ]);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const deploymentCost = 0.1;
  
  // Generate logs when testing
  useEffect(() => {
    if (status === "TESTING" || status === "LIVE") {
      const interval = setInterval(() => {
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        
        const logMessages = [
          `Evaluated ${Math.floor(Math.random() * 50) + 20} markets`,
          `Found trade: YES on ETH > $3500 @ 0.${Math.floor(Math.random() * 30) + 60}`,
          `Analyzing market: "Trump 2024 election"`,
          `Signal strength: ${Math.floor(Math.random() * 30) + 60}%`,
          `Position opened: 1.2 SOL on market #${Math.floor(Math.random() * 100)}`,
        ];
        
        const newLog: LogEntry = {
          id: Date.now().toString(),
          timestamp: timeStr,
          message: logMessages[Math.floor(Math.random() * logMessages.length)],
        };
        
        setLogs(prev => [...prev.slice(-49), newLog]);
        
        if (Math.random() > 0.7) {
          const newTrade: Trade = {
            id: Date.now().toString(),
            time: timeStr,
            market: `Market ${Math.floor(Math.random() * 100)}`,
            side: Math.random() > 0.5 ? "YES" : "NO",
            size: Math.random() * 5 + 0.5,
            price: Math.random() * 0.4 + 0.5,
            pnl: (Math.random() - 0.4) * 10,
          };
          setTrades(prev => [...prev.slice(-19), newTrade]);
          setMarketCount(prev => prev + 1);
          setOpenPositions(prev => prev + 1);
          setExposure(prev => prev + newTrade.size);
        }
      }, 2000 / simulationSpeed);
      
      return () => clearInterval(interval);
    }
  }, [status, simulationSpeed]);
  
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);
  
  const handleRunTest = () => {
    setStatus("TESTING");
    setLogs([]);
    setTrades([]);
    setPnl(0);
    setMarketCount(0);
    setOpenPositions(0);
    setExposure(0);
    toast({ title: "Test started", description: "Simulating agent behavior..." });
  };

  const handleDeploy = async () => {
    if (!agentName.trim()) {
      toast({ title: "Error", description: "Please enter an agent name", variant: "destructive" });
      return;
    }
    if (!initialCapital || parseFloat(initialCapital) <= 0) {
      toast({ title: "Error", description: "Please enter valid initial capital", variant: "destructive" });
      return;
    }

    setStatus("LIVE");
    toast({ title: "Agent Deployed!", description: `${agentName} is now live` });
    onDeploy?.();
  };
  
  const handleStop = () => {
    setStatus("IDLE");
    toast({ title: "Stopped", description: "Agent stopped" });
  };
  
  const handleAddRule = (type: RuleType) => {
    const newRule: StrategyRule = {
      id: Date.now().toString(),
      type,
      config: type === "SIGNAL" ? { source: "Polymarket", query: "" } :
              type === "ENTRY" ? { threshold: 70 } :
              type === "EXIT" ? { takeProfit: 30, stopLoss: 10 } :
              { agentId: "", agentName: "", mirror: false },
    };
    setStrategyRules(prev => [...prev, newRule]);
  };
  
  const handleDeleteRule = (id: string) => {
    setStrategyRules(prev => prev.filter(r => r.id !== id));
  };
  
  const handleLoadTemplate = (template: string) => {
    if (template === "Momentum") {
      setStrategyRules([
        { id: "1", type: "SIGNAL", config: { source: "Polymarket", query: "" } },
        { id: "2", type: "ENTRY", config: { threshold: 60 } },
        { id: "3", type: "EXIT", config: { takeProfit: 25, stopLoss: 15 } },
      ]);
    } else if (template === "Mean reversion") {
      setStrategyRules([
        { id: "1", type: "SIGNAL", config: { source: "Polymarket", query: "" } },
        { id: "2", type: "ENTRY", config: { threshold: 40 } },
        { id: "3", type: "EXIT", config: { takeProfit: 20, stopLoss: 10 } },
      ]);
    } else if (template === "Event trader") {
      setStrategyRules([
        { id: "1", type: "SIGNAL", config: { source: "News", query: "" } },
        { id: "2", type: "ENTRY", config: { threshold: 55 } },
        { id: "3", type: "EXIT", config: { takeProfit: 35, stopLoss: 12 } },
      ]);
    }
    toast({ title: "Template loaded", description: `${template} strategy applied` });
  };
  
  const handleDragStart = (agentId: string) => {
    setDraggedAgent(agentId);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };
  
  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (draggedAgent) {
      const agent = libraryAgents.find(a => a.id === draggedAgent);
      if (agent) {
        handleAddRule("COPY_TRADE");
        const newRule = strategyRules[strategyRules.length - 1];
        if (newRule) {
          setStrategyRules(prev => prev.map(r => 
            r.id === newRule.id ? { ...r, config: { ...r.config, agentId: agent.id, agentName: agent.name } } : r
          ));
        }
      }
      setDraggedAgent(null);
    }
  };
  
  const getStatusColor = (status: AgentStatus) => {
    switch (status) {
      case "IDLE": return "bg-zinc-700/50 text-zinc-400 border-zinc-700/50";
      case "TESTING": return "bg-cyan-500/20 text-cyan-400 border-cyan-500/40";
      case "LIVE": return "bg-trade-yes/20 text-trade-yes border-trade-yes/40";
    }
  };
  
  const getRiskSettings = () => {
    switch (riskLevel) {
      case "LOW": return { maxPosition: "0.5%", maxMarkets: 3, dailyLoss: "3%" };
      case "MEDIUM": return { maxPosition: "1.0%", maxMarkets: 5, dailyLoss: "5%" };
      case "HIGH": return { maxPosition: "2.0%", maxMarkets: 8, dailyLoss: "10%" };
    }
  };
  
  const isStrategyComplete = strategyRules.length > 0 && initialCapital && parseFloat(initialCapital) > 0;

  return (
    <div className="bg-[#050609] text-zinc-100 min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800/60">
          <div className="flex items-center gap-4 flex-1">
            <span className="text-sm text-zinc-400 font-mono">{" > Agent Builder"}</span>
            <Input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Give your agent a name…"
              className="max-w-md text-base bg-zinc-900/50 border-zinc-800/60 rounded-lg h-10"
            />
      </div>

          <div className="flex items-center gap-4">
            <Badge className={`text-xs font-medium px-3 py-1 border ${getStatusColor(status)}`}>
              {status}
            </Badge>
            
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span>P&L <span className={pnl >= 0 ? "text-trade-yes" : "text-trade-no"}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}%</span></span>
              <span>Markets {marketCount}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRunTest}
                disabled={status !== "IDLE"}
                className="h-9 px-4 text-sm hover:bg-zinc-800/50"
              >
                <Play className="w-4 h-4 mr-1.5" />
                Run Test
              </Button>
              <Button
                size="sm"
                onClick={handleDeploy}
                disabled={status !== "IDLE" || !agentName || !initialCapital}
                className="h-9 px-4 text-sm bg-[#f6c86a] hover:bg-[#f6c86a]/90 text-black"
              >
                <Zap className="w-4 h-4 mr-1.5" />
                Deploy Live
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStop}
                disabled={status === "IDLE"}
                className="h-9 px-4 text-sm border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                <Square className="w-4 h-4 mr-1.5" />
                Stop
              </Button>
            </div>
          </div>
            </div>

        {/* MAIN GRID */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          {/* LEFT: BUILDER */}
          <div className="rounded-2xl bg-[#080b12] border border-zinc-800/60 p-6 flex flex-col gap-6">
            {/* STEPPER */}
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center flex-1">
                  <button
                    onClick={() => setCurrentStep(step as 1 | 2 | 3)}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentStep === step
                        ? "bg-[#f6c86a] text-black"
                        : "bg-zinc-900/50 border border-zinc-800/60 text-zinc-400 hover:bg-zinc-800/50"
                    }`}
                  >
                    {step === 1 && "Basics"}
                    {step === 2 && "Strategy"}
                    {step === 3 && "Risk & Capital"}
                  </button>
                  {step < 3 && (
                    <ChevronRight className="w-4 h-4 text-zinc-600 mx-1" />
                  )}
                </div>
              ))}
            </div>

            {/* STEP CONTENT */}
            <div className="flex-1">
              {/* STEP 1: BASICS */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <Label className="text-sm font-medium text-zinc-200 mb-3 block">Objective</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {(["Market maker", "Trend follower", "Event trader"] as Objective[]).map((obj) => (
                        <button
                          key={obj}
                          onClick={() => setObjective(obj)}
                          className={`p-4 rounded-lg border text-left transition-colors ${
                            objective === obj
                              ? "bg-[#f6c86a]/20 border-[#f6c86a]/60 text-[#f6c86a]"
                              : "bg-zinc-900/30 border-zinc-800/60 text-zinc-300 hover:border-zinc-700"
                          }`}
                        >
                          <div className="font-medium text-sm mb-1">{obj}</div>
                          <div className="text-xs text-zinc-400">
                            {obj === "Market maker" && "Provide liquidity and earn spread"}
                            {obj === "Trend follower" && "Ride strong price moves"}
                            {obj === "Event trader" && "Trade news & events odds"}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-zinc-200 mb-2 block">
                      Which AI model should think for this agent?
              </Label>
                    <Select value={model} onValueChange={(v) => setModel(v as Model)}>
                      <SelectTrigger className="bg-zinc-900/50 border-zinc-800/60 rounded-lg h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GROK">GROK</SelectItem>
                        <SelectItem value="OPENAI">OPENAI</SelectItem>
                        <SelectItem value="DEEPSEEK">DEEPSEEK</SelectItem>
                        <SelectItem value="GEMINI">GEMINI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-zinc-200 mb-2 block">Description</Label>
              <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what this agent should try to do in plain language…"
                      className="bg-zinc-900/50 border-zinc-800/60 rounded-lg min-h-[100px] text-sm"
                    />
                    <p className="text-xs text-zinc-400 mt-1">Help the AI understand your agent's purpose</p>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button
                      onClick={() => setCurrentStep(2)}
                      className="bg-[#f6c86a] hover:bg-[#f6c86a]/90 text-black"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
              
              {/* STEP 2: STRATEGY */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <p className="text-sm text-zinc-400">
                    Tell your agent when to trade. You can start from a template or add simple rules.
                  </p>
                  
                  <div className="flex gap-2">
                    {["Momentum", "Mean reversion", "Event trader"].map((template) => (
                      <Button
                        key={template}
                        variant="outline"
                        size="sm"
                        onClick={() => handleLoadTemplate(template)}
                        className="text-xs border-zinc-800/60 bg-zinc-900/30 hover:bg-zinc-800/50"
                      >
                        Load template: {template}
                      </Button>
                    ))}
                  </div>
                  
                  <div
                    className="space-y-3 min-h-[200px]"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    {isDraggingOver && (
                      <div className="border-2 border-dashed border-[#f6c86a]/40 rounded-lg p-6 text-center bg-[#f6c86a]/5">
                        <p className="text-sm text-[#f6c86a]">
                          Drop an agent here to copy its strategy
                        </p>
                      </div>
                    )}
                    
                    {strategyRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="bg-black/30 border border-zinc-800/60 rounded-lg px-4 py-3 flex flex-col gap-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-zinc-200">
                            {rule.type === "SIGNAL" && "Signal rule"}
                            {rule.type === "ENTRY" && "Entry rule"}
                            {rule.type === "EXIT" && "Exit rule"}
                            {rule.type === "COPY_TRADE" && `Copy trades from ${rule.config.agentName || "agent"}`}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="h-6 w-6 p-0 text-zinc-500 hover:text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        {rule.type === "SIGNAL" && (
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs text-zinc-400 mb-1 block">Source</Label>
                              <Select value={rule.config.source} onValueChange={(v) => {
                                setStrategyRules(prev => prev.map(r => 
                                  r.id === rule.id ? { ...r, config: { ...r.config, source: v } } : r
                                ));
                              }}>
                                <SelectTrigger className="bg-zinc-900/50 border-zinc-800/60 h-9 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Polymarket">Polymarket</SelectItem>
                                  <SelectItem value="Kalshi">Kalshi</SelectItem>
                                  <SelectItem value="On-chain">On-chain</SelectItem>
                                  <SelectItem value="Twitter">Twitter</SelectItem>
                                  <SelectItem value="News">News</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-zinc-400 mb-1 block">Only trade events that contain…</Label>
                              <Input
                                value={rule.config.query || ""}
                                onChange={(e) => {
                                  setStrategyRules(prev => prev.map(r => 
                                    r.id === rule.id ? { ...r, config: { ...r.config, query: e.target.value } } : r
                                  ));
                                }}
                                placeholder="e.g., election, crypto, sports"
                                className="bg-zinc-900/50 border-zinc-800/60 h-9 text-sm"
              />
            </div>
                          </div>
                        )}
                        
                        {rule.type === "ENTRY" && (
                          <div>
                            <Label className="text-xs text-zinc-400 mb-2 block">
                              Probability threshold: {rule.config.threshold || 70}%
                            </Label>
                            <Slider
                              value={[rule.config.threshold || 70]}
                              onValueChange={([value]) => {
                                setStrategyRules(prev => prev.map(r => 
                                  r.id === rule.id ? { ...r, config: { ...r.config, threshold: value } } : r
                                ));
                              }}
                              min={50}
                              max={90}
                              step={5}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-zinc-500 mt-1">
                              <span>50%</span>
                              <span>90%</span>
                            </div>
                          </div>
                        )}
                        
                        {rule.type === "EXIT" && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-zinc-400 mb-1 block">Take profit at</Label>
                              <Select value={(rule.config.takeProfit || 30).toString()} onValueChange={(v) => {
                                setStrategyRules(prev => prev.map(r => 
                                  r.id === rule.id ? { ...r, config: { ...r.config, takeProfit: parseInt(v) } } : r
                                ));
                              }}>
                                <SelectTrigger className="bg-zinc-900/50 border-zinc-800/60 h-9 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="20">20%</SelectItem>
                                  <SelectItem value="30">30%</SelectItem>
                                  <SelectItem value="40">40%</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-zinc-400 mb-1 block">Cut loss at</Label>
                              <Select value={(rule.config.stopLoss || 10).toString()} onValueChange={(v) => {
                                setStrategyRules(prev => prev.map(r => 
                                  r.id === rule.id ? { ...r, config: { ...r.config, stopLoss: parseInt(v) } } : r
                                ));
                              }}>
                                <SelectTrigger className="bg-zinc-900/50 border-zinc-800/60 h-9 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="5">5%</SelectItem>
                                  <SelectItem value="10">10%</SelectItem>
                                  <SelectItem value="15">15%</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                        
                        {rule.type === "COPY_TRADE" && (
              <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={rule.config.mirror || false}
                                onChange={(e) => {
                                  setStrategyRules(prev => prev.map(r => 
                                    r.id === rule.id ? { ...r, config: { ...r.config, mirror: e.target.checked } } : r
                                  ));
                                }}
                                className="w-4 h-4 rounded border-zinc-800/60 bg-zinc-900/50"
                              />
                              <Label className="text-xs text-zinc-400">Full mirror</Label>
                            </div>
                            <p className="text-xs text-zinc-400">Otherwise use my risk settings</p>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    <Button
                      variant="outline"
                      onClick={() => {
                        const ruleTypes: RuleType[] = ["SIGNAL", "ENTRY", "EXIT"];
                        const nextType = ruleTypes[strategyRules.length % ruleTypes.length];
                        handleAddRule(nextType);
                      }}
                      className="w-full border-zinc-800/60 bg-zinc-900/30 hover:bg-zinc-800/50"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add rule
                    </Button>
                  </div>
                  
                  <div className="flex justify-between">
                    <Button
                      variant="ghost"
                      onClick={() => setCurrentStep(1)}
                      className="text-zinc-400 hover:text-zinc-200"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                    <Button
                      onClick={() => setCurrentStep(3)}
                      className="bg-[#f6c86a] hover:bg-[#f6c86a]/90 text-black"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
              
              {/* STEP 3: RISK & CAPITAL */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <Label className="text-sm font-medium text-zinc-200 mb-2 block">
                      How much SOL should this agent control?
                </Label>
                    <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(e.target.value)}
                  placeholder="0.00"
                        className="bg-zinc-900/50 border-zinc-800/60 rounded-lg h-11 text-base pr-12"
                      />
                      <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-zinc-200 mb-3 block">Risk level</Label>
                    <div className="flex gap-3">
                      {(["LOW", "MEDIUM", "HIGH"] as RiskLevel[]).map((level) => (
                        <button
                          key={level}
                          onClick={() => setRiskLevel(level)}
                          className={`flex-1 p-4 rounded-lg border text-center transition-colors ${
                            riskLevel === level
                              ? "bg-[#f6c86a]/20 border-[#f6c86a]/60 text-[#f6c86a]"
                              : "bg-zinc-900/30 border-zinc-800/60 text-zinc-300 hover:border-zinc-700"
                          }`}
                        >
                          <div className="font-medium">{level}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-lg p-4 space-y-2">
                    <div className="text-sm font-medium text-zinc-200 mb-3">Risk settings summary</div>
                    <div className="space-y-1.5 text-sm text-zinc-400">
                      <div>Max position: {getRiskSettings().maxPosition} of capital per trade</div>
                      <div>Max open markets: {getRiskSettings().maxMarkets}</div>
                      <div>Daily loss limit: {getRiskSettings().dailyLoss}</div>
                    </div>
              </div>

                  <div className="flex justify-between">
                    <Button
                      variant="ghost"
                      onClick={() => setCurrentStep(2)}
                      className="text-zinc-400 hover:text-zinc-200"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                    <Button
                      onClick={handleDeploy}
                      disabled={!agentName || !initialCapital}
                      className="bg-[#f6c86a] hover:bg-[#f6c86a]/90 text-black"
                    >
                      Save & Continue to Testing
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* RIGHT: AGENT CONTROL & TERMINAL */}
          <div className="rounded-2xl bg-[#080b12] border border-zinc-800/60 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-200">Agent control</h3>
              <div className="flex items-center gap-2">
                <Badge className={`text-xs px-2 py-1 border ${getStatusColor(status)}`}>
                  {status}
                </Badge>
                <Select value={simulationSpeed.toString()} onValueChange={(v) => setSimulationSpeed(parseInt(v))}>
                  <SelectTrigger className="h-7 px-2 text-xs border-zinc-800/60 bg-zinc-900/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Speed: x1</SelectItem>
                    <SelectItem value="5">Speed: x5</SelectItem>
                    <SelectItem value="20">Speed: x20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-lg p-4 space-y-2">
              <div className="text-xs text-zinc-400 space-y-1">
                <div><span className="text-zinc-500">Name:</span> <span className="text-zinc-200">{agentName || "—"}</span></div>
                <div><span className="text-zinc-500">Objective:</span> <span className="text-zinc-200">{objective}</span></div>
                <div><span className="text-zinc-500">Model:</span> <span className="text-zinc-200">{model}</span></div>
                <div><span className="text-zinc-500">Capital:</span> <span className="text-zinc-200">{initialCapital || "—"} SOL</span></div>
                <div><span className="text-zinc-500">Risk:</span> <span className="text-zinc-200">{riskLevel}</span></div>
              </div>
              <div className="pt-2 border-t border-zinc-800/40">
                <Badge className={`text-xs px-2 py-0.5 ${
                  isStrategyComplete ? "bg-trade-yes/20 text-trade-yes border-trade-yes/40" : "bg-zinc-800/50 text-zinc-400"
                }`}>
                  {isStrategyComplete ? "Complete" : "Incomplete"}
                </Badge>
              </div>
            </div>
            
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col min-h-0">
              <TabsList className="bg-zinc-900/50 border-zinc-800/60 h-9">
                <TabsTrigger value="LOGS" className="text-xs px-3">LOGS</TabsTrigger>
                <TabsTrigger value="TRADES" className="text-xs px-3">TRADES</TabsTrigger>
                <TabsTrigger value="POSITIONS" className="text-xs px-3">POSITIONS</TabsTrigger>
              </TabsList>
              
              <TabsContent value="LOGS" className="flex-1 overflow-y-auto bg-zinc-950/50 rounded-lg p-3 text-sm space-y-1 min-h-0">
                {logs.length === 0 ? (
                  <div className="text-center text-zinc-500 text-sm py-8">
                    No logs yet. Click 'Run Test' to see what your agent would do.
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex gap-2 text-xs">
                      <span className="text-zinc-500 font-mono">[{log.timestamp}]</span>
                      <span className="text-zinc-300">{log.message}</span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </TabsContent>
              
              <TabsContent value="TRADES" className="flex-1 overflow-y-auto min-h-0">
                <div className="space-y-1">
                  {trades.length === 0 ? (
                    <div className="text-center text-zinc-500 text-sm py-8">No trades yet</div>
                  ) : (
                    trades.map((trade) => (
                      <div key={trade.id} className="flex items-center justify-between p-2 bg-zinc-900/50 rounded border border-zinc-800/40 text-xs">
                        <span className="text-zinc-500 font-mono">{trade.time}</span>
                        <span className="text-zinc-300 truncate flex-1 mx-2">{trade.market}</span>
                        <Badge className={`text-[10px] px-1.5 py-0 ${
                          trade.side === "YES" ? "bg-trade-yes/20 text-trade-yes" : "bg-trade-no/20 text-trade-no"
                        }`}>
                          {trade.side}
                        </Badge>
                        <span className="text-zinc-300 mx-2">{trade.size.toFixed(1)}</span>
                        <span className="text-zinc-300 mx-2">${trade.price.toFixed(2)}</span>
                        <span className={trade.pnl >= 0 ? "text-trade-yes" : "text-trade-no"}>
                          {trade.pnl >= 0 ? "+" : ""}{trade.pnl.toFixed(1)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="POSITIONS" className="flex-1 overflow-y-auto min-h-0 space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Open positions</span>
                    <span className="text-zinc-200">{openPositions}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Total exposure</span>
                    <span className="text-zinc-200">{exposure.toFixed(2)} SOL</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Risk vs limit</span>
                      <span>45%</span>
                    </div>
                    <div className="h-2 bg-zinc-800/60 rounded-full overflow-hidden">
                      <div className="h-full bg-[#f6c86a]/40 rounded-full" style={{ width: "45%" }} />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        
        {/* BOTTOM: AGENT LIBRARY */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-zinc-200">Agent Library</h3>
            <div className="flex gap-1">
              {["My agents", "Top P&L", "Active"].map((filter) => (
                <Button
                  key={filter}
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs border-zinc-800/60 bg-zinc-900/30 hover:bg-zinc-800/50"
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="flex gap-3 overflow-x-auto pb-2">
            {libraryAgents.map((agent) => (
              <div
                key={agent.id}
                draggable
                onDragStart={() => handleDragStart(agent.id)}
                className="min-w-[160px] bg-[#090c13] border border-zinc-800/60 rounded-xl px-3 py-2 cursor-move hover:border-[#f6c86a]/40 hover:shadow-[0_0_15px_rgba(246,200,106,.1)] transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <img src={agent.avatar} alt={agent.name} className="w-5 h-5 rounded-full object-contain" />
                    <span className="text-xs font-medium text-zinc-200 truncate">{agent.name}</span>
                  </div>
                  <Badge className={`text-[10px] px-1.5 py-0 border ${getStatusColor(agent.status)}`}>
                    {agent.status}
                  </Badge>
                </div>
                <div className="text-xs">
                  <span className="text-zinc-500">P&L </span>
                  <span className={agent.pnl24h >= 0 ? "text-trade-yes" : "text-trade-no"}>
                    {agent.pnl24h >= 0 ? "+" : ""}{agent.pnl24h.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
