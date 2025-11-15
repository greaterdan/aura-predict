import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Bot, Send, Settings, DollarSign, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";

interface AgentBuilderProps {
  walletAddress: string;
  privateKey: string;
  onDeploy?: () => void;
}

export const AgentBuilder = ({ walletAddress, privateKey, onDeploy }: AgentBuilderProps) => {
  const [agentName, setAgentName] = useState("");
  const [agentDescription, setAgentDescription] = useState("");
  const [tradingStrategy, setTradingStrategy] = useState("");
  const [initialCapital, setInitialCapital] = useState("");
  const [riskLevel, setRiskLevel] = useState<"low" | "medium" | "high">("medium");
  const [isDeploying, setIsDeploying] = useState(false);
  const { toast } = useToast();

  const deploymentCost = 0.1; // 0.1 SOL to deploy an agent

  const handleDeploy = async () => {
    if (!agentName.trim()) {
      toast({
        title: "Error",
        description: "Please enter an agent name",
        variant: "destructive",
      });
      return;
    }

    if (!initialCapital || parseFloat(initialCapital) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid initial capital amount",
        variant: "destructive",
      });
      return;
    }

    const totalCost = deploymentCost + parseFloat(initialCapital);
    
    setIsDeploying(true);
    try {
      // Check balance
      const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
      const publicKey = new PublicKey(walletAddress);
      const balance = await connection.getBalance(publicKey);
      const balanceSol = balance / LAMPORTS_PER_SOL;

      if (balanceSol < totalCost) {
        toast({
          title: "Insufficient Balance",
          description: `You need ${totalCost.toFixed(4)} SOL but only have ${balanceSol.toFixed(4)} SOL`,
          variant: "destructive",
        });
        setIsDeploying(false);
        return;
      }

      // Restore keypair
      const secretKey = bs58.decode(privateKey);
      const keypair = Keypair.fromSecretKey(secretKey);

      // Create deployment transaction
      // In a real app, this would interact with your smart contract/program
      // For demo purposes, we'll simulate the transaction
      // (connection already declared above)
      
      // NOTE: In production, this would call your Solana program to deploy the agent
      // For now, we simulate the deployment process
      // The actual SOL deduction would happen via your program's deployment instruction
      
      // Simulate deployment process (in production, replace with actual program call)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In production, you would:
      // 1. Create a transaction with your program's deploy instruction
      // 2. Include the deployment fee + initial capital in the instruction
      // 3. Sign and send the transaction
      // 4. The program would deduct SOL and deploy the agent
      
      // For demo: Log the deployment details
      console.log("Agent Deployment:", {
        name: agentName,
        initialCapital: initialCapital,
        totalCost: totalCost,
        wallet: walletAddress,
      });

      toast({
        title: "Agent Deployed!",
        description: `${agentName} has been deployed with ${initialCapital} SOL initial capital`,
      });

      // Reset form
      setAgentName("");
      setAgentDescription("");
      setTradingStrategy("");
      setInitialCapital("");
      setRiskLevel("medium");
      
      onDeploy?.();
    } catch (error: any) {
      console.error("Deployment error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to deploy agent",
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-y-auto">
      {/* Header */}
      <div className="h-10 px-4 border-b border-border flex items-center justify-between bg-bg-elevated flex-shrink-0">
        <span className="text-xs text-terminal-accent font-mono leading-none flex items-center">
          &gt; AGENT BUILDER
        </span>
        <div className="flex items-center gap-2">
          <Zap className="w-3 h-3 text-terminal-accent" />
          <span className="text-[10px] text-muted-foreground font-mono">CREATE & DEPLOY</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4">
        {/* Agent Configuration Card */}
        <Card className="bg-bg-elevated border-border p-4 rounded-2xl">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="w-4 h-4 text-terminal-accent" />
              <h3 className="text-sm font-mono uppercase text-terminal-accent">Agent Configuration</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agentName" className="text-xs font-mono uppercase text-muted-foreground">
                Agent Name
              </Label>
              <Input
                id="agentName"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="e.g., My Trading Bot"
                className="text-xs bg-background border-border rounded-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agentDescription" className="text-xs font-mono uppercase text-muted-foreground">
                Description
              </Label>
              <Textarea
                id="agentDescription"
                value={agentDescription}
                onChange={(e) => setAgentDescription(e.target.value)}
                placeholder="Describe your agent's trading strategy..."
                className="text-xs bg-background border-border rounded-xl min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tradingStrategy" className="text-xs font-mono uppercase text-muted-foreground">
                Trading Strategy
              </Label>
              <Textarea
                id="tradingStrategy"
                value={tradingStrategy}
                onChange={(e) => setTradingStrategy(e.target.value)}
                placeholder="Define your agent's trading rules and logic..."
                className="text-xs bg-background border-border rounded-xl min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="initialCapital" className="text-xs font-mono uppercase text-muted-foreground">
                  Initial Capital (SOL)
                </Label>
                <Input
                  id="initialCapital"
                  type="number"
                  step="0.01"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(e.target.value)}
                  placeholder="0.00"
                  className="text-xs bg-background border-border rounded-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="riskLevel" className="text-xs font-mono uppercase text-muted-foreground">
                  Risk Level
                </Label>
                <div className="flex gap-2">
                  {(["low", "medium", "high"] as const).map((level) => (
                    <Button
                      key={level}
                      type="button"
                      variant={riskLevel === level ? "default" : "outline"}
                      size="sm"
                      onClick={() => setRiskLevel(level)}
                      className={`text-xs rounded-full flex-1 ${
                        riskLevel === level
                          ? "bg-terminal-accent text-black"
                          : "bg-background border-border"
                      }`}
                    >
                      {level.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Deployment Info Card */}
        <Card className="bg-bg-elevated border-border p-4 rounded-2xl">
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-terminal-accent" />
              <h3 className="text-sm font-mono uppercase text-terminal-accent">Deployment Cost</h3>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-mono">Deployment Fee</span>
                <span className="text-foreground font-mono font-bold">{deploymentCost} SOL</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-mono">Initial Capital</span>
                <span className="text-foreground font-mono font-bold">
                  {initialCapital || "0.00"} SOL
                </span>
              </div>
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-mono uppercase text-terminal-accent font-bold">Total</span>
                  <span className="text-sm text-foreground font-mono font-bold">
                    {(deploymentCost + parseFloat(initialCapital || "0")).toFixed(4)} SOL
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Deploy Button */}
        <Button
          onClick={handleDeploy}
          disabled={isDeploying || !agentName || !initialCapital}
          className="w-full h-10 text-xs font-mono bg-terminal-accent hover:bg-terminal-accent/90 text-black rounded-full"
        >
          {isDeploying ? (
            "Deploying..."
          ) : (
            <>
              <Send className="w-3.5 h-3.5 mr-2" />
              Deploy Agent
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

