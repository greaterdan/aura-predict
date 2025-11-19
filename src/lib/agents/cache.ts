/**
 * Agent trade cache
 * 
 * Caches generated trades for each agent to avoid redundant computation.
 * Cache invalidates if market IDs change (new markets appear).
 * TTL: 2 minutes
 */

import type { AgentId, AgentTrade } from './domain';

/**
 * Cache entry structure
 */
interface AgentCacheEntry {
  trades: AgentTrade[];
  generatedAt: number;
  marketIds: string[]; // Sorted array of market IDs used
}

/**
 * Cache TTL: 30 seconds (much shorter for fresh AI decisions)
 */
const CACHE_TTL_MS = 30 * 1000;

/**
 * In-memory cache: agentId -> cache entry
 */
const agentCache = new Map<AgentId, AgentCacheEntry>();

/**
 * Get cached agent trades
 * 
 * @param agentId - Agent identifier
 * @param currentMarketIds - Sorted array of current market IDs
 * @returns Cached trades or null if cache miss/invalid
 */
export function getCachedAgentTrades(
  agentId: AgentId,
  currentMarketIds: string[]
): AgentTrade[] | null {
  const entry = agentCache.get(agentId);
  
  if (!entry) {
    return null; // Cache miss
  }
  
  // Check TTL
  const age = Date.now() - entry.generatedAt;
  if (age >= CACHE_TTL_MS) {
    agentCache.delete(agentId);
    return null; // Cache expired
  }
  
  // Check if market IDs match (invalidate if markets changed)
  if (entry.marketIds.length !== currentMarketIds.length) {
    agentCache.delete(agentId);
    return null; // Markets changed
  }
  
  // Compare market IDs (both are sorted)
  for (let i = 0; i < entry.marketIds.length; i++) {
    if (entry.marketIds[i] !== currentMarketIds[i]) {
      agentCache.delete(agentId);
      return null; // Markets changed
    }
  }
  
  // Cache hit - return cached trades
  // BUT: Always invalidate if cache is older than 20 seconds to ensure fresh AI decisions
  const ageSeconds = age / 1000;
  if (ageSeconds > 20) {
    console.log(`[Cache:${agentId}] ⚠️ Cache age ${ageSeconds.toFixed(1)}s > 20s - invalidating for fresh AI decisions`);
    agentCache.delete(agentId);
    return null; // Force regeneration for fresh AI
  }
  
  // Don't return cached empty array if it's been less than 10 seconds (might be a transient issue)
  if (entry.trades.length === 0 && ageSeconds < 10) {
    console.log(`[Cache:${agentId}] ⚠️ Cache has 0 trades but age is only ${ageSeconds.toFixed(1)}s - invalidating to retry`);
    agentCache.delete(agentId);
    return null; // Force regeneration
  }
  
  return entry.trades;
}

/**
 * Set cached agent trades
 * 
 * @param agentId - Agent identifier
 * @param trades - Trades to cache
 * @param marketIds - Sorted array of market IDs used
 */
export function setCachedAgentTrades(
  agentId: AgentId,
  trades: AgentTrade[],
  marketIds: string[]
): void {
  // Only cache if we have trades OR if we explicitly want to cache empty (after full analysis)
  // For now, always cache (even 0 trades) to prevent repeated expensive computations
  agentCache.set(agentId, {
    trades,
    generatedAt: Date.now(),
    marketIds: [...marketIds], // Copy array
  });
  console.log(`[Cache:${agentId}] 💾 Cached ${trades.length} trades for ${marketIds.length} markets`);
}

/**
 * Clear agent cache (useful for testing)
 */
export function clearAgentCache(): void {
  agentCache.clear();
}

