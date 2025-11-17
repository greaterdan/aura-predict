import { motion } from "framer-motion";
import { Newspaper, ExternalLink } from "lucide-react";

interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  category: string;
  url?: string;
}

const mockNews: NewsItem[] = [
  {
    id: "1",
    title: "Bitcoin Surges Past $95,000 as Institutional Adoption Accelerates",
    source: "CryptoNews",
    time: "2m ago",
    category: "Crypto",
    url: "https://example.com/news/1"
  },
  {
    id: "2",
    title: "Trump Leads in Latest Prediction Markets Ahead of Election",
    source: "Polymarket",
    time: "15m ago",
    category: "Politics",
    url: "https://example.com/news/2"
  },
  {
    id: "3",
    title: "Fed Signals Potential Rate Cut as Inflation Cools",
    source: "Bloomberg",
    time: "1h ago",
    category: "Economics",
    url: "https://example.com/news/3"
  },
  {
    id: "4",
    title: "AI Trading Agents Show 23% Alpha in Q4 Performance Review",
    source: "TradingTech",
    time: "3h ago",
    category: "Technology",
    url: "https://example.com/news/4"
  },
  {
    id: "5",
    title: "Ethereum Layer 2 Solutions See Record Transaction Volume",
    source: "DeFiPulse",
    time: "5h ago",
    category: "Crypto",
    url: "https://example.com/news/5"
  },
  {
    id: "6",
    title: "Market Volatility Index Spikes on Geopolitical Concerns",
    source: "MarketWatch",
    time: "8h ago",
    category: "Markets",
    url: "https://example.com/news/6"
  }
];

export const NewsFeed = () => {
  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="h-10 px-4 border-b border-border flex items-center justify-between bg-bg-elevated flex-shrink-0">
        <span className="text-xs text-terminal-accent font-mono leading-none flex items-center gap-2">
          <Newspaper className="w-3 h-3" />
          &gt; NEWS FEED
        </span>
        <div className="flex items-center gap-2">
          <motion.div
            className="w-2 h-2 rounded-full bg-trade-yes"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [1, 0.7, 1],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="text-[10px] text-muted-foreground font-mono">LIVE</span>
        </div>
      </div>

      {/* News Feed */}
      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <div className="p-3 space-y-2">
          {mockNews.map((news, index) => (
            <motion.div
              key={news.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-bg-elevated border border-border rounded-lg p-3 hover:border-terminal-accent/50 transition-colors cursor-pointer group"
              onClick={() => {
                if (news.url) {
                  window.open(news.url, '_blank', 'noopener,noreferrer');
                }
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] text-terminal-accent font-mono uppercase tracking-wider px-2 py-0.5 bg-terminal-accent/10 rounded">
                      {news.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {news.time}
                    </span>
                  </div>
                  <h3 className="text-xs font-medium text-foreground leading-snug group-hover:text-terminal-accent transition-colors">
                    {news.title}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[9px] text-muted-foreground font-mono">
                      {news.source}
                    </span>
                    {news.url && (
                      <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

