import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const Landing = () => {
  const navigate = useNavigate();

  const handleEnterApp = () => {
    navigate("/app");
  };

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center">
      {/* Enter App Button - Top Right Corner */}
      <div className="absolute top-6 right-6 z-50">
        <Button
          onClick={handleEnterApp}
          className="flex items-center gap-2 px-6 py-2.5 bg-terminal-accent hover:bg-terminal-accent/90 text-background font-medium rounded-lg transition-colors"
        >
          Enter App
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Main Content - Probly Text */}
      <div className="text-center">
        <h1 className="text-8xl md:text-9xl font-bold text-foreground tracking-tight">
          Probly
        </h1>
      </div>
    </div>
  );
};

export default Landing;

