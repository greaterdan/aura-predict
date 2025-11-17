import { useState, useEffect } from "react";
import { LoginButton } from "./LoginButton";
import { CustodialWallet } from "./CustodialWallet";
import { getOrCreateWallet } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import { Bot, BarChart3, Users, Newspaper, Github, FileText, Mail } from "lucide-react";

interface SystemStatusBarProps {
  onToggleAgentBuilder?: () => void;
  onTogglePerformance?: () => void;
  onToggleSummary?: () => void;
  onToggleNewsFeed?: () => void;
  isPerformanceOpen?: boolean;
  isSummaryOpen?: boolean;
  showNewsFeed?: boolean;
  showAgentBuilder?: boolean;
}

export const SystemStatusBar = ({ 
  onToggleAgentBuilder, 
  onTogglePerformance,
  showAgentBuilder, 
  onToggleSummary,
  onToggleNewsFeed,
  isPerformanceOpen = true,
  isSummaryOpen = true,
  showNewsFeed = false
}: SystemStatusBarProps) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [walletAddress, setWalletAddress] = useState<string | undefined>();
  const [custodialWallet, setCustodialWallet] = useState<{ publicKey: string; privateKey: string } | null>(null);

  useEffect(() => {
    // Check if user is already logged in (from localStorage or session)
    const storedEmail = localStorage.getItem('userEmail');
    const storedWallet = localStorage.getItem('walletAddress');
    
    if (storedEmail || storedWallet) {
      setIsLoggedIn(true);
      if (storedEmail) setUserEmail(storedEmail);
      if (storedWallet) setWalletAddress(storedWallet);
      
      // Generate or retrieve custodial wallet
      const userId = storedEmail || storedWallet || 'default';
      const wallet = getOrCreateWallet(userId);
      setCustodialWallet({
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey,
      });
    }
  }, []);

  const handleLogin = (method: 'phantom' | 'gmail', data?: { address?: string; email?: string }) => {
    setIsLoggedIn(true);
    const userId = method === 'phantom' ? data?.address : data?.email || 'default';
    
    if (method === 'phantom' && data?.address) {
      setWalletAddress(data.address);
      localStorage.setItem('walletAddress', data.address);
    } else if (method === 'gmail' && data?.email) {
      setUserEmail(data.email);
      localStorage.setItem('userEmail', data.email);
    }
    
    // Generate or retrieve custodial wallet for this user
    const wallet = getOrCreateWallet(userId || 'default');
    setCustodialWallet({
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey,
    });
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserEmail(undefined);
    setWalletAddress(undefined);
    setCustodialWallet(null);
    localStorage.removeItem('userEmail');
    localStorage.removeItem('walletAddress');
  };

  return (
    <div className="h-11 bg-bg-elevated border-b border-border flex items-center gap-2 px-4 py-2 relative" style={{ zIndex: 1000 }}>
      {/* Left side - empty */}
      <div className="flex items-center gap-2"></div>

      {/* Center - GitHub, README, Contact - Absolutely centered */}
      <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open('https://github.com/greaterdan/aura-predict', '_blank', 'noopener,noreferrer')}
          className="h-7 w-7 p-0 border-border bg-background hover:bg-bg-elevated text-foreground hover:text-foreground rounded-full"
          title="GitHub"
        >
          <Github className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open('https://x.com/greaterdan', '_blank', 'noopener,noreferrer')}
          className="h-7 w-7 p-0 border-border bg-background hover:bg-bg-elevated text-foreground hover:text-foreground rounded-full"
          title="X (Twitter)"
        >
          <svg 
            viewBox="0 0 24 24" 
            className="w-3.5 h-3.5 fill-current"
            aria-label="X"
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open('https://github.com/greaterdan/aura-predict/blob/main/README.md', '_blank', 'noopener,noreferrer')}
          className="h-7 w-7 p-0 border-border bg-background hover:bg-bg-elevated text-foreground hover:text-foreground rounded-full"
          title="README"
        >
          <FileText className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open('mailto:contact@example.com', '_blank')}
          className="h-7 w-7 p-0 border-border bg-background hover:bg-bg-elevated text-foreground hover:text-foreground rounded-full"
          title="Contact"
        >
          <Mail className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Right side - Performance, Summary, News Feed, Build Agent, Wallet, Login */}
      <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onTogglePerformance}
            className={`h-7 w-7 p-0 border-border rounded-full transition-colors ${
              isPerformanceOpen 
                ? 'bg-terminal-accent/20 border-terminal-accent/50 text-terminal-accent hover:bg-terminal-accent/30' 
                : 'bg-background hover:bg-bg-elevated text-foreground hover:text-foreground'
            }`}
            title="Performance Index"
          >
            <BarChart3 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleSummary}
            className={`h-7 w-7 p-0 border-border rounded-full transition-colors ${
            isSummaryOpen && !showNewsFeed && !showAgentBuilder
                ? 'bg-terminal-accent/20 border-terminal-accent/50 text-terminal-accent hover:bg-terminal-accent/30' 
                : 'bg-background hover:bg-bg-elevated text-foreground hover:text-foreground'
            }`}
            title="Summary"
          >
            <Users className="w-3.5 h-3.5" />
          </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleNewsFeed}
          className={`h-7 w-7 p-0 border-border rounded-full transition-colors ${
            showNewsFeed && isSummaryOpen
              ? 'bg-terminal-accent/20 border-terminal-accent/50 text-terminal-accent hover:bg-terminal-accent/30' 
              : 'bg-background hover:bg-bg-elevated text-foreground hover:text-foreground'
          }`}
          title="News Feed"
        >
          <Newspaper className="w-3.5 h-3.5" />
        </Button>
        {isLoggedIn && custodialWallet && (
          <>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleAgentBuilder}
              className={`h-7 w-7 p-0 border-border rounded-full transition-colors ${
                showAgentBuilder && isSummaryOpen && !showNewsFeed
                  ? 'border-terminal-accent bg-terminal-accent/20 text-terminal-accent hover:bg-terminal-accent/30'
                  : 'bg-background hover:bg-bg-elevated text-foreground hover:text-foreground'
              }`}
              title="Build Agent"
          >
              <Bot className="w-3.5 h-3.5" />
          </Button>
          <CustodialWallet
            walletAddress={custodialWallet.publicKey}
            privateKey={custodialWallet.privateKey}
          />
        </>
      )}
      <LoginButton
        onLogin={handleLogin}
        onLogout={handleLogout}
        isLoggedIn={isLoggedIn}
        userEmail={userEmail}
        walletAddress={walletAddress}
      />
      </div>
    </div>
  );
};
