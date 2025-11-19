import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Mail, LogOut, User } from "lucide-react";
import { API_BASE_URL } from "@/lib/apiConfig";

interface LoginButtonProps {
  onLogin?: (email: string) => void;
  onLogout?: () => void;
  isLoggedIn?: boolean;
  userEmail?: string;
}

export const LoginButton = ({ 
  onLogin, 
  onLogout, 
  isLoggedIn = false,
  userEmail
}: LoginButtonProps) => {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleGoogleLogin = () => {
    // Redirect to Google OAuth endpoint - this will redirect to Google
    window.location.href = `${API_BASE_URL}/api/auth/google`;
  };

  const handleLogout = async () => {
    try {
      // Call logout endpoint to clear OAuth session
      const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        console.error('Logout failed');
      }
      onLogout?.();
    } catch (error) {
      console.error('Logout error:', error);
      onLogout?.(); // Still call onLogout to clear local state
    }
  };

  // Check for OAuth session on mount and after auth redirect
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.user?.email) {
            // User is logged in via OAuth
            onLogin?.(data.user.email);
          }
        }
      } catch (error) {
        // Silently fail - user might not be logged in
        console.debug('Auth check failed:', error);
      }
    };

    // Check URL params for auth success/error
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    
    if (authStatus === 'success') {
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Check auth status
      checkAuth();
    } else if (authStatus === 'error') {
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      alert('Authentication failed. Please try again.');
    } else {
      // Check on mount if already logged in
      checkAuth();
    }
  }, [onLogin]);

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
            {userEmail?.split('@')[0] || 'Logged In'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-background border-border">
          {userEmail && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground border-b border-border">
              {userEmail}
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
          onClick={handleGoogleLogin}
          className="text-xs cursor-pointer flex items-center gap-2"
          disabled={isConnecting}
        >
          <Mail className="w-4 h-4" />
          <span>Login with Google</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

