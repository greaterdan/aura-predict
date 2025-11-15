import { useState, useEffect } from "react";
import { LoginButton } from "./LoginButton";
import { CustodialWallet } from "./CustodialWallet";
import { getOrCreateWallet } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";

export const SystemStatusBar = ({ onToggleAgentBuilder }: { onToggleAgentBuilder?: () => void }) => {
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
    <div className="h-11 bg-bg-elevated border-b border-border flex items-center justify-end gap-2 px-4 py-2">
      {isLoggedIn && custodialWallet && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleAgentBuilder}
            className="h-7 px-2.5 text-xs font-mono border-border bg-background hover:bg-bg-elevated rounded-full"
          >
            <Bot className="w-2.5 h-2.5 mr-1.5" />
            Build Agent
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
  );
};
