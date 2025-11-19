import { useState, useEffect } from "react";
import { LoginButton } from "./LoginButton";
import { CustodialWallet } from "./CustodialWallet";
import { getOrCreateWallet, getStoredWallet, getCustodialWallet, storeCustodialWallet } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Bot, BarChart3, Users, Newspaper, Github, FileText, Mail, Copy, Check } from "lucide-react";

interface SystemStatusBarProps {
  onToggleWaitlist?: () => void;
  onTogglePerformance?: () => void;
  onToggleSummary?: () => void;
  onToggleNewsFeed?: () => void;
  isPerformanceOpen?: boolean;
  isSummaryOpen?: boolean;
  showNewsFeed?: boolean;
  showWaitlist?: boolean;
}

export const SystemStatusBar = ({ 
  onToggleWaitlist, 
  onTogglePerformance,
  showWaitlist, 
  onToggleSummary,
  onToggleNewsFeed,
  isPerformanceOpen = true,
  isSummaryOpen = true,
  showNewsFeed = false
}: SystemStatusBarProps) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [custodialWallet, setCustodialWallet] = useState<{ publicKey: string; privateKey: string } | null>(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  const devEmail = "dev@probly.tech";

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(devEmail);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy email:", err);
    }
  };

  useEffect(() => {
    // Check if user is already logged in (from localStorage or OAuth session)
    const checkAuth = async () => {
      const storedEmail = localStorage.getItem('userEmail');
      
      // First check localStorage for email
      if (storedEmail) {
        setIsLoggedIn(true);
        setUserEmail(storedEmail);
        
        // Get or create wallet for this email
        // This ensures the same email always gets the same wallet
        let wallet = getStoredWallet(storedEmail);
        
        if (!wallet) {
          wallet = getOrCreateWallet(storedEmail);
        }
        
        // Store as custodial wallet for persistence
        storeCustodialWallet(wallet);
        
        setCustodialWallet({
          publicKey: wallet.publicKey,
          privateKey: wallet.privateKey,
        });
      } else {
        // Check for OAuth session (Google login)
        try {
          const { API_BASE_URL } = await import('@/lib/apiConfig');
          const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            credentials: 'include',
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.authenticated && data.user?.email) {
              // User is logged in via OAuth
              setIsLoggedIn(true);
              setUserEmail(data.user.email);
              localStorage.setItem('userEmail', data.user.email);
              
              // Get or create wallet for this email
              // This ensures the same email always gets the same wallet
              let wallet = getStoredWallet(data.user.email);
              
              if (!wallet) {
                wallet = getOrCreateWallet(data.user.email);
              }
              
              // Store as custodial wallet for persistence
              storeCustodialWallet(wallet);
              
              setCustodialWallet({
                publicKey: wallet.publicKey,
                privateKey: wallet.privateKey,
              });
            }
          }
        } catch (error) {
          // Silently fail - user might not be logged in
          console.debug('OAuth check failed:', error);
        }
        
        // Check if there's a stored custodial wallet even without login
        // (for backwards compatibility)
        const storedCustodialWallet = getCustodialWallet();
        if (storedCustodialWallet) {
          setCustodialWallet({
            publicKey: storedCustodialWallet.publicKey,
            privateKey: storedCustodialWallet.privateKey,
          });
        }
      }
    };
    
    checkAuth();
  }, []);

  const handleLogin = (email: string) => {
    setIsLoggedIn(true);
    setUserEmail(email);
    localStorage.setItem('userEmail', email);
    
    // Get or create wallet for this email address
    // This ensures the same email always gets the same wallet
    let wallet = getStoredWallet(email);
    
    if (!wallet) {
      // Create new wallet for this email
      wallet = getOrCreateWallet(email);
    }
    
    // Store as custodial wallet for persistence
    storeCustodialWallet(wallet);
    
    setCustodialWallet({
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey,
    });
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserEmail(undefined);
    // Keep custodial wallet in storage even after logout
    // so user can still see their wallet balance if they return
    // The wallet is tied to their email, so it will be restored on next login
    setCustodialWallet(null);
    localStorage.removeItem('userEmail');
    // Note: We keep the wallet in localStorage (keyed by email) for persistence
    // To fully clear, call clearCustodialWallet()
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
          disabled
          className="h-7 w-7 p-0 border-border bg-background text-foreground rounded-full cursor-default"
          title="GitHub"
        >
          <Github className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open('https://x.com/Problytech', '_blank', 'noopener,noreferrer')}
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
          onClick={() => window.open('https://github.com/greaterdan/probly/blob/main/README.md', '_blank', 'noopener,noreferrer')}
          className="h-7 w-7 p-0 border-border bg-background hover:bg-bg-elevated text-foreground hover:text-foreground rounded-full"
          title="README"
        >
          <FileText className="w-3.5 h-3.5" />
        </Button>
        <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
          <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0 border-border bg-background hover:bg-bg-elevated text-foreground hover:text-foreground rounded-full"
          title="Contact"
        >
          <Mail className="w-3.5 h-3.5" />
        </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-background border-border">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Contact Us</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Have a question or feedback? Reach out to our development team.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Development Email
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-muted rounded-md border border-border font-mono text-sm">
                    {devEmail}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyEmail}
                    className="h-9 px-3"
                  >
                    {emailCopied ? (
                      <>
                        <Check className="w-4 h-4 mr-1.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1.5" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => window.open(`mailto:${devEmail}`, '_blank')}
                    className="h-9 px-3"
                  >
                    <Mail className="w-4 h-4 mr-1.5" />
                    Email
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
            isSummaryOpen && !showNewsFeed && !showWaitlist
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
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleWaitlist}
          className={`h-7 w-7 p-0 border-border rounded-full transition-colors ${
            showWaitlist && isSummaryOpen && !showNewsFeed
              ? 'border-terminal-accent bg-terminal-accent/20 text-terminal-accent hover:bg-terminal-accent/30'
              : 'bg-background hover:bg-bg-elevated text-foreground hover:text-foreground'
          }`}
          title="Join Waitlist"
        >
          <Bot className="w-3.5 h-3.5" />
        </Button>
        {custodialWallet && (
          <CustodialWallet
            walletAddress={custodialWallet.publicKey}
            privateKey={custodialWallet.privateKey}
          />
        )}
      <LoginButton
        onLogin={handleLogin}
        onLogout={handleLogout}
        isLoggedIn={isLoggedIn}
        userEmail={userEmail}
      />
      </div>
    </div>
  );
};
