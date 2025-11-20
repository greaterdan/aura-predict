/**
 * Agent trade cache
 * 
 * Caches generated trades for each agent to avoid redundant computation.
 * Cache invalidates if market IDs change (new markets appear).
 * 
 * Uses Redis for persistence (survives server restarts) with in-memory fallback.
 */

import type { AgentId, AgentTrade } from './domain.js';

/**
 * Cache entry structure
 */
interface AgentCacheEntry {
  trades: AgentTrade[];
  generatedAt: number;
  marketIds: string[]; // Sorted array of market IDs used
}

/**
 * Cache TTL: 5 minutes (longer for persistence, but still fresh enough)
 * Summary requests use cached data, individual agent requests can regenerate if needed
 */
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * In-memory cache: agentId -> cache entry (fallback if Redis unavailable)
 */
const agentCache = new Map<AgentId, AgentCacheEntry>();

/**
 * Redis client (lazy-loaded, optional)
 */
let redisClient: any = null;

/**
 * Initialize Redis client for cache persistence
 * Called from server/index.js after Redis is set up
 */
export function setRedisClient(client: any): void {
  redisClient = client;
  console.log('[Cache] ✅ Redis client set for persistent cache');
}

/**
 * Get cache key for agent
 */
function getCacheKey(agentId: AgentId): string {
  return `agent:trades:${agentId}`;
}

/**
 * Load from Redis (if available)
 */
async function loadFromRedis(agentId: AgentId): Promise<AgentCacheEntry | null> {
  if (!redisClient) return null;
  
  try {
    const key = getCacheKey(agentId);
    const data = await redisClient.get(key);
    if (!data) return null;
    
    const entry = JSON.parse(data) as AgentCacheEntry;
    // Check TTL
    const age = Date.now() - entry.generatedAt;
    if (age >= CACHE_TTL_MS) {
      await redisClient.del(key); // Clean up expired
      return null;
    }
    
    // Also update in-memory cache
    agentCache.set(agentId, entry);
    return entry;
  } catch (error) {
    console.warn(`[Cache:${agentId}] ⚠️ Redis read failed, using in-memory:`, (error as Error).message);
    return null;
  }
}

/**
 * Save to Redis (if available)
 */
async function saveToRedis(agentId: AgentId, entry: AgentCacheEntry): Promise<void> {
  if (!redisClient) return;
  
  try {
    const key = getCacheKey(agentId);
    // Store with TTL slightly longer than cache TTL for cleanup
    await redisClient.setEx(key, Math.ceil(CACHE_TTL_MS / 1000) + 60, JSON.stringify(entry));
  } catch (error) {
    console.warn(`[Cache:${agentId}] ⚠️ Redis write failed:`, (error as Error).message);
  }
}

/**
 * Get cached agent trades
 * 
 * @param agentId - Agent identifier
 * @param currentMarketIds - Sorted array of current market IDs
 * @returns Cached trades or null if cache miss/invalid
 */
export async function getCachedAgentTrades(
  agentId: AgentId,
  currentMarketIds: string[]
): Promise<AgentTrade[] | null> {
  // Try in-memory cache first (fastest)
  let entry = agentCache.get(agentId);
  
  // If not in memory, try Redis (for persistence across restarts)
  if (!entry && redisClient) {
    entry = await loadFromRedis(agentId);
  }
  
  if (!entry) {
    return null; // Cache miss
  }
  
  // Check TTL
  const age = Date.now() - entry.generatedAt;
  if (age >= CACHE_TTL_MS) {
    agentCache.delete(agentId);
    if (redisClient) {
      try {
        await redisClient.del(getCacheKey(agentId));
      } catch (e) {
        // Ignore Redis errors
      }
    }
    return null; // Cache expired
  }
  
  // Check if market IDs match (invalidate if markets changed)
  if (entry.marketIds.length !== currentMarketIds.length) {
    agentCache.delete(agentId);
    if (redisClient) {
      try {
        await redisClient.del(getCacheKey(agentId));
      } catch (e) {
        // Ignore Redis errors
      }
    }
    return null; // Markets changed
  }
  
  // Compare market IDs (both are sorted)
  for (let i = 0; i < entry.marketIds.length; i++) {
    if (entry.marketIds[i] !== currentMarketIds[i]) {
      agentCache.delete(agentId);
      if (redisClient) {
        try {
          await redisClient.del(getCacheKey(agentId));
        } catch (e) {
          // Ignore Redis errors
        }
      }
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
export async function setCachedAgentTrades(
  agentId: AgentId,
  trades: AgentTrade[],
  marketIds: string[]
): Promise<void> {
  const entry: AgentCacheEntry = {
    trades,
    generatedAt: Date.now(),
    marketIds: [...marketIds], // Copy array
  };
  
  // Save to in-memory cache (fast access)
  agentCache.set(agentId, entry);
  
  // Also save to Redis (persistence across restarts)
  await saveToRedis(agentId, entry);
  
  console.log(`[Cache:${agentId}] 💾 Cached ${trades.length} trades for ${marketIds.length} markets (${redisClient ? 'Redis + ' : ''}memory)`);
}

/**
 * Get cached trades without market ID validation (for summary/quick access)
 * This is faster as it doesn't require fetching markets first
 * 
 * @param agentId - Agent identifier
 * @returns Cached trades or null if cache miss/expired
 */
export async function getCachedTradesQuick(agentId: AgentId): Promise<AgentTrade[] | null> {
  // Try in-memory cache first (fastest)
  let entry: AgentCacheEntry | undefined = agentCache.get(agentId);
  
  // If not in memory, try Redis (for persistence across restarts)
  if (!entry && redisClient) {
    const redisEntry = await loadFromRedis(agentId);
    if (redisEntry) {
      entry = redisEntry;
    }
  }
  
  if (!entry) {
    return null; // Cache miss
  }
  
  // Check TTL only (no market ID validation for speed)
  const age = Date.now() - entry.generatedAt;
  if (age >= CACHE_TTL_MS) {
    agentCache.delete(agentId);
    if (redisClient) {
      try {
        await redisClient.del(getCacheKey(agentId));
      } catch (e) {
        // Ignore Redis errors
      }
    }
    return null; // Cache expired
  }
  
  return entry.trades;
}

/**
 * Clear agent cache (useful for testing)
 */
export function clearAgentCache(): void {
  agentCache.clear();
}

