/**
 * Agent trade generator
 * 
 * Main entry point for generating trades for an agent.
 * Orchestrates market fetching, news aggregation, scoring, and trade generation.
 */

import type { AgentId, AgentTrade, Market, NewsArticle } from './domain.js';
import { getAgentProfile } from './domain.js';
// Use the same market fetching as bubble maps
// The trading engine will use markets from the server's /api/predictions endpoint
// This ensures we use the SAME API keys and data source
import { fetchAllMarkets } from '../markets/polymarket.js';
import { fetchLatestNews } from '../news/aggregator.js';
import { filterCandidateMarkets, scoreMarketForAgent, computeNewsRelevance } from './scoring.js';
import { generateTradeForMarket } from './engine.js';
import { getCachedAgentTrades, setCachedAgentTrades, getCachedTradesQuick } from './cache.js';
import { generateResearchForMarket, type ResearchDecision } from './research.js';

/**
 * Research decisions cache (separate from trades)
 */
const researchCache = new Map<AgentId, ResearchDecision[]>();

/**
 * Request deduplication: Track ongoing trade generation per agent
 * If multiple requests come in for the same agent, they wait for the first one
 */
const ongoingGeneration = new Map<AgentId, Promise<AgentTrade[]>>();

/**
 * Generate trades for a specific agent
 * 
 * Pipeline:
 * 1. Check cache (fast path)
 * 2. Check if generation already in progress (deduplication)
 * 3. Fetch all markets (cached 60s)
 * 4. Fetch all news (cached 5min)
 * 5. Filter candidate markets for agent
 * 6. Score each candidate
 * 7. Sort by score and take top N
 * 8. Generate trades
 * 9. Cache results
 * 
 * @param agentId - Agent identifier
 * @returns Array of agent trades
 */
export async function generateAgentTrades(agentId: AgentId): Promise<AgentTrade[]> {
  // Check if generation is already in progress for this agent (deduplication)
  const existingGeneration = ongoingGeneration.get(agentId);
  if (existingGeneration) {
    console.log(`[Agent:${agentId}] ⏳ Generation already in progress, waiting for existing request...`);
    return existingGeneration;
  }
  
  // Check cache FIRST before starting generation (fast path)
  const quickCached = await getCachedTradesQuick(agentId);
  if (quickCached && quickCached.length > 0) {
    console.log(`[Agent:${agentId}] ⚡ Quick cache hit - returning ${quickCached.length} cached trades immediately`);
    return quickCached;
  }
  
  // Create generation promise and store it for deduplication
  const generationPromise = (async () => {
    try {
      const startTime = Date.now();
      console.log(`[Agent:${agentId}] 🚀 Starting trade generation`);
      
      const agent = getAgentProfile(agentId);
      console.log(`[Agent:${agentId}] Profile: ${agent.displayName}, maxTrades: ${agent.maxTrades}, risk: ${agent.risk}`);
      
      // Fetch data sources
      console.log(`[Agent:${agentId}] 📊 Fetching markets and news...`);
      const [markets, newsArticles] = await Promise.all([
        fetchAllMarkets(),
        fetchLatestNews(),
      ]);
      
      console.log(`[Agent:${agentId}] ✅ Fetched ${markets.length} markets, ${newsArticles.length} news articles`);
      
      // CRITICAL: Also fetch closed/ended markets for closed trades
      // Fetch markets that have ended (preferably November)
      let closedMarkets: Market[] = [];
      try {
        const { fetchAllMarkets: fetchClosedMarkets } = await import('../markets/polymarket.js');
        // Fetch closed markets separately - we'll need to modify the API call
        // For now, filter from existing markets those that have ended
        const now = new Date();
        const november2024 = new Date('2024-11-01');
        const december2024 = new Date('2024-12-01');
        
        closedMarkets = markets.filter(m => {
          if (!m.endDate) return false;
          try {
            const endDate = new Date(m.endDate);
            // Prefer markets that ended in November 2024
            const endedInNovember = endDate >= november2024 && endDate < december2024;
            const hasEnded = endDate < now;
            return (m.closed || m.archived || hasEnded) && (endedInNovember || hasEnded);
          } catch {
            return m.closed || m.archived;
          }
        });
        
        console.log(`[Agent:${agentId}] 📋 Found ${closedMarkets.length} closed/ended markets for closed trades`);
      } catch (error) {
        console.warn(`[Agent:${agentId}] ⚠️ Failed to fetch closed markets:`, error);
      }
      
      // Check cache again after fetching markets (market ID validation)
      const currentMarketIds = markets.map(m => m.id).sort();
      
      // Log sample market IDs for debugging
      if (currentMarketIds.length > 0) {
        console.log(`[Agent:${agentId}] 📋 Sample market IDs (first 5):`, currentMarketIds.slice(0, 5));
      }
      
      // Try full cache with market ID validation
      const cached = await getCachedAgentTrades(agentId, currentMarketIds);
      if (cached !== null && cached.length > 0) {
        console.log(`[Agent:${agentId}] 💾 Cache hit - returning ${cached.length} cached trades`);
        // Log sample trade market IDs
        if (cached.length > 0) {
          console.log(`[Agent:${agentId}] 📋 Sample trade market IDs:`, cached.slice(0, 3).map(t => t.marketId));
        }
        return cached;
      }
      console.log(`[Agent:${agentId}] 💾 Cache miss - generating NEW trades with AI (this may take time)`);
      
      // Filter candidate markets
      console.log(`[Agent:${agentId}] 🔍 Filtering candidate markets (minVolume: $${agent.minVolume}, minLiquidity: $${agent.minLiquidity})...`);
  
      console.log(`[Agent:${agentId}] 💾 Cache miss - generating NEW trades with AI (this may take time)`);
      
      // Filter candidate markets
      const totalMarkets = markets.length;
      const marketsWithVolume = markets.filter(m => m.volumeUsd >= agent.minVolume).length;
      const marketsWithLiquidity = markets.filter(m => m.liquidityUsd >= agent.minLiquidity).length;
      const marketsWithBoth = markets.filter(m => m.volumeUsd >= agent.minVolume && m.liquidityUsd >= agent.minLiquidity).length;
      console.log(`[Agent:${agentId}] 📊 Market stats: ${totalMarkets} total, ${marketsWithVolume} meet volume, ${marketsWithLiquidity} meet liquidity, ${marketsWithBoth} meet both`);
      
      // Filter to only markets with valid IDs (must match prediction IDs)
      const validMarkets = markets.filter(m => {
        if (!m.id || m.id.trim() === '') {
          return false;
        }
        return true;
      });
      
      console.log(`[Agent:${agentId}] 🔍 Filtered to ${validMarkets.length} markets with valid IDs (from ${markets.length} total)`);
      
      if (validMarkets.length === 0) {
        console.warn(`[Agent:${agentId}] ⚠️ No valid markets found - cannot generate trades`);
        return [];
      }
      
      const candidates = filterCandidateMarkets(agent, validMarkets);
      console.log(`[Agent:${agentId}] ✅ Found ${candidates.length} candidate markets with valid IDs`);
      
      if (candidates.length === 0) {
        console.warn(`[Agent:${agentId}] ⚠️ No candidate markets found!`);
        return [];
      }
      
      // Score all candidates
      const now = new Date();
      const scoredMarkets = candidates.map(market => {
        return scoreMarketForAgent(market, newsArticles, agent, now);
      });
      
      scoredMarkets.sort((a, b) => b.score - a.score);
      const topScore = scoredMarkets[0]?.score || 0;
      console.log(`[Agent:${agentId}] ✅ Scoring complete. Top: ${topScore.toFixed(1)}`);
      
      const selectionSize = Math.min(agent.maxTrades * 5, scoredMarkets.length);
      const topMarkets = scoredMarkets.slice(0, selectionSize);
      
      const timeSeed = Math.floor(Date.now() / 5000);
      const agentSeed = agentId.charCodeAt(0) + agentId.charCodeAt(agentId.length - 1);
      const rotationSeed = timeSeed + agentSeed;
      
      const shuffled = [...topMarkets];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const seed = `${rotationSeed}:${i}:${shuffled[i].id}`;
        const hash = seed.split('').reduce((acc, char) => {
          return ((acc << 5) - acc) + char.charCodeAt(0);
        }, 0);
        const j = Math.abs(hash) % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      const selectedMarkets = shuffled.slice(0, Math.min(agent.maxTrades * 3, shuffled.length));
      console.log(`[Agent:${agentId}] 🎯 Selected ${selectedMarkets.length} markets for trade generation`);
      
      const nowMs = Date.now();
      const trades: AgentTrade[] = [];
      const researchDecisions: ResearchDecision[] = [];
      const maxResearchDecisions = Math.max(agent.maxTrades * 2, 6);
      const researchedMarketIds = new Set<string>();
      
      console.log(`[Agent:${agentId}] 🤖 Generating trades for ${selectedMarkets.length} markets...`);
      for (let i = 0; i < selectedMarkets.length; i++) {
        const scored = selectedMarkets[i];
        const newsRelevance = computeNewsRelevance(scored, newsArticles);
        const shouldAttemptTrades = trades.length < agent.maxTrades;
        
        if (shouldAttemptTrades) {
          try {
            const trade = await generateTradeForMarket(agent, scored, newsRelevance, newsArticles, i, nowMs);
            if (trade) {
              trades.push(trade);
              console.log(`[Agent:${agentId}] ✅ Generated trade ${trades.length}: ${trade.side} @ ${(trade.confidence * 100).toFixed(0)}%`);
            } else if (researchDecisions.length < maxResearchDecisions) {
              const researchDecision = await generateResearchForMarket(agent, scored, newsRelevance, newsArticles, i, nowMs);
              if (researchDecision) {
                researchDecisions.push(researchDecision);
                researchedMarketIds.add(scored.id);
              }
            }
          } catch (error) {
            console.error(`[Agent:${agentId}] ❌ Failed to generate trade:`, error);
          }
        } else if (researchDecisions.length < maxResearchDecisions && !researchedMarketIds.has(scored.id)) {
          try {
            const researchDecision = await generateResearchForMarket(agent, scored, newsRelevance, newsArticles, i, nowMs);
            if (researchDecision) {
              researchDecisions.push(researchDecision);
              researchedMarketIds.add(scored.id);
            }
          } catch (error) {
            console.error(`[Agent:${agentId}] ❌ Failed to generate research:`, error);
          }
        }
        
        if (trades.length >= agent.maxTrades && researchDecisions.length >= maxResearchDecisions) {
          break;
        }
      }
      
      const duration = Date.now() - startTime;
      console.log(`[Agent:${agentId}] ✅ Trade generation complete: ${trades.length} trades in ${duration}ms`);
      
      await setCachedAgentTrades(agentId, trades, currentMarketIds);
      researchCache.set(agentId, researchDecisions);
      
      return trades;
    } finally {
      ongoingGeneration.delete(agentId);
    }
  })();
  
  ongoingGeneration.set(agentId, generationPromise);
  return generationPromise;
}

/**
 * Get research decisions for an agent
 */
export function getAgentResearch(agentId: AgentId): ResearchDecision[] {
  return researchCache.get(agentId) || [];
}



