import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";

interface AgentBuilderProps {
  walletAddress: string;
  privateKey: string;
  onDeploy?: () => void;
}

export const AgentBuilder = (_props: AgentBuilderProps) => {
  return (
    <div className="h-full w-full flex items-center justify-center bg-[#05070a]">
      <div className="max-w-xl w-full mx-auto rounded-2xl bg-[#080b12] border border-zinc-800/60 p-8 text-center">
        <Badge className="mb-3 text-xs px-2 py-0.5 bg-zinc-800/60 text-zinc-300 border-zinc-700">
          Agent Builder
        </Badge>
        <h2 className="text-2xl font-semibold text-zinc-100 mb-2">Coming soon</h2>
        <p className="text-sm text-zinc-400 mb-6">
          We&apos;re building a simple, powerful wizard to create and deploy AI trading agents.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button
            disabled
            className="h-9 px-4 text-sm bg-[#f6c86a] hover:bg-[#f6c86a]/90 text-black cursor-not-allowed opacity-70"
          >
            <Zap className="w-4 h-4 mr-1.5" />
            Deploy Live
          </Button>
        </div>
      </div>
    </div>
  );
};
