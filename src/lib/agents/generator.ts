/**
 * Agent trade generator
 * 
 * Main entry point for generating trades for an agent.
 * Orchestrates market fetching, news aggregation, scoring, and trade generation.
 */

import type { AgentId, AgentTrade, Market, NewsArticle } from './domain';
import { getAgentProfile } from './domain';
// Use the same market fetching as bubble maps
// The trading engine will use markets from the server's /api/predictions endpoint
// This ensures we use the SAME API keys and data source
import { fetchAllMarkets } from '../markets/polymarket';
import { fetchLatestNews } from '../news/aggregator';
import { filterCandidateMarkets, scoreMarketForAgent, computeNewsRelevance } from './scoring';
import { generateTradeForMarket } from './engine';
import { getCachedAgentTrades, setCachedAgentTrades } from './cache';

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
  
  // Check cache before computing
  const currentMarketIds = markets.map(m => m.id).sort();
  
  // Log sample market IDs for debugging
  if (currentMarketIds.length > 0) {
    console.log(`[Agent:${agentId}] 📋 Sample market IDs (first 5):`, currentMarketIds.slice(0, 5));
  }
  
  const cached = getCachedAgentTrades(agentId, currentMarketIds);
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
  
  // Filter to only markets with real condition_ids (must match prediction IDs)
  // This ensures all trades are clickable and match existing predictions
  // Only trade markets that exist in Polymarket (not generated IDs)
  const validMarkets = markets.filter(m => {
    // Market ID must exist and not be a generated ID
    // Generated IDs start with 'market-' and are fallbacks for markets without condition_id
    // We only want to trade real Polymarket markets with actual condition_ids
    return m.id && m.id.trim() !== '' && !m.id.startsWith('market-');
  });
  
  console.log(`[Agent:${agentId}] 🔍 Filtered to ${validMarkets.length} markets with real condition_ids (from ${markets.length} total)`);
  
  if (validMarkets.length === 0) {
    console.warn(`[Agent:${agentId}] ⚠️ No valid markets found with condition_ids - cannot generate trades`);
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
  
  // Take top markets (use relative threshold - take top N regardless of absolute score)
  // This ensures agents can trade even if all scores are relatively low
  const topMarkets = scoredMarkets.slice(0, agent.maxTrades * 2);
  console.log(`[Agent:${agentId}] 🎯 Selected top ${topMarkets.length} markets for trade generation (top score: ${topScore.toFixed(1)})`);
  
  // If top score is very low, log a warning but still proceed
  if (topScore < 15 && topMarkets.length > 0) {
    console.warn(`[Agent:${agentId}] ⚠️ Top market score is low (${topScore.toFixed(1)}), but proceeding with top markets anyway`);
  }
  
  // Generate trades (now async due to AI API calls)
  const nowMs = Date.now();
  const trades: AgentTrade[] = [];
  
  console.log(`[Agent:${agentId}] 🤖 Generating trades for ${topMarkets.length} markets...`);
  for (let i = 0; i < topMarkets.length; i++) {
    const scored = topMarkets[i];
    console.log(`[Agent:${agentId}] 📝 Processing market ${i + 1}/${topMarkets.length}: "${scored.question.substring(0, 50)}..." (score: ${scored.score.toFixed(1)})`);
    
    // News relevance still computed for reasoning (legacy compatibility)
    const newsRelevance = computeNewsRelevance(scored, newsArticles);
    
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
        console.log(`[Agent:${agentId}] ⏭️ Skipped market (score too low or other reason)`);
      }
    } catch (error) {
      console.error(`[Agent:${agentId}] ❌ Failed to generate trade for market ${scored.id}:`, error);
      // Continue to next market
    }
    
    // Stop once we have enough trades
    if (trades.length >= agent.maxTrades) {
      console.log(`[Agent:${agentId}] 🎯 Reached max trades (${agent.maxTrades}) - stopping`);
      break;
    }
  }
  
  const duration = Date.now() - startTime;
  console.log(`[Agent:${agentId}] ✅ Trade generation complete: ${trades.length} trades generated in ${duration}ms`);
  
  // Cache results
  setCachedAgentTrades(agentId, trades, currentMarketIds);
  
  return trades;
}





