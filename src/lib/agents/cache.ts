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
 * Cache TTL: 2 minutes
 */
const CACHE_TTL_MS = 2 * 60 * 1000;

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
  agentCache.set(agentId, {
    trades,
    generatedAt: Date.now(),
    marketIds: [...marketIds], // Copy array
  });
}

/**
 * Clear agent cache (useful for testing)
 */
export function clearAgentCache(): void {
  agentCache.clear();
}

