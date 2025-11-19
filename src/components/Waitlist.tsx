import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, CheckCircle2, Loader2 } from "lucide-react";
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
    <div className="h-full w-full flex items-center justify-center bg-[#05070a]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full mx-auto rounded-2xl bg-[#080b12] border border-zinc-800/60 p-8"
      >
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold text-zinc-100 mb-2">
            Join the Waitlist
          </h2>
          <p className="text-sm text-zinc-400">
            Get early access to our AI Agent Builder. Be among the first to create and deploy your own trading agents.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center py-4"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-trade-yes/10 border border-trade-yes/20 mb-3">
                <CheckCircle2 className="w-6 h-6 text-trade-yes" />
              </div>
              <p className="text-sm text-zinc-300 font-medium mb-1">
                You're on the list!
              </p>
              <p className="text-xs text-zinc-500">
                We'll notify you when the Agent Builder is ready.
              </p>
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
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12 bg-background border-border focus:border-terminal-accent"
                  disabled={isSubmitting}
                  required
                />
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-red-400 text-center"
                >
                  {error}
                </motion.p>
              )}

              <Button
                type="submit"
                disabled={isSubmitting || !email}
                className="w-full h-12 bg-terminal-accent hover:bg-terminal-accent/90 text-background font-medium"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    Join Waitlist
                  </>
                )}
              </Button>

              <p className="text-xs text-zinc-500 text-center mt-4">
                We respect your privacy. We'll only use your email to notify you about early access.
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

