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
import { getCachedAgentTrades, setCachedAgentTrades } from './cache.js';
import { generateResearchForMarket, type ResearchDecision } from './research.js';

/**
 * Research decisions cache (separate from trades)
 */
const researchCache = new Map<AgentId, ResearchDecision[]>();

/**
 * Generate trades for a specific agent
 * 
 * Pipeline:
 * 1. Fetch all markets (cached 60s)
 * 2. Fetch all news (cached 5min)
 * 3. Filter candidate markets for agent
 * 4. Score each candidate
 * 5. Sort by score and take top N
 * 6. Generate trades
 * 7. Cache results
 * 
 * @param agentId - Agent identifier
 * @returns Array of agent trades
 */
export async function generateAgentTrades(agentId: AgentId): Promise<AgentTrade[]> {
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
  
  // Check cache before computing
  const currentMarketIds = markets.map(m => m.id).sort();
  
  // Log sample market IDs for debugging
  if (currentMarketIds.length > 0) {
    console.log(`[Agent:${agentId}] 📋 Sample market IDs (first 5):`, currentMarketIds.slice(0, 5));
  }
  
  const cached = await getCachedAgentTrades(agentId, currentMarketIds);
  if (cached !== null) {
    console.log(`[Agent:${agentId}] 💾 Cache hit - returning ${cached.length} cached trades`);
    // Log sample trade market IDs
    if (cached.length > 0) {
      console.log(`[Agent:${agentId}] 📋 Sample trade market IDs:`, cached.slice(0, 3).map(t => t.marketId));
    }
    return cached;
  }
  console.log(`[Agent:${agentId}] 💾 Cache miss - generating NEW trades with AI`);
  
  // Filter candidate markets
  console.log(`[Agent:${agentId}] 🔍 Filtering candidate markets (minVolume: $${agent.minVolume}, minLiquidity: $${agent.minLiquidity})...`);
  
  // Log market statistics before filtering
  const totalMarkets = markets.length;
  const marketsWithVolume = markets.filter(m => m.volumeUsd >= agent.minVolume).length;
  const marketsWithLiquidity = markets.filter(m => m.liquidityUsd >= agent.minLiquidity).length;
  const marketsWithBoth = markets.filter(m => m.volumeUsd >= agent.minVolume && m.liquidityUsd >= agent.minLiquidity).length;
  console.log(`[Agent:${agentId}] 📊 Market stats: ${totalMarkets} total, ${marketsWithVolume} meet volume, ${marketsWithLiquidity} meet liquidity, ${marketsWithBoth} meet both`);
  
  // Filter to only markets with valid IDs (must match prediction IDs)
  // This ensures all trades are clickable and match existing predictions
  // Accept condition_id, question_id, slug, or id - all are valid prediction IDs
  // Only skip generated IDs (market-* prefix) that don't have a real ID
  const validMarkets = markets.filter(m => {
    // Market ID must exist
    // Accept any ID format that matches predictions (condition_id, slug, etc.)
    // Only skip if it's a generated ID without a real identifier
    if (!m.id || m.id.trim() === '') {
      return false;
    }
    // Accept all IDs - predictions can use condition_id, slug, or generated IDs
    // The important thing is that the ID matches what predictions use
    return true;
  });
  
  console.log(`[Agent:${agentId}] 🔍 Filtered to ${validMarkets.length} markets with valid IDs (from ${markets.length} total)`);
  
  if (validMarkets.length === 0) {
    console.warn(`[Agent:${agentId}] ⚠️ No valid markets found - cannot generate trades`);
    return [];
  }
  
  const candidates = filterCandidateMarkets(agent, validMarkets);
  console.log(`[Agent:${agentId}] ✅ Found ${candidates.length} candidate markets with valid IDs`);
  
  // Log sample candidate markets for visibility
  if (candidates.length > 0) {
    const sampleMarkets = candidates.slice(0, 3);
    console.log(`[Agent:${agentId}] 📋 Sample candidates:`);
    sampleMarkets.forEach((m, idx) => {
      console.log(`[Agent:${agentId}]   ${idx + 1}. "${m.question.substring(0, 60)}..." (Vol: $${(m.volumeUsd / 1000).toFixed(1)}k, Liq: $${(m.liquidityUsd / 1000).toFixed(1)}k, Cat: ${m.category})`);
    });
  } else {
    console.warn(`[Agent:${agentId}] ⚠️ No candidate markets found!`);
    console.warn(`[Agent:${agentId}] ⚠️ This means no markets meet: volume >= $${agent.minVolume} AND liquidity >= $${agent.minLiquidity}`);
    console.warn(`[Agent:${agentId}] ⚠️ Consider lowering minVolume or minLiquidity if markets are too strict`);
    return [];
  }
  
  // Score all candidates with agent-specific weights and recency-aware news
  console.log(`[Agent:${agentId}] 📈 Scoring ${candidates.length} candidate markets...`);
  const now = new Date();
  const scoredMarkets = candidates.map(market => {
    // Use agent-specific weighted scoring with recency-aware news
    return scoreMarketForAgent(market, newsArticles, agent, now);
  });
  
  // Sort by weighted score descending
  scoredMarkets.sort((a, b) => b.score - a.score);
  const topScore = scoredMarkets[0]?.score || 0;
  const avgScore = scoredMarkets.length > 0 
    ? scoredMarkets.reduce((sum, m) => sum + m.score, 0) / scoredMarkets.length 
    : 0;
  console.log(`[Agent:${agentId}] ✅ Scoring complete. Top: ${topScore.toFixed(1)}, Avg: ${avgScore.toFixed(1)}, Count: ${scoredMarkets.length}`);
  
  // Log top 5 scored markets for visibility
  const top5 = scoredMarkets.slice(0, 5);
  console.log(`[Agent:${agentId}] 🏆 Top 5 scored markets:`);
  top5.forEach((m, idx) => {
    console.log(`[Agent:${agentId}]   ${idx + 1}. Score: ${m.score.toFixed(1)} - "${m.question.substring(0, 50)}..."`);
    console.log(`[Agent:${agentId}]      Components: Vol:${m.components.volumeScore.toFixed(1)} Liq:${m.components.liquidityScore.toFixed(1)} News:${m.components.newsScore.toFixed(1)} Prob:${m.components.probScore.toFixed(1)}`);
  });
  
  // Select markets with rotation to avoid always picking the same ones
  // Take top markets but add some randomness to explore different markets
  const selectionSize = Math.min(agent.maxTrades * 5, scoredMarkets.length); // Increased from 3 to 5 for more variety
  const topMarkets = scoredMarkets.slice(0, selectionSize);
  
  // Add rotation: shuffle top markets using deterministic but varying seed
  // Use current time (rounded to 5 seconds) to create variation while maintaining determinism
  // This ensures different markets are selected every 5 seconds
  const timeSeed = Math.floor(Date.now() / 5000); // Changes every 5 seconds
  const agentSeed = agentId.charCodeAt(0) + agentId.charCodeAt(agentId.length - 1);
  const rotationSeed = timeSeed + agentSeed;
  
  // Shuffle using deterministic seed based on time
  const shuffled = [...topMarkets];
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Use deterministic but time-varying seed
    const seed = `${rotationSeed}:${i}:${shuffled[i].id}`;
    const hash = seed.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    const j = Math.abs(hash) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  // Take top N after shuffle (still prioritize high scores but add variety)
  // Take more markets to ensure we have enough variety
  const selectedMarkets = shuffled.slice(0, Math.min(agent.maxTrades * 3, shuffled.length));
  
  console.log(`[Agent:${agentId}] 🎯 Selected ${selectedMarkets.length} markets for trade generation (top score: ${topScore.toFixed(1)})`);
  console.log(`[Agent:${agentId}] 🔄 Market rotation applied - exploring different markets each cycle`);
  
  // If top score is very low, log a warning but still proceed
  if (topScore < 15 && selectedMarkets.length > 0) {
    console.warn(`[Agent:${agentId}] ⚠️ Top market score is low (${topScore.toFixed(1)}), but proceeding with top markets anyway`);
  }
  
  // Generate trades AND research (now async due to AI API calls)
  const nowMs = Date.now();
  const trades: AgentTrade[] = [];
  const researchDecisions: ResearchDecision[] = [];
  
  const maxResearchDecisions = Math.max(agent.maxTrades * 2, 6);
  const researchedMarketIds = new Set<string>();
  
  console.log(`[Agent:${agentId}] 🤖 Generating trades for ${selectedMarkets.length} markets...`);
  for (let i = 0; i < selectedMarkets.length; i++) {
    const scored = selectedMarkets[i];
    console.log(`[Agent:${agentId}] 📝 Processing market ${i + 1}/${topMarkets.length}: "${scored.question.substring(0, 50)}..." (score: ${scored.score.toFixed(1)})`);
    
    // News relevance still computed for reasoning (legacy compatibility)
    const newsRelevance = computeNewsRelevance(scored, newsArticles);
    
    const shouldAttemptTrades = trades.length < agent.maxTrades;
    
    if (shouldAttemptTrades) {
      try {
        const trade = await generateTradeForMarket(
          agent,
          scored,
          newsRelevance,
          newsArticles,
          i,
          nowMs
        );
        
        if (trade) {
          trades.push(trade);
          console.log(`[Agent:${agentId}] ✅ Generated trade ${trades.length}: ${trade.side} @ ${(trade.confidence * 100).toFixed(0)}% confidence`);
        } else {
          // If no trade generated, create research decision instead
          // This shows agents are analyzing markets even when not trading
          if (researchDecisions.length < maxResearchDecisions) {
            const researchDecision = await generateResearchForMarket(
              agent,
              scored,
              newsRelevance,
              newsArticles,
              i,
              nowMs
            );
            
            if (researchDecision) {
              // Store research decision
              researchDecisions.push(researchDecision);
              researchedMarketIds.add(scored.id);
              console.log(`[Agent:${agentId}] 🔍 Generated research: ${researchDecision.side} @ ${(researchDecision.confidence * 100).toFixed(0)}% confidence`);
            } else {
              console.log(`[Agent:${agentId}] ⏭️ Skipped market (score too low)`);
            }
          }
        }
      } catch (error) {
        console.error(`[Agent:${agentId}] ❌ Failed to generate trade for market ${scored.id}:`, error);
        // Continue to next market
      }
    } else if (researchDecisions.length < maxResearchDecisions && !researchedMarketIds.has(scored.id)) {
      // Trade quota reached - continue generating research so summary stays fresh
      try {
        const researchDecision = await generateResearchForMarket(
          agent,
          scored,
          newsRelevance,
          newsArticles,
          i,
          nowMs
        );
        
        if (researchDecision) {
          researchDecisions.push(researchDecision);
          researchedMarketIds.add(scored.id);
          console.log(`[Agent:${agentId}] 🔍 Additional research generated post-trade-cap: ${researchDecision.side} @ ${(researchDecision.confidence * 100).toFixed(0)}% confidence`);
        }
      } catch (error) {
        console.error(`[Agent:${agentId}] ❌ Failed to generate research for market ${scored.id}:`, error);
      }
    }
    
    // Stop once we have enough total insights
    if (trades.length >= agent.maxTrades && researchDecisions.length >= maxResearchDecisions) {
      console.log(`[Agent:${agentId}] 🎯 Reached trade (${agent.maxTrades}) and research (${maxResearchDecisions}) targets - stopping`);
      break;
    }
  }

  // If we still need more research insights, take another pass through unresearched markets
  if (researchDecisions.length < maxResearchDecisions) {
    console.log(`[Agent:${agentId}] 🔁 Research below target (${researchDecisions.length}/${maxResearchDecisions}) - running supplemental pass`);
    for (let i = 0; i < selectedMarkets.length && researchDecisions.length < maxResearchDecisions; i++) {
      const scored = selectedMarkets[i];
      if (researchedMarketIds.has(scored.id)) {
        continue;
      }
      const newsRelevance = computeNewsRelevance(scored, newsArticles);
      try {
        const researchDecision = await generateResearchForMarket(
          agent,
          scored,
          newsRelevance,
          newsArticles,
          i,
          nowMs
        );
        if (researchDecision) {
          researchDecisions.push(researchDecision);
          researchedMarketIds.add(scored.id);
          console.log(`[Agent:${agentId}] 🔍 Supplemental research: ${researchDecision.side} on ${scored.id}`);
        }
      } catch (error) {
        console.error(`[Agent:${agentId}] ❌ Supplemental research failed for ${scored.id}:`, error);
      }
    }
  }
  
  const duration = Date.now() - startTime;
  console.log(`[Agent:${agentId}] ✅ Trade generation complete: ${trades.length} trades and ${researchDecisions.length} research decisions generated in ${duration}ms`);
  
  // Cache results (persists to Redis if available)
  await setCachedAgentTrades(agentId, trades, currentMarketIds);
  
  // Cache research decisions separately
  researchCache.set(agentId, researchDecisions);
  
  return trades;
}

/**
 * Get research decisions for an agent
 */
export function getAgentResearch(agentId: AgentId): ResearchDecision[] {
  return researchCache.get(agentId) || [];
}



