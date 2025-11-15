import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wallet, Mail, LogOut, User } from "lucide-react";

interface LoginButtonProps {
  onLogin?: (method: 'phantom' | 'gmail', data?: { address?: string; email?: string }) => void;
  onLogout?: () => void;
  isLoggedIn?: boolean;
  userEmail?: string;
  walletAddress?: string;
}

export const LoginButton = ({ 
  onLogin, 
  onLogout, 
  isLoggedIn = false,
  userEmail,
  walletAddress 
}: LoginButtonProps) => {
  const [isConnecting, setIsConnecting] = useState(false);

  const handlePhantomLogin = async () => {
    setIsConnecting(true);
    try {
      // Check if Phantom wallet is installed
      const provider = (window as any).solana;
      if (!provider || !provider.isPhantom) {
        alert('Phantom wallet not found. Please install Phantom extension.');
        setIsConnecting(false);
        return;
      }

      // Connect to Phantom wallet
      const response = await provider.connect();
      const address = response.publicKey.toString();
      
      onLogin?.('phantom', { address });
      console.log('Connected to Phantom:', address);
    } catch (error: any) {
      console.error('Phantom connection error:', error);
      if (error.code === 4001) {
        alert('Connection rejected by user');
      } else {
        alert('Failed to connect to Phantom wallet');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleGmailLogin = async () => {
    setIsConnecting(true);
    try {
      // Google OAuth login
      // This is a placeholder - you'll need to implement actual Google OAuth
      const response = await fetch('/api/auth/google', {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        onLogin?.('gmail', { email: data.email });
        console.log('Gmail login successful');
      } else {
        // For now, simulate Gmail login
        onLogin?.('gmail', { email: 'user@gmail.com' });
        console.log('Gmail login (simulated)');
      }
    } catch (error) {
      console.error('Gmail login error:', error);
      // For demo purposes, still call onLogin
      onLogin?.('gmail', { email: 'user@gmail.com' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLogout = () => {
    onLogout?.();
  };

  if (isLoggedIn) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs font-mono border-border bg-background hover:bg-bg-elevated rounded-full"
          >
            <User className="w-2.5 h-2.5 mr-1.5" />
            {walletAddress 
              ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
              : userEmail?.split('@')[0] || 'Logged In'
            }
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-background border-border">
          {userEmail && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground border-b border-border">
              {userEmail}
            </div>
          )}
          {walletAddress && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground border-b border-border font-mono">
              {walletAddress}
            </div>
          )}
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-xs cursor-pointer"
          >
            <LogOut className="w-3 h-3 mr-2" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs font-mono border-border bg-background hover:bg-bg-elevated rounded-full"
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : 'Login'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-background border-border">
        <DropdownMenuItem
          onClick={handlePhantomLogin}
          className="text-xs cursor-pointer flex items-center gap-2"
          disabled={isConnecting}
        >
          <Wallet className="w-4 h-4" />
          <span>Login with Phantom</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleGmailLogin}
          className="text-xs cursor-pointer flex items-center gap-2"
          disabled={isConnecting}
        >
          <Mail className="w-4 h-4" />
          <span>Login with Gmail</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

