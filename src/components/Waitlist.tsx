import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const Waitlist = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);

    try {
      const { API_BASE_URL } = await import('@/lib/apiConfig');
      const apiUrl = `${API_BASE_URL}/api/waitlist`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error("Failed to join waitlist");
      }

      setIsSuccess(true);
      setEmail("");
      
      // Reset success message after 5 seconds
      setTimeout(() => {
        setIsSuccess(false);
      }, 5000);
    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error("Waitlist error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full w-full flex items-center justify-center bg-background p-6">
      <div className="max-w-sm w-full">
        <div className="mb-8">
          <h2 className="text-lg font-mono text-foreground mb-3">
            Agent Builder
          </h2>
          <p className="text-sm text-muted-foreground font-mono leading-relaxed">
            Building custom trading agents. Sign up to get notified when it's ready.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border border-border bg-bg-elevated p-6 rounded"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-trade-yes mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-foreground font-mono mb-1">
                    You're in
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    We'll send you an email when it's live.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 bg-background border-border font-mono text-sm focus:border-terminal-accent"
                  disabled={isSubmitting}
                  required
                />
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-red-400 font-mono"
                >
                  {error}
                </motion.p>
              )}

              <Button
                type="submit"
                disabled={isSubmitting || !email}
                className="w-full h-10 bg-terminal-accent hover:bg-terminal-accent/90 text-background font-mono text-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Notify me"
                )}
              </Button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

